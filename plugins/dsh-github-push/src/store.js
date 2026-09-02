/**
 * dsh-github-push — persistent binding store.
 *
 * Two files under DSH_HOME:
 *   github-push/state.json       — project→repo bindings (no tokens)
 *   github-push/credentials.json — per-binding PAT tokens, separate file so
 *     state can be reviewed/diffed without ever touching secrets
 *
 * Same durability rules as dsh-server-ssh/store.js (audited findings):
 *  - every write is atomic (tmp + rename)
 *  - one failed write marks that write failed, later writes keep going
 *  - corrupted state.json is quarantined and replaced, never blocks load
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** On-disk schema version; bump requires a migration step in `normalizeState`. */
export const STORE_VERSION = 1

/**
 * Mint a fresh binding id. Combines a base-36 millisecond timestamp with a
 * random suffix so two saves in the same millisecond cannot collide (the old
 * `Date.now().toString(36)` alone could collide and silently overwrite).
 * @returns {string}
 */
export function mintBindingId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Resolve the store directory and both file paths.
 * @returns {{dir: string, stateFile: string, credFile: string}}
 */
export function storePaths() {
  const root = process.env.DSH_HOME && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
  const dir = join(root, 'github-push')
  return { dir, stateFile: join(dir, 'state.json'), credFile: join(dir, 'credentials.json') }
}

/**
 * Shape one persisted state object to the current schema, dropping unknown
 * fields so hand-edited files cannot smuggle junk into runtime reads.
 * @param {unknown} raw - parsed JSON value.
 * @returns {{version: number, bindings: Array<Record<string, unknown>>, settings: Record<string, string>, selectedBySession: Record<string, string>}}
 */
export function normalizeState(raw) {
  const base = { version: STORE_VERSION, bindings: [], settings: {}, selectedBySession: {} }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
  const src = /** @type {Record<string, unknown>} */ (raw)
  if (Array.isArray(src.bindings)) {
    base.bindings = src.bindings.filter((b) => {
      if (b === null || typeof b !== 'object' || Array.isArray(b)) return false
      const rec = /** @type {Record<string, unknown>} */ (b)
      return typeof rec.id === 'string' && typeof rec.name === 'string'
        && typeof rec.localPath === 'string'
        && typeof rec.repoOwner === 'string' && typeof rec.repoName === 'string'
        && typeof rec.branch === 'string'
    })
  }
  if (src.settings && typeof src.settings === 'object' && !Array.isArray(src.settings)) {
    for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (src.settings))) {
      if (typeof value === 'string') base.settings[key] = value
    }
  }
  if (src.selectedBySession && typeof src.selectedBySession === 'object' && !Array.isArray(src.selectedBySession)) {
    for (const [sessionId, bindingId] of Object.entries(/** @type {Record<string, unknown>} */ (src.selectedBySession))) {
      if (typeof bindingId === 'string') base.selectedBySession[sessionId] = bindingId
    }
  }
  return base
}

/**
 * Shape persisted credentials. Tokens are strings keyed by binding id; only
 * string values survive.
 * @param {unknown} raw - parsed JSON value.
 * @returns {Record<string, string>}
 */
export function normalizeCredentials(raw) {
  const base = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
  for (const [id, token] of Object.entries(/** @type {Record<string, unknown>} */ (raw))) {
    if (typeof token === 'string' && token !== '') base[id] = token
  }
  return base
}

/** A binding record the UI may see (never contains a token). */
export function publicBinding(binding, extra = {}) {
  return { ...binding, ...extra }
}

/**
 * Persistent binding store: serial writes, atomic replace, corruption
 * quarantine, and in-memory read views for the RPC surface.
 */
export class GithubStore {
  /** @private */ state = normalizeState(undefined)
  /** @private */ credentials = normalizeCredentials(undefined)
  /** @private */ loaded = false
  /** @private */ writeChain = Promise.resolve()
  /** @private */ log

  constructor(options = {}) {
    this.log = options.log ?? ((message) => { console.error(`[dsh-github-push] ${message}`) })
  }

  /** Load state + credentials once; quarantine corrupt files and start fresh. */
  async load() {
    if (this.loaded) return
    const { dir, stateFile, credFile } = storePaths()
    await mkdir(dir, { recursive: true })
    await this.loadJson(stateFile, (parsed) => { this.state = normalizeState(parsed) }, 'state.json')
    await this.loadJson(credFile, (parsed) => { this.credentials = normalizeCredentials(parsed) }, 'credentials.json')
    this.loaded = true
  }

