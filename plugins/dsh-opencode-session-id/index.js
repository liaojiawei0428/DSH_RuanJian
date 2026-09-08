/**
 * dsh-opencode-session-id — host half.
 *
 * Injects per-conversation session identity headers (x-opencode-session by
 * default) into outbound inference HTTP requests that target the opencode.ai
 * gateway (pi-ai providers `opencode` / `opencode-go`). The gateway enforces
 * the header since 2026-09-05 and answers requests without it with HTTP 400
 * `MissingSessionID` (deepseek-ai/deepseek-harness discussion #5495).
 *
 * Mechanism (wire layer, matching the opencode client's own behavior):
 *  - a `llm/stream` waterfall listener captures each request's session id and
 *    keeps it scoped while the downstream stream runs (the pi-ai adapters
 *    perform their fetch during iteration, so the scope covers every request
 *    of the conversation, including retries);
 *  - a global fetch wrapper appends the session header when the target URL
 *    matches the configured opencode hosts/base URLs, and only when a session
 *    is in scope. The request body, URL, method, and unrelated headers pass
 *    through unchanged.
 *
 * STANDARD COMPLIANCE (PLUGIN-STANDARD.md):
 *  - P2 zero workspace imports: only node: builtins and injected services;
 *    a linked install has no node_modules to resolve @deepseek-ai/* from.
 *  - P3 minimal injections: no hard service dependencies (ctx.on is a
 *    framework builtin); optional facts are read from plain objects/env.
 *  - P5 registrations are effects: every contribution is wrapped in
 *    ctx.effect(() => disposer), including the global fetch mutation.
 *  - P6 fail loud at load for config errors (the pre-flight gate catches this
 *    before the server restarts).
 */

import { createHash } from 'node:crypto'

export const name = 'opencode-session-id'

/** Hard service dependencies only; see P3 before adding one. */
export const inject = []

/**
 * The wire token of the conversation whose llm/stream run is currently in
 * flight (module scope: only one conversation streams at a time per process,
 * and every await between the wrapped generator's own steps belongs to it).
 */
let scopedToken = undefined

/** Module-level guard so a process never double-wraps globalThis.fetch. */
const FETCH_WRAPPED = Symbol.for('dsh.opencodeSessionId.fetchWrapped')

/** Default header set matching the opencode gateway's contract. */
const DEFAULT_HEADERS = ['x-opencode-session']

/** Default providers whose streams carry session ids (pi-ai route names). */
const DEFAULT_PROVIDERS = ['opencode', 'opencode-go']

/** Default URL host suffixes that receive session headers. */
const DEFAULT_HOSTS = ['opencode.ai']

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Build the wire token for one session id. The default hashes the uuid
 * portion of `session-<uuid>` (the `session-` prefix excluded) with SHA-256
 * into a pure-alphanumeric token, so the gateway cannot reverse it to the
 * original id; `hashSessionId: false` sends the raw id instead.
 * @param sessionId - the branded session id (string form) from GenerateOptions.
 * @param config - resolved plugin config.
 * @returns the wire token, or undefined when no session id is known.
 */
function tokenForSession(sessionId, config) {
  const raw = String(sessionId)
  if (config.hashSessionId !== true) return raw
  const uuid = raw.replace(/^session-/, '')
  const digest = createHash('sha256').update(uuid, 'utf8').digest()
  let value = 0n
  for (const byte of digest) value = (value << 8n) | BigInt(byte)
  const length = config.hashLength
  let token = ''
  for (let i = 0; i < length; i += 1) {
    token += ALPHABET[Number(value % 62n)]
    value /= 62n
  }
  return token
}

/**
 * Match a request URL against the configured host suffixes and exact base
 * URL prefixes.
 * @param url - the target URL string.
 * @param config - resolved plugin config.
 * @returns true when the request deserves session headers.
 */
function matchesTarget(url, config) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.toLowerCase()
  if (config.hosts.some(suffix => host === suffix || host.endsWith(`.${suffix}`))) return true
  return config.baseURLs.some(prefix => url.startsWith(prefix))
}

/**
 * Merge the configured headers into a copy of the caller's init headers and
 * return the cloned init. The caller's objects are never mutated.
 * @param init - the original fetch init (may be undefined).
 * @param token - the wire token to attach.
 * @param config - resolved plugin config.
 * @returns the cloned init, or undefined when no header applies.
 */
function withSessionHeaders(init, token, config) {
  const source = init?.headers
  const headers = new Headers(source === undefined ? undefined : source)
  let touched = false
  for (const header of config.headers) {
    if (headers.has(header)) continue
    headers.set(header, token)
    touched = true
  }
  for (const [header, value] of Object.entries(config.extraHeaders)) {
    if (headers.has(header)) continue
    headers.set(header, value)
    touched = true
  }
  if (config.userAgent !== undefined && !headers.has('user-agent')) {
    headers.set('user-agent', config.userAgent)
    touched = true
  }
  if (!touched) return init
  return { ...init, headers }
}

/**
 * Plugin body: install the fetch wrapper and the llm/stream session scoping.
 * @param ctx - host root context.
 * @param config - resolved plugin config (validated below).
 */
