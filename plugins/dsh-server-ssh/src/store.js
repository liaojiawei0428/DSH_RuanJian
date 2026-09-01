/**
 * dsh-server-ssh — persistent server-config store.
 *
 * Differences from the audited reference store (both were major findings):
 *  - The write chain catches per-write failures: one disk error marks that
 *    write failed and the chain keeps accepting later writes.
 *  - A corrupted state file is quarantined as `state.json.corrupt-<ts>` and
 *    replaced by a fresh store instead of failing plugin load (which on this
 *    machine escalates to a G3 boot isolation).
 *  - The file lives under DSH_HOME (`~/.dsh/server-ssh/state.json`), not the
 *    process cwd, so the location is stable regardless of launcher.
 * Passwords are never persisted; the pool holds them in memory buffers only.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

/** On-disk schema version; bumps require a migration step in `normalizeState`. */
export const STORE_VERSION = 1

/**
 * Resolve the store directory and file path.
 * @returns {{dir: string, file: string}}
 */
export function storePaths() {
  const root = process.env.DSH_HOME && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
  const dir = join(root, 'server-ssh')
  return { dir, file: join(dir, 'state.json') }
}

/**
 * Shape one persisted state object to the current schema, dropping unknown
 * fields so hand-edited files cannot smuggle junk into runtime reads.
 * @param {unknown} raw - parsed JSON value.
 * @returns {{version: number, servers: Array<Record<string, unknown>>, selectedBySession: Record<string, string>}}
 */
export function normalizeState(raw) {
  const base = { version: STORE_VERSION, servers: [], selectedBySession: {} }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
  const src = /** @type {Record<string, unknown>} */ (raw)
  if (Array.isArray(src.servers)) {
    base.servers = src.servers.filter((s) => s !== null && typeof s === 'object' && !Array.isArray(s) && typeof /** @type {Record<string, unknown>} */ (s).id === 'string')
  }
  if (src.selectedBySession && typeof src.selectedBySession === 'object' && !Array.isArray(src.selectedBySession)) {
    for (const [sessionId, serverId] of Object.entries(/** @type {Record<string, unknown>} */ (src.selectedBySession))) {
      if (typeof serverId === 'string') base.selectedBySession[sessionId] = serverId
    }
  }
  return base
}

/**
 * Persistent server-config store: serial writes, atomic replace, corruption
 * quarantine, and in-memory read views for the RPC surface.
 */
export class ServerStore {
  /** @private */ state = normalizeState(undefined)
  /** @private */ loaded = false
  /** @private */ writeChain = Promise.resolve()
  /** @private */ log

  /**
   * @param {{log?: (message: string) => void}} [options] - logger receives
   * quarantine/failed-write notices; defaults to console.error.
   */
  constructor(options = {}) {
    this.log = options.log ?? ((message) => { console.error(`[dsh-server-ssh] ${message}`) })
  }

  /**
   * Load the state file once at plugin start. A missing file is a fresh
   * store; an unreadable/corrupt file is quarantined and replaced.
   */
  async load() {
    if (this.loaded) return
    const { dir, file } = storePaths()
    await mkdir(dir, { recursive: true })
    if (existsSync(file)) {
      let text
      try {
        text = await readFile(file, 'utf8')
      } catch (err) {
        this.log(`state file unreadable, starting fresh: ${err instanceof Error ? err.message : String(err)}`)
        text = ''
      }
      if (text.trim() !== '') {
        try {
          this.state = normalizeState(JSON.parse(text))
        } catch (err) {
          const quarantine = `${file}.corrupt-${Date.now()}`
          try {
            await writeFile(quarantine, text, 'utf8')
            this.log(`state.json was corrupt (${err instanceof Error ? err.message : String(err)}); quarantined to ${quarantine}, starting fresh`)
          } catch {
            this.log(`state.json was corrupt and quarantine write also failed; starting fresh`)
          }
          await this.persistNow(normalizeState(undefined))
        }
      }
    }
    this.loaded = true
  }

  /** @returns {Array<Record<string, unknown>>} persisted servers (may contain auth.keyPath; never passwords). */
  listServers() {
    return this.state.servers
  }

  /**
   * @param {string} serverId
   * @returns {Record<string, unknown> | undefined}
   */
  getServer(serverId) {
    return this.state.servers.find((server) => server.id === serverId)
  }

  /**
   * Insert or update one server record. Changing host/port/username clears
   * the stored fingerprint so TOFU re-runs against the new endpoint.
   * @param {Record<string, unknown>} normalized - output of `validateServerInput`.
   * @returns {Promise<{server: Record<string, unknown>, created: boolean}>}
   */
  async upsertServer(normalized) {
    const id = /** @type {string} */ (normalized.id)
    const existing = this.getServer(id)
    const next = { ...normalized }
    if (existing) {
      const endpointChanged = existing.host !== next.host || existing.port !== next.port || existing.username !== next.username
      next.fingerprint = endpointChanged ? undefined : existing.fingerprint
      next.createdAt = existing.createdAt
    } else {
      next.createdAt = Date.now()
    }
    next.updatedAt = Date.now()
    this.state.servers = [...this.state.servers.filter((server) => server.id !== id), next]
    await this.persist()
    return { server: next, created: !existing }
  }

  /**
   * @param {string} serverId
   * @returns {Promise<boolean>} whether a record was removed.
   */
  async removeServer(serverId) {
    const before = this.state.servers.length
    this.state.servers = this.state.servers.filter((server) => server.id !== serverId)
    for (const [sessionId, bound] of Object.entries(this.state.selectedBySession)) {
      if (bound === serverId) delete this.state.selectedBySession[sessionId]
    }
    if (this.state.servers.length === before) return false
    await this.persist()
    return true
  }

  /**
   * @param {string} serverId
   * @returns {Record<string, unknown> | undefined} the stored fingerprint field, if any.
   */
  getFingerprint(serverId) {
    return this.getServer(serverId)?.fingerprint
  }

  /**
   * Persist a TOFU-accepted fingerprint for one server.
   * @param {string} serverId
   * @param {string} fingerprint - `SHA256:...` value.
   */
  async setFingerprint(serverId, fingerprint) {
    const server = this.getServer(serverId)
    if (!server) return
    server.fingerprint = fingerprint
    server.updatedAt = Date.now()
    await this.persist()
  }

  /**
   * @param {string} sessionId
   * @returns {string | undefined} bound server id for the session.
   */
  getTarget(sessionId) {
    return this.state.selectedBySession[sessionId]
  }

  /**
   * Bind one session to a server; `undefined` clears the binding.
   * @param {string} sessionId
   * @param {string | undefined} serverId
   */
  async setTarget(sessionId, serverId) {
    if (serverId === undefined) delete this.state.selectedBySession[sessionId]
    else this.state.selectedBySession[sessionId] = serverId
    await this.persist()
  }

  /**
   * Queue one atomic persist. Failures are logged and swallowed: the failed
   * generation is lost, but the chain stays alive for later writes.
   * @returns {Promise<boolean>} whether this write reached disk.
   */
  persist() {
    const snapshot = JSON.stringify(normalizeState(this.state), null, 2)
    const attempt = this.writeChain.then(() => this.persistNowText(snapshot)).then(
      () => true,
      (err) => {
        this.log(`state persist failed: ${err instanceof Error ? err.message : String(err)}`)
        return false
      },
    )
    this.writeChain = attempt.then(() => {}, () => {})
    return attempt
  }

  /**
   * Immediate atomic write used by load-time recovery.
   * @param {{version: number, servers: unknown[], selectedBySession: Record<string, string>}} state
   */
  async persistNow(state) {
    await this.persistNowText(JSON.stringify(state, null, 2))
  }

  /**
   * Atomic replace: tmp file then rename, so a crash never leaves a half-written store.
   * @param {string} text
   * @private
   */
  async persistNowText(text) {
    const { dir, file } = storePaths()
    const tmp = join(dir, `.state-${process.pid}-${Date.now()}.tmp`)
    await writeFile(tmp, text, 'utf8')
    try {
      await rename(tmp, file)
    } catch (err) {
      try {
        await writeFile(file, text, 'utf8')
      } catch {
        throw err
      }
    }
  }
}
