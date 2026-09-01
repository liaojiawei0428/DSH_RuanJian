/**
 * dsh-server-ssh — shared primitives: input validation, redacted views,
 * host-key fingerprints, known_hosts matching, POSIX quoting, coded errors.
 * Pure `node:` crypto only; no transport or store coupling.
 */

import { createHash, createHmac, randomUUID } from 'node:crypto'

/** All `AUTH_TYPES` values accepted by `ServerConfig.auth.type`. */
export const AUTH_TYPES = ['key', 'agent', 'password', 'auto']

/** Default TCP port when the caller omits it (explicit 0 is rejected, not silently remapped). */
export const DEFAULT_PORT = 22

/**
 * Coded, UI-presentable error carried through RPC and tool results.
 * `code` is one of the ERROR_CODES values; `stage` names the probe that raised it.
 */
export class SshError extends Error {
  /**
   * @param {string} code - machine-readable error class (see ERROR_CODES).
   * @param {string} message - human-readable detail.
   * @param {{stage?: string, cause?: unknown}} [options]
   */
  constructor(code, message, options = {}) {
    super(message)
    this.name = 'SshError'
    this.code = code
    this.stage = options.stage
    if (options.cause !== undefined) this.cause = options.cause
  }
}

/** Closed vocabulary of transport/session error codes shared with the client UI. */
export const ERROR_CODES = [
  'NETWORK_TIMEOUT',
  'NETWORK_REFUSED',
  'HOST_NOT_FOUND',
  'AUTH_FAILED',
  'KEY_PASSPHRASE_REQUIRED',
  'PASSWORD_REQUIRED',
  'HOST_KEY_UNTRUSTED',
  'HOST_KEY_CHANGED',
  'NO_TARGET',
  'SERVER_BUSY',
  'SERVER_NOT_FOUND',
  'INVALID_INPUT',
  'REMOTE_ERROR',
]

/**
 * Map one low-level transport error to a coded `SshError`.
 * ssh2 surfaces the same failure through several shapes; order the checks
 * from the most specific marker to the generic message text.
 * @param {unknown} err - thrown or emitted transport error.
 * @param {string} [stage] - probe name attached to the coded error.
 * @returns {SshError}
 */
export function classifyConnectError(err, stage) {
  const message = err instanceof Error ? err.message : String(err)
  const level = err && typeof err === 'object' ? /** @type {{level?: string}} */ (err).level : undefined
  if (level === 'client-timeout' || /timed?\s?out/i.test(message)) return new SshError('NETWORK_TIMEOUT', message, { stage, cause: err })
  if (level === 'client-auth' || /all configured authentication methods failed/i.test(message)) {
    if (/passphrase/i.test(message)) return new SshError('KEY_PASSPHRASE_REQUIRED', message, { stage, cause: err })
    return new SshError('AUTH_FAILED', message, { stage, cause: err })
  }
  if (/ECONNREFUSED/i.test(message)) return new SshError('NETWORK_REFUSED', message, { stage, cause: err })
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return new SshError('HOST_NOT_FOUND', message, { stage, cause: err })
  if (/host key verification|hostkey/i.test(message)) return new SshError('HOST_KEY_UNTRUSTED', message, { stage, cause: err })
  return new SshError('REMOTE_ERROR', message, { stage, cause: err })
}

/**
 * Validate and normalize one server-config input object into a persisted shape.
 * Throws `SshError('INVALID_INPUT')` with a precise message on any bad field;
 * the invalid `auth.type` is rejected instead of silently falling back to auto.
 * @param {Record<string, unknown>} input - raw client-provided fields.
 * @param {{partial?: boolean}} [options] - partial merges validate only present keys.
 * @returns {Record<string, unknown>} normalized server record (without secrets beyond keyPath).
 */
export function validateServerInput(input, options = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new SshError('INVALID_INPUT', 'server payload must be an object')
  }
  const src = /** @type {Record<string, unknown>} */ (input)
  const out = /** @type {Record<string, unknown>} */ ({})

  const name = src.name
  if (typeof name !== 'string' || name.trim() === '') throw new SshError('INVALID_INPUT', 'name is required')
  out.name = name.trim().slice(0, 100)

  const host = src.host
  if (typeof host !== 'string' || host.trim() === '') throw new SshError('INVALID_INPUT', 'host is required')
  out.host = host.trim().slice(0, 253)

  const port = src.port === undefined || src.port === null ? DEFAULT_PORT : src.port
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SshError('INVALID_INPUT', `port must be an integer in 1..65535, got ${String(port)}`)
  }
  out.port = port

  const username = src.username
  if (typeof username !== 'string' || username.trim() === '') throw new SshError('INVALID_INPUT', 'username is required')
  out.username = username.trim().slice(0, 100)

  const auth = (src.auth && typeof src.auth === 'object' && !Array.isArray(src.auth))
    ? /** @type {Record<string, unknown>} */ (src.auth)
    : {}
  const authType = auth.type === undefined ? 'auto' : auth.type
  if (!AUTH_TYPES.includes(/** @type {string} */ (authType))) {
    throw new SshError('INVALID_INPUT', `auth.type must be one of ${AUTH_TYPES.join('/')}, got ${String(authType)}`)
  }
  const normalizedAuth = /** @type {Record<string, unknown>} */ ({ type: authType })
  if (auth.keyPath !== undefined && auth.keyPath !== null && auth.keyPath !== '') {
    if (typeof auth.keyPath !== 'string') throw new SshError('INVALID_INPUT', 'auth.keyPath must be a string')
    normalizedAuth.keyPath = auth.keyPath
  }
  if (auth.allowFingerprint !== undefined && auth.allowFingerprint !== null && auth.allowFingerprint !== '') {
    if (typeof auth.allowFingerprint !== 'string') throw new SshError('INVALID_INPUT', 'auth.allowFingerprint must be a string')
    normalizedAuth.allowFingerprint = auth.allowFingerprint
  }
  out.auth = normalizedAuth

  if (src.remoteRoot !== undefined && src.remoteRoot !== null && src.remoteRoot !== '') {
    if (typeof src.remoteRoot !== 'string') throw new SshError('INVALID_INPUT', 'remoteRoot must be a string')
    out.remoteRoot = src.remoteRoot
  } else if (!options.partial) {
    out.remoteRoot = '~'
  }

  if (src.id !== undefined && src.id !== null && src.id !== '') {
    if (typeof src.id !== 'string') throw new SshError('INVALID_INPUT', 'id must be a string')
    out.id = src.id
  } else if (!options.partial) {
    out.id = `srv_${randomUUID().replace(/-/g, '').slice(0, 20)}`
  }
  return out
}