export function apply(ctx, config = {}) {
  const normalized = {
    providers: config.providers ?? DEFAULT_PROVIDERS,
    hosts: config.hosts ?? DEFAULT_HOSTS,
    baseURLs: config.baseURLs ?? [],
    headers: config.headers ?? DEFAULT_HEADERS,
    extraHeaders: config.extraHeaders ?? {},
    userAgent: config.userAgent,
    hashSessionId: config.hashSessionId !== undefined ? config.hashSessionId : false,
    hashLength: config.hashLength ?? 8,
    sessionIdEnv: config.sessionIdEnv,
    verbose: config.verbose === true,
  }
  if (!Array.isArray(normalized.providers) || normalized.providers.some(p => typeof p !== 'string')) {
    throw new Error('opencode-session-id: config.providers must be an array of strings')
  }
  if (!Array.isArray(normalized.hosts) || normalized.hosts.some(h => typeof h !== 'string' || h.length === 0)) {
    throw new Error('opencode-session-id: config.hosts must be an array of non-empty strings')
  }
  if (!Array.isArray(normalized.baseURLs) || normalized.baseURLs.some(h => typeof h !== 'string')) {
    throw new Error('opencode-session-id: config.baseURLs must be an array of strings')
  }
  if (!Array.isArray(normalized.headers) || normalized.headers.length === 0
    || normalized.headers.some(h => typeof h !== 'string' || h.length === 0)) {
    throw new Error('opencode-session-id: config.headers must be a non-empty array of non-empty strings')
  }
  if (typeof normalized.extraHeaders !== 'object' || normalized.extraHeaders === null
    || Object.values(normalized.extraHeaders).some(v => typeof v !== 'string')) {
    throw new Error('opencode-session-id: config.extraHeaders must be an object of string values')
  }
  if (normalized.userAgent !== undefined && typeof normalized.userAgent !== 'string') {
    throw new Error('opencode-session-id: config.userAgent must be a string')
  }
  if (typeof normalized.hashSessionId !== 'boolean') {
    throw new Error('opencode-session-id: config.hashSessionId must be a boolean')
  }
  if (!Number.isInteger(normalized.hashLength) || normalized.hashLength < 4 || normalized.hashLength > 32) {
    throw new Error('opencode-session-id: config.hashLength must be an integer between 4 and 32')
  }
  if (normalized.sessionIdEnv !== undefined && typeof normalized.sessionIdEnv !== 'string') {
    throw new Error('opencode-session-id: config.sessionIdEnv must be a string')
  }

  const logger = ctx.logger

  /**
   * Resolve the wire token for one llm/stream invocation: the request's own
   * session id first, then the configured env var, then DSH_SESSION_ID, then
   * nothing (requests outside a known conversation are left untouched).
   * @param options - GenerateOptions as delivered by the waterfall.
   * @returns the wire token, or undefined.
   */
  const tokenForOptions = (options) => {
    if (options.sessionId !== undefined) return tokenForSession(options.sessionId, normalized)
    const envName = normalized.sessionIdEnv ?? 'DSH_SESSION_ID'
    const fromEnv = process.env[envName]
    if (fromEnv !== undefined && fromEnv.length > 0) return tokenForSession(fromEnv, normalized)
    return undefined
  }

  /**
   * Scope the wire token for the duration of the downstream stream: pi-ai
   * adapters build and issue their fetch during iteration, so the scope must
   * span the whole stream, not just the next() call.
   * @param options - GenerateOptions.
   * @param next - the downstream llm/stream chain.
   * @returns the wrapped async iterable.
   */
  const scopedStream = (options, next) => {
    if (normalized.providers.length > 0
      && !normalized.providers.includes(String(options.provider ?? ''))) {
      return next()
    }
    const token = tokenForOptions(options)
    if (token === undefined) return next()
    return (async function* () {
      const previous = scopedToken
      scopedToken = token
      try {
        yield* next()
      } finally {
        scopedToken = previous
      }
    })()
  }

  // Fetch wrapper installation is process-global and idempotent: a second
  // mount keeps the first wrapper (its config may differ, but double-wrapping
  // would double-inject nothing — the outer wrapper sees the inner already
  // carrying headers and skips per the has() guard). Dispose only restores
  // when our own wrapper is still the installed one.
  if (globalThis.fetch?.[FETCH_WRAPPED] === true) {
    logger.warn('opencode-session-id: global fetch already wrapped (double mount?) — keeping the existing wrapper')
  } else {
    const originalFetch = globalThis.fetch
    if (typeof originalFetch !== 'function') {
      throw new Error('opencode-session-id: globalThis.fetch is unavailable')
    }
    const wrappedFetch = (input, init) => {
      const token = scopedToken
      if (token === undefined) return originalFetch(input, init)
      let url
      try {
        url = typeof input === 'string' ? input : input.url
      } catch {
        url = undefined
      }
      if (url === undefined || !matchesTarget(url, normalized)) return originalFetch(input, init)
      if (normalized.verbose) {
        logger.info(`opencode-session-id: injecting session token ${token} for ${url}`)
      }
      return originalFetch(input, withSessionHeaders(init, token, normalized))
    }
    Object.defineProperty(wrappedFetch, FETCH_WRAPPED, { value: true })
    ctx.effect(() => {
      globalThis.fetch = wrappedFetch
      return () => {
        if (globalThis.fetch === wrappedFetch) globalThis.fetch = originalFetch
      }
    })
  }

  ctx.effect(() => ctx.on('llm/stream', scopedStream))
}