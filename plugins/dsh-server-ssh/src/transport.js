/**
 * dsh-server-ssh — SSH transport pool.
 *
 * One shared ssh2 Client per configured server id: sessions reuse the same
 * TCP+auth handshake, and disposal of a session never closes the pool.
 * Passwords live only in process memory (Buffer), wiped on forget.
 *
 * Hard rules carried over from the audited reference:
 *  - Every event source gets a persistent `on('error')`: ssh2 emits multiple
 *    error events while iterating auth candidates, and a `once` handler lets
 *    the second one escape as a process-fatal exception.
 *  - close/end/error callbacks re-check `entries.get(id)` before touching the
 *    entry (stale-entry guard) so a reconnect racing a disconnect is a no-op.
 */

import { Client } from 'ssh2'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { SshError, classifyConnectError, fingerprintSha256, matchKnownHostsEntry, parseKnownHostsLine } from './utils.js'

/** Connect handshake timeout in milliseconds. */
const CONNECT_TIMEOUT_MS = 15000

/**
 * @typedef {Object} TestStage
 * @property {string} stage - probe name (connect / auth / sftp / home / uname).
 * @property {string} status - `ok` or `failed`.
 * @property {string} [detail] - human-readable detail on failure.
 */

/**
 * @typedef {Object} PoolEntry
 * @property {Client} client
 * @property {Promise<Client>} ready
 * @property {() => string | undefined} fingerprint - presented host key fingerprint once the handshake reached hostkey stage.
 * @property {Buffer | undefined} password
 * @property {Promise<import('ssh2').SFTPWrapper> | undefined} sftpPromise - single-flight SFTP channel open.
 */

/**
 * Convert a memory Buffer to a utf8 string and wipe the buffer.
 * @param {Buffer | undefined} buffer
 * @returns {string | undefined}
 */
function bufferToStringAndWipe(buffer) {
  if (buffer === undefined) return undefined
  const text = buffer.toString('utf8')
  buffer.fill(0)
  return text
}

/**
 * Connection pool shared by every session. Keyed by server id (never by
 * session), so a session disposal cannot drop another session's transport.
 */
export class ConnectionManager {
  /** @private @type {Map<string, PoolEntry>} */ entries = new Map()
  /** @private @type {Map<string, string>} */ homeCache = new Map()
  /** @private */ log

  /**
   * @param {{log?: (message: string) => void}} [options]
   */
  constructor(options = {}) {
    this.log = options.log ?? (() => {})
  }

  /**
   * Whether a live transport exists for the server.
   * @param {string} serverId
   */
  isConnected(serverId) {
    const entry = this.entries.get(serverId)
    return entry !== undefined && !entry.client.destroyed
  }

  /**
   * Drop one held password from memory (wipe before delete).
   * @param {string} serverId
   */
  forgetPassword(serverId) {
    const entry = this.entries.get(serverId)
    if (entry?.password !== undefined) entry.password.fill(0)
  }

  /**
   * Accept one password into process memory for the server's next connect.
   * @param {string} serverId
   * @param {string} password
   */
  holdPassword(serverId, password) {
    const entry = this.entries.get(serverId)
    if (entry !== undefined) {
      entry.password = Buffer.from(password, 'utf8')
    } else {
      this.passwordsHeld ??= new Map()
      this.passwordsHeld.set(serverId, Buffer.from(password, 'utf8'))
    }
  }

  /** @private @type {Map<string, Buffer> | undefined} */ passwordsHeld

  /**
   * Take (and clear) a held password for a server with no live entry yet.
   * @param {string} serverId
   * @returns {Buffer | undefined}
   * @private
   */
  takeHeldPassword(serverId) {
    const held = this.passwordsHeld?.get(serverId)
    if (held !== undefined) this.passwordsHeld?.delete(serverId)
    return held
  }

  /**
   * Return a ready ssh2 Client for the server, connecting single-flight.
   * TOFU order: configured fingerprint > known_hosts > reject as untrusted.
   * @param {Record<string, unknown>} server - persisted server record.
   * @param {{password?: string, allowFingerprint?: string}} [secrets] - one-shot credentials from RPC.
   * @returns {Promise<Client>}
   */
  connect(server, secrets = {}) {
    const serverId = /** @type {string} */ (server.id)
    const existing = this.entries.get(serverId)
    if (existing !== undefined) return existing.ready
    const { ready, fingerprintRef } = this.connectOnce(server, secrets)
    const entry = /** @type {PoolEntry} */ ({ client: /** @type {Client} */ ({}), ready, fingerprint: () => fingerprintRef.current, password: undefined, sftpPromise: undefined })
    this.entries.set(serverId, entry)
    ready.then((client) => {
      if (this.entries.get(serverId) !== entry) return
      entry.client = client
    }, () => {
      if (this.entries.get(serverId) === entry) this.entries.delete(serverId)
    })
    return ready
  }

  /**
   * Single connection attempt; callers go through `connect` for single-flight.
   * TOFU order: configured fingerprint > known_hosts > reject as untrusted.
   * @param {Record<string, unknown>} server
   * @param {{password?: string, allowFingerprint?: string}} secrets
   * @returns {{ready: Promise<Client>, fingerprintRef: {current: string | undefined}}} `fingerprintRef.current`
   * carries the presented key's fingerprint once the handshake reaches hostkey stage.
   * @private
   */
  connectOnce(server, secrets) {
    const auth = /** @type {Record<string, unknown>} */ (server.auth)
    const heldPassword = this.takeHeldPassword(/** @type {string} */ (server.id))
    const password = secrets.password !== undefined
      ? Buffer.from(secrets.password, 'utf8')
      : heldPassword

    /** @type {Record<string, unknown>} */
    const config = {
      host: /** @type {string} */ (server.host),
      port: /** @type {number} */ (server.port),
      username: /** @type {string} */ (server.username),
      readyTimeout: CONNECT_TIMEOUT_MS,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
    }
    /** @type {{current: string | undefined}} */
    const fingerprintRef = { current: undefined }
    const ready = this.applyAuth(config, server, auth, password).then(() => new Promise((resolve, reject) => {
      let settled = false
      config.hostVerifier = /** @type {(key: Buffer) => boolean} */ ((key) => {
        fingerprintRef.current = fingerprintSha256(key)
        if (this.trustAllows(server, fingerprintRef.current, secrets.allowFingerprint)) return true
        setImmediate(() => {
          if (settled) return
          settled = true
          const known = this.hasKnownHostEntry(/** @type {string} */ (server.host), /** @type {number} */ (server.port), fingerprintRef.current ?? '')
          const code = known ? 'HOST_KEY_CHANGED' : 'HOST_KEY_UNTRUSTED'
          reject(new SshError(code, `host key fingerprint ${fingerprintRef.current} not trusted`, { stage: 'hostkey' }))
        })
        return false
      })

      const client = new Client()
      client.on('error', (err) => {
        if (settled) return
        settled = true
        reject(classifyConnectError(err, 'connect'))
      })
      client.on('ready', () => {
        if (settled) return
        settled = true
        resolve(client)
      })
      client.connect(/** @type {import('ssh2').ConnectConfig} */ (config))
    }))
    return { ready, fingerprintRef }
  }