/**
 * Client-safe view of a server record: never carries the password flag value,
 * only whether one is held in process memory by the connection pool.
 * @param {Record<string, unknown>} server - persisted server record.
 * @param {{hasPassword?: boolean, connected?: boolean}} [runtime] - pool-held facts.
 * @returns {Record<string, unknown>} redacted copy safe to send to the browser.
 */
export function publicServer(server, runtime = {}) {
  return {
    id: server.id,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth: { type: /** @type {Record<string, unknown>} */ (server.auth).type, keyPath: /** @type {Record<string, unknown>} */ (server.auth).keyPath },
    remoteRoot: server.remoteRoot,
    fingerprint: server.fingerprint,
    hasPassword: runtime.hasPassword === true,
    connected: runtime.connected === true,
  }
}

/**
 * OpenSSH-style SHA256 fingerprint of a raw host key buffer.
 * @param {Buffer} hostKey - raw host key bytes as delivered by ssh2.
 * @returns {string} `SHA256:<base64-no-padding>`.
 */
export function fingerprintSha256(hostKey) {
  return `SHA256:${createHash('sha256').update(hostKey).digest('base64').replace(/=+$/, '')}`
}

/**
 * Match one `known_hosts` line pair against a host/key.
 * Supports both plaintext hosts and hashed `|1|salt|hash` entries (HMAC-SHA1).
 * @param {{hostPatterns: string[], key?: Buffer, fingerprint?: string}} entry - parsed line.
 * @param {string} host - host as configured.
 * @param {number} port - configured port.
 * @param {string} fingerprint - `SHA256:...` fingerprint of the presented key.
 * @returns {boolean}
 */
export function matchKnownHostsEntry(entry, host, port, fingerprint) {
  const hostCandidates = port === DEFAULT_PORT ? [host] : [host, `[${host}]:${port}`]
  const patternHit = entry.hostPatterns.some((pattern) => {
    if (pattern.startsWith('|1|')) {
      const [, , saltB64, hashB64] = pattern.split('|')
      if (!saltB64 || !hashB64) return false
      return hostCandidates.some((candidate) =>
        createHmac('sha1', Buffer.from(saltB64, 'base64')).update(candidate).digest('base64').replace(/=+$/, '') === hashB64.replace(/=+$/, ''))
    }
    return hostCandidates.includes(pattern)
  })
  if (!patternHit) return false
  if (entry.fingerprint) return entry.fingerprint === fingerprint
  return true
}

/**
 * Parse a `known_hosts`-style line into its host patterns and key fingerprint.
 * Lines with markers (`@cert-authority`, `@revoked`) are skipped by the caller.
 * @param {string} line - one raw file line.
 * @param {(key: Buffer) => string} fingerprintOf - fingerprint function (injected to avoid a cycle).
 * @returns {{hostPatterns: string[], key?: Buffer, fingerprint?: string} | undefined}
 */
export function parseKnownHostsLine(line, fingerprintOf) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('@')) return undefined
  const parts = trimmed.split(/\s+/)
  if (parts.length < 3) return undefined
  const [hostPatterns, , keyB64] = parts
  let key
  try {
    key = Buffer.from(keyB64, 'base64')
  } catch {
    return undefined
  }
  if (key.length === 0) return undefined
  return { hostPatterns: hostPatterns.split(','), key, fingerprint: fingerprintOf(key) }
}

/**
 * Single-quote one string for safe interpolation into a POSIX shell command.
 * @param {string} value - raw text (paths, globs, command fragments).
 * @returns {string} quoted literal.
 */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * Defense for Windows-originated paths slipping into remote POSIX commands.
 * @param {string} p - candidate path.
 * @returns {boolean}
 */
export function looksLikeWindowsPath(p) {
  return /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\')
}

/**
 * Normalize a remote path: expand a leading `~` against the login home,
 * collapse `//`, and resolve `.`/`..` lexically (no remote round-trip).
 * @param {string} p - configured remoteRoot or tool-provided path.
 * @param {string} home - remote absolute home directory (from `realpath('.')`).
 * @returns {string} absolute POSIX path.
 */
export function resolveRemotePath(p, home) {
  let expanded = p
  if (expanded === '~') expanded = home
  else if (expanded.startsWith('~/')) expanded = `${home}${expanded.slice(1)}`
  const abs = expanded.startsWith('/') ? expanded : `${home}/${expanded}`
  const parts = abs.split('/')
  const out = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}
