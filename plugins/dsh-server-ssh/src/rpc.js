/**
 * dsh-server-ssh — package-private Client→Host JSON RPC surface.
 *
 * One dedicated channel (`/dsh-server-ssh`); the endpoint segment selects the
 * operation. Responses use the platform ConnectionRpcResult envelope the
 * connection service already imposes on every handler return value:
 * `{ ok: true, value }` or `{ ok: false, error: { code, message, details } }`.
 * Domain failures ride the `ok: false` branch — the browser half rejects its
 * `rpc.call` promise with a typed `.code` — and `details` is always an object
 * (the client response parser rejects a missing one). Only lossless JSON
 * crosses the boundary.
 */

import { SshError, validateServerInput, publicServer } from './utils.js'

/** RPC channel registered on the host connection service. */
export const RPC_CHANNEL = '/dsh-server-ssh'

/**
 * Normalize one thrown error into the platform error payload. `details`
 * carries the probe `stage` and, for host-key rejections, the presented
 * fingerprint the UI needs for its trust-confirmation flow.
 * @param {unknown} err
 * @returns {{code: string, message: string, details: Record<string, string>}}
 */
export function toErrorPayload(err) {
  if (err instanceof SshError) {
    /** @type {Record<string, string>} */
    const details = {}
    if (err.stage !== undefined) details.stage = err.stage
    const fingerprint = /** @type {{fingerprint?: unknown}} */ (err).fingerprint
    if (typeof fingerprint === 'string' && fingerprint !== '') details.fingerprint = fingerprint
    return { code: err.code, message: err.message, details }
  }
  const message = err instanceof Error ? err.message : String(err)
  return { code: 'INTERNAL', message, details: {} }
}

/**
 * Wire the RPC endpoints onto the connection service.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {{connection: {rpc: {handle: (channel: string, handler: (endpoint: string, payload: unknown) => Promise<{ok: boolean, value?: unknown, error?: {code: string, message: string, details?: Record<string, string>}}> ) => () => void}}, store: import('./store.js').ServerStore, connections: import('./transport.js').ConnectionManager, orchestrator: {isServerBusy: (serverId: string) => boolean, boundSessionCount: (serverId: string) => number}, log?: (message: string) => void}} deps
 */
export function applyRpc(ctx, deps) {
  const { connection, store, connections, orchestrator } = deps
  const log = deps.log ?? (() => {})

  ctx.effect(() => connection.rpc.handle(RPC_CHANNEL, async (endpoint, payload) => {
    /** @type {Record<string, unknown>} */
    const args = (payload !== null && typeof payload === 'object' && 'args' in payload
      ? /** @type {{args: Record<string, unknown>}} */ (payload).args
      : {}) ?? {}
    try {
      return { ok: true, value: await dispatch(endpoint, args) }
    } catch (err) {
      // Domain failures reject through the platform error branch so the
      // browser half sees a typed { code, message, details }; only a handler
      // throw itself (a plugin bug) surfaces as HTTP 500.
      const error = toErrorPayload(err)
      if (error.code === 'INTERNAL') log(`rpc ${endpoint} internal error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
      return { ok: false, error }
    }
  }))

  /**
   * Endpoint dispatch. Throws SshError (or plain Error) for domain failures.
   * @param {string} endpoint
   * @param {Record<string, unknown>} args
   */
  async function dispatch(endpoint, args) {
    switch (endpoint) {
      case 'state': return stateSnapshot()
      case 'server.upsert': return upsertServer(args)
      case 'server.remove': return removeServer(args)
      case 'server.test': return testServer(args, false)
      case 'server.testAndSave': return testServer(args, true)
      case 'server.reconnect': return reconnectServer(args)
      case 'target.set': return setTarget(args)
      case 'target.clear': return clearTarget(args)
      default: throw new SshError('BAD_REQUEST', `unknown endpoint: ${endpoint}`)
    }
  }

  /**
   * Full client state snapshot (servers redacted + session bindings).
   * @returns {Promise<Record<string, unknown>>}
   */
  async function stateSnapshot() {
    return {
      servers: store.listServers().map(server => publicServer(server, { connected: connections.isConnected(/** @type {string} */ (server.id)) })),
      selectedBySession: { ...store.state.selectedBySession },
    }
  }

  /**
   * Create or update one server entry.
   * @param {Record<string, unknown>} args
   */
  async function upsertServer(args) {
    const input = /** @type {Record<string, unknown>} */ (args.input ?? {})
    const server = store.upsertServer(input, { partial: args.partial === true })
    return { server: publicServer(server) }
  }

  /**
   * Delete one server entry; refuses while sessions remain bound unless forced.
   * @param {Record<string, unknown>} args
   */
  async function removeServer(args) {
    const id = typeof args.id === 'string' ? args.id : ''
    if (id === '') throw new SshError('BAD_REQUEST', 'id is required')
    if (orchestrator.isServerBusy(id) && args.force !== true) {
      throw new SshError('SERVER_BUSY', `server is bound by ${orchestrator.boundSessionCount(id)} session(s); unbind them or pass force`)
    }
    store.removeServer(id)
    connections.disconnect(id)
    return { removed: id }
  }

  /**
   * Probe-connect one server (saved or draft). Optionally persists on success
   * and records the confirmed host-key fingerprint.
   * @param {Record<string, unknown>} args
   * @param {boolean} save
   */
  async function testServer(args, save) {
    const input = /** @type {Record<string, unknown>} */ (args.input ?? {})
    // Probe a validated draft first; only a successful probe touches the store
    // (testAndSave), so a failed probe never mutates existing entries.
    const draft = validateServerInput(input, { partial: args.partial === true })
    const allowFingerprint = typeof args.allowFingerprint === 'string' ? args.allowFingerprint : undefined
    const password = typeof args.password === 'string' ? args.password : undefined
    const result = await connections.test(draft, { password, allowFingerprint })
    if (save) {
      const server = store.upsertServer({ ...input, id: /** @type {string} */ (draft.id) })
      if (result.fingerprint !== undefined && result.fingerprint !== '') {
        store.setFingerprint(/** @type {string} */ (server.id), result.fingerprint)
      }
      return { server: publicServer(server, { connected: true }), ...result }
    }
    return { server: publicServer(draft), ...result }
  }

  /**
   * Drop and re-establish the pooled transport for one saved server.
   * @param {Record<string, unknown>} args
   */
  async function reconnectServer(args) {
    const id = typeof args.id === 'string' ? args.id : ''
    const server = store.getServer(id)
    if (server === undefined) throw new SshError('SERVER_NOT_FOUND', `no server with id ${id}`)
    connections.disconnect(id)
    await connections.connect(server)
    return { server: publicServer(server, { connected: true }) }
  }

  /**
   * Bind one browser session to a saved server.
   * @param {Record<string, unknown>} args
   */
  async function setTarget(args) {
    const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
    if (sessionId === '') throw new SshError('BAD_REQUEST', 'sessionId is required')
    const serverId = typeof args.serverId === 'string' ? args.serverId : ''
    const server = store.getServer(serverId)
    if (server === undefined) throw new SshError('SERVER_NOT_FOUND', `no server with id ${serverId}`)
    store.setTarget(sessionId, serverId)
    return { sessionId, serverId }
  }

  /**
   * Unbind one browser session.
   * @param {Record<string, unknown>} args
   */
  async function clearTarget(args) {
    const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
    if (sessionId === '') throw new SshError('BAD_REQUEST', 'sessionId is required')
    store.setTarget(sessionId, undefined)
    return { sessionId }
  }
}