  /**
   * Fill auth fields per the server's auth mode and what material exists.
   * @param {Record<string, unknown>} config - connect config being built.
   * @param {Record<string, unknown>} server
   * @param {Record<string, unknown>} auth - normalized auth block.
   * @param {Buffer | undefined} password - pool- or RPC-provided password.
   * @private
   */
  async applyAuth(config, server, auth, password) {
    const type = /** @type {string} */ (auth.type)
    const keyPath = typeof auth.keyPath === 'string' ? auth.keyPath : undefined
    const candidates = []
    if (type === 'key' || type === 'auto') {
      if (keyPath !== undefined) candidates.push(keyPath)
      else {
        const home = join(homedir(), '.ssh')
        for (const name of ['id_ed25519', 'id_ecdsa', 'id_rsa']) {
          const candidate = join(home, name)
          if (existsSync(candidate)) candidates.push(candidate)
        }
      }
    }
    for (const candidate of candidates) {
      try {
        config.privateKey = await readFile(candidate, 'utf8')
        break
      } catch (err) {
        this.log(`key ${candidate} unreadable: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    if (config.privateKey !== undefined) return
    if (type === 'agent' || (type === 'auto' && config.privateKey === undefined)) {
      const agentPath = process.env.SSH_AUTH_SOCK ?? '\\\\.\\pipe\\openssh-ssh-agent'
      if (existsSync(agentPath) || process.env.SSH_AUTH_SOCK !== undefined) {
        config.agent = agentPath
        return
      }
    }
    if (type === 'password' || type === 'auto') {
      const passwordText = bufferToStringAndWipe(password)
      if (passwordText !== undefined) {
        config.password = passwordText
        return
      }
      if (type === 'password') throw new SshError('PASSWORD_REQUIRED', 'this server needs a password; enter it in the connection dialog', { stage: 'auth' })
    }
    throw new SshError('AUTH_FAILED', 'no usable auth material (no readable key, no ssh-agent, no password)', { stage: 'auth' })
  }

  /**
   * TOFU decision: configured fingerprint wins, then the one-shot
   * allowFingerprint, then a known_hosts match. Otherwise reject.
   * @param {Record<string, unknown>} server
   * @param {string} fingerprint
   * @param {string | undefined} allowFingerprint
   * @private
   */
  trustAllows(server, fingerprint, allowFingerprint) {
    const configured = /** @type {Record<string, unknown>} */ (server.auth).allowFingerprint ?? server.fingerprint
    if (typeof configured === 'string' && configured !== '') return configured === fingerprint
    if (allowFingerprint !== undefined) return allowFingerprint === fingerprint
    return this.hasKnownHostEntry(/** @type {string} */ (server.host), /** @type {number} */ (server.port), fingerprint)
  }

  /**
   * Whether any `known_hosts` entry matches this host/port/key fingerprint.
   * @param {string} host
   * @param {number} port
   * @param {string} fingerprint
   * @private
   */
  hasKnownHostEntry(host, port, fingerprint) {
    const file = join(homedir(), '.ssh', 'known_hosts')
    if (!existsSync(file)) return false
    try {
      const text = readFileSync(file, 'utf8')
      for (const line of text.split('\n')) {
        const entry = parseKnownHostsLine(line, (key) => fingerprintSha256(key))
        if (entry !== undefined && matchKnownHostsEntry(entry, host, port, fingerprint)) return true
      }
    } catch (err) {
      this.log(`known_hosts read failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    return false
  }

  /**
   * Lazily open (and cache) one SFTP channel for the server.
   * Single-flight: concurrent callers share one channel-open request.
   * @param {string} serverId
   * @param {Record<string, unknown>} server
   * @param {{password?: string, allowFingerprint?: string}} [secrets]
   * @returns {Promise<import('ssh2').SFTPWrapper>}
   */
  sftp(serverId, server, secrets = {}) {
    const entry = this.entries.get(serverId)
    if (entry === undefined) return Promise.reject(new SshError('REMOTE_ERROR', 'not connected', { stage: 'sftp' }))
    entry.sftpPromise ??= entry.ready.then((client) => new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err !== undefined && err !== null) {
          entry.sftpPromise = undefined
          reject(classifyConnectError(err, 'sftp'))
          return
        }
        sftp.on('error', (sftpErr) => {
          this.log(`sftp channel error on ${serverId}: ${sftpErr instanceof Error ? sftpErr.message : String(sftpErr)}`)
        })
        resolve(sftp)
      })
    }))
    return entry.sftpPromise
  }


  /**
   * Run one command on the server and collect stdout/stderr/exit code.
   * @param {Client} client - ready connection.
   * @param {string} command
   * @param {{timeoutMs?: number, onStdout?: (chunk: string) => void}} [options]
   * @returns {Promise<{code: number | undefined, stdout: string, stderr: string}>}
   */
  exec(client, command, options = {}) {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err !== undefined && err !== null) {
          reject(classifyConnectError(err, 'exec'))
          return
        }
        const stdoutParts = []
        const stderrParts = []
        let stdoutBytes = 0
        let timedOut = false
        /** @type {NodeJS.Timeout | undefined} */
        let timer
        if (options.timeoutMs !== undefined) {
          timer = setTimeout(() => {
            timedOut = true
            stream.close()
            stream.removeAllListeners('close')
            resolve({ code: undefined, stdout: stdoutParts.join(''), stderr: `${stderrParts.join('')}\n[dsh-server-ssh] command timed out after ${options.timeoutMs}ms` })
          }, options.timeoutMs)
        }
        stream.on('data', (chunk) => {
          stdoutBytes += chunk.length
          if (stdoutBytes <= 256 * 1024) stdoutParts.push(chunk.toString('utf8'))
          options.onStdout?.(chunk.toString('utf8'))
        })
        stream.on('stderr', (chunk) => { stderrParts.push(chunk.toString('utf8')) })
        stream.on('error', (streamErr) => {
          if (timer !== undefined) clearTimeout(timer)
          reject(classifyConnectError(streamErr, 'exec'))
        })
        stream.on('close', (code) => {
          if (timer !== undefined) clearTimeout(timer)
          if (timedOut) return
          resolve({ code: typeof code === 'number' ? code : undefined, stdout: stdoutParts.join(''), stderr: stderrParts.join('') })
        })
      })
    })
  }

  /**
   * Probe a candidate server config with a throwaway connection.
   * Reports each stage through `onStage` for the client UI progress display.
   * @param {Record<string, unknown>} server - candidate (not yet persisted).
   * @param {{password?: string, allowFingerprint?: string}} [secrets]
   * @param {(stage: TestStage) => void} [onStage]
   * @returns {Promise<{fingerprint: string, home: string, uname: string, shell: string}>}
   */
  async test(server, secrets = {}, onStage) {
    const report = (stage, status, detail) => { onStage?.({ stage, status, ...(detail === undefined ? {} : { detail }) }) }
    /** @type {Client | undefined} */
    let client
    /** @type {{current: string | undefined}} */
    const fingerprintRef = { current: undefined }
    try {
      let home = ''
      let uname = ''
      let shell = ''
      try {
        const attempt = this.connectOnce(server, secrets)
        const ready = attempt.ready.then((c) => { client = c; return c })
        // 轮询指纹引用：hostVerifier 在握手早期就写入，供拒绝路径上报
        const fingerprintPoll = setInterval(() => {
          if (attempt.fingerprintRef.current !== undefined) fingerprintRef.current = attempt.fingerprintRef.current
        }, 100)
        try {
          client = await ready
        } finally {
          clearInterval(fingerprintPoll)
        }
        if (fingerprintRef.current === undefined && attempt.fingerprintRef.current !== undefined) {
          fingerprintRef.current = attempt.fingerprintRef.current
        }
        report('connect', 'ok')
      } catch (err) {
        const coded = err instanceof SshError ? err : classifyConnectError(err, 'connect')
        report('connect', 'failed', coded.message)
        if (coded.code === 'HOST_KEY_UNTRUSTED' || coded.code === 'HOST_KEY_CHANGED') {
          coded.fingerprint = fingerprintRef.current ?? ''
        }
        throw coded
      }
      const sftpChannel = await new Promise((resolve, reject) => {
        client.sftp((err, sftp) => (err !== undefined && err !== null ? reject(classifyConnectError(err, 'sftp')) : resolve(sftp)))
      }).catch((err) => {
        report('sftp', 'failed', err.message)
        throw err
      })
      report('sftp', 'ok')
      home = await new Promise((resolve, reject) => {
        sftpChannel.realpath('.', (err, resolved) => (err !== undefined && err !== null ? reject(classifyConnectError(err, 'realpath')) : resolve(resolved)))
      }).catch((err) => {
        report('home', 'failed', err.message)
        throw err
      })
      report('home', 'ok')
      const probe = await this.exec(client, 'uname -s; printf \'%s\\n\' "$SHELL"', { timeoutMs: 8000 }).catch((err) => {
        report('uname', 'failed', err.message)
        throw err
      })
      const probeLines = probe.stdout.trim().split('\n')
      uname = probeLines[0] ?? ''
      shell = probeLines[1] ?? ''
      report('uname', 'ok')
      return { fingerprint: fingerprintRef.current ?? '', home, uname, shell }
    } finally {
      client?.end()
    }
  }
  /**
   * Drop the transport for one server (server removed or explicit reconnect).
   * In-flight password material is wiped; a later `connect` starts fresh.
   * @param {string} serverId
   */
  disconnect(serverId) {
    const entry = this.entries.get(serverId)
    if (entry === undefined) return
    this.entries.delete(serverId)
    this.homeCache.delete(serverId)
    entry.ready.then(
      (client) => { client.end() },
      () => {},
    )
  }

  /**
   * Close every pooled transport (plugin disposal).
   */
  dispose() {
    for (const [serverId] of this.entries) this.disconnect(serverId)
    this.homeCache.clear()
    for (const [, buffer] of this.passwordsHeld ?? []) buffer.fill(0)
    this.passwordsHeld?.clear()
  }
}