  /**
   * Read one JSON file; unreadable → fresh; corrupt → quarantine + fresh.
   * @param {string} file
   * @param {(parsed: unknown) => void} assign
   * @param {string} label
   */
  async loadJson(file, assign, label) {
    if (!existsSync(file)) return
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch (err) {
      this.log(`${label} unreadable, starting fresh: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    if (text.trim() === '') return
    try {
      assign(JSON.parse(text))
    } catch (err) {
      const quarantine = `${file}.corrupt-${Date.now()}`
      try {
        await writeFile(quarantine, text, 'utf8')
        this.log(`${label} corrupt (${err instanceof Error ? err.message : String(err)}); quarantined to ${quarantine}, starting fresh`)
      } catch {
        this.log(`${label} corrupt and quarantine write failed; starting fresh`)
      }
    }
  }

  /** @returns {Array<Record<string, unknown>>} persisted bindings (never tokens). */
  listBindings() {
    return this.state.bindings
  }

  /** @param {string} key @returns {string | undefined} */
  getSetting(key) {
    return this.state.settings[key]
  }

  /**
   * Set (or clear, when value is '') one plugin setting.
   * @param {string} key
   * @param {string} value
   */
  setSetting(key, value) {
    if (value === '') delete this.state.settings[key]
    else this.state.settings[key] = value
    void this.persistNow(this.state)
  }

  /**
   * @param {string} id
   * @returns {Record<string, unknown> | undefined}
   */
  getBinding(id) {
    return this.state.bindings.find((b) => b.id === id)
  }

  /** The GitHub username shared by default across new bindings, if configured. */
  getGithubUser() {
    return this.state.settings.githubUser ?? ''
  }

  /**
   * Session → binding target map.
   * @param {string} sessionId
   * @returns {string | undefined}
   */
  getTarget(sessionId) {
    return this.state.selectedBySession[sessionId]
  }

  /** @returns {Record<string, string>} copy of every session→binding map. */
  getTargets() {
    return { ...this.state.selectedBySession }
  }

  /**
   * Set (or clear, when bindingId is undefined) the binding bound to a session.
   * @param {string} sessionId
   * @param {string | undefined} bindingId
   */
  setTarget(sessionId, bindingId) {
    if (bindingId === undefined) delete this.state.selectedBySession[sessionId]
    else this.state.selectedBySession[sessionId] = bindingId
    void this.persistNow(this.state)
  }

  /**
   * Create a NEW binding record. The id is minted here and guaranteed unique
   * against existing records, so a save can never overwrite another binding.
   * @param {Record<string, unknown>} input - full record fields (no id).
   * @returns {Record<string, unknown>} the created record (with minted id).
   */
  createBinding(input) {
    let id = mintBindingId()
    while (this.state.bindings.some((b) => b.id === id)) id = mintBindingId()
    const record = { id, ...input }
    this.state.bindings.push(record)
    void this.persistNow(this.state)
    return record
  }

  /**
   * Update ONLY an existing binding record. Unknown ids are rejected so an
   * edit can never silently become a create (which would hide a stale id).
   * @param {string} id
   * @param {Record<string, unknown>} patch - fields to overwrite (no id).
   * @returns {Record<string, unknown>} the updated record.
   */
  updateBinding(id, patch) {
    const existing = this.state.bindings.find((b) => b.id === id)
    if (existing === undefined) throw new Error(`no binding with id ${id}`)
    for (const [key, value] of Object.entries(patch)) {
      if (key !== 'id') existing[key] = value
    }
    void this.persistNow(this.state)
    return existing
  }

  /**
   * @param {string} id
   * @returns {boolean} whether a record was removed.
   */
  removeBinding(id) {
    const before = this.state.bindings.length
    this.state.bindings = this.state.bindings.filter((b) => b.id !== id)
    this.credentials = Object.fromEntries(Object.entries(this.credentials).filter(([k]) => k !== id))
    for (const [sessionId, bound] of Object.entries(this.state.selectedBySession)) {
      if (bound === id) delete this.state.selectedBySession[sessionId]
    }
    void this.persistNow(this.state)
    void this.persistNow(this.credentials, true)
    return this.state.bindings.length < before
  }

  /** @param {string} id @returns {string | undefined} */
  getToken(id) {
    return this.credentials[id]
  }

  /**
   * Set (or clear, when token is '') the PAT for one binding.
   * @param {string} id
   * @param {string} token
   */
  setToken(id, token) {
    if (token === '') delete this.credentials[id]
    else this.credentials[id] = token
    void this.persistNow(this.credentials, true)
  }

  /**
   * Serialized atomic write to the given path. Failure of one write is logged
   * and recorded; the chain never rejects (subsequent writes keep working).
   * @param {Record<string, unknown> | Record<string, string>} data
   * @param {boolean} [isCredentials] - which sibling file to target.
   */
  persistNow(data, isCredentials = false) {
    const { dir, stateFile, credFile } = storePaths()
    const file = isCredentials ? credFile : stateFile
    const payload = `${JSON.stringify(data, null, 2)}\n`
    this.writeChain = this.writeChain.then(async () => {
      try {
        await mkdir(dir, { recursive: true })
        const tmp = `${file}.tmp-${process.pid}`
        await writeFile(tmp, payload, 'utf8')
        await rename(tmp, file)
      } catch (err) {
        this.log(`persist ${isCredentials ? 'credentials' : 'state'} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
    return this.writeChain
  }
}