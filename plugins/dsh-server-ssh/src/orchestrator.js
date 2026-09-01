/**
 * dsh-server-ssh — session orchestration.
 *
 * Each agent gets one dynamic system-prompt context registration bound to its
 * session: the text closure re-reads the session's current target on every
 * assemble, so switching servers from the UI takes effect on the next model
 * request without re-registering anything. The registration lives on the
 * agent-scoped context and unwinds automatically when the agent is disposed.
 *
 * Degradation policy: an unreachable or unbound server degrades the context
 * to a short notice instead of blocking the session.
 */

import { publicServer } from './utils.js'

/** Prompt context name used for the per-session server binding. */
export const CONTEXT_NAME = 'ssh-server-target'

/**
 * Build the dynamic context text for one session (called on every assemble).
 * @param {import('./store.js').ServerStore} store
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {string} sessionId
 * @returns {string} context text; empty when the session has no usable target.
 */
export function targetContextText(store, connections, sessionId) {
  const serverId = store.getTarget(sessionId)
  if (serverId === undefined) {
    return 'Remote server: none selected. The ssh_* tools are unavailable until the user picks a server in the server panel (服务器面板). Do not invent a server.'
  }
  const server = store.getServer(serverId)
  if (server === undefined) {
    return 'Remote server: the previously selected server was removed. Ask the user to pick another server in the server panel before using the ssh_* tools.'
  }
  const auth = /** @type {Record<string, unknown>} */ (server.auth)
  const authText = auth.type === 'auto'
    ? 'auto (key/agent/password)'
    : /** @type {string} */ (auth.type)
  const connected = connections.isConnected(serverId)
  const lines = [
    `Remote server target: "${server.name}" — ${server.username}@${server.host}:${server.port} (auth: ${authText}${connected ? ', connected' : ', will connect on first use'}).`,
    'The ssh_* tools (ssh_read, ssh_write, ssh_edit, ssh_list, ssh_glob, ssh_grep, ssh_bash) operate on THIS server.',
    'Remote paths are POSIX (forward slashes); `~` expands to the login home. Never pass Windows-style paths to ssh_* tools.',
    'When an ssh_* tool reports HOST_KEY_UNTRUSTED, AUTH_FAILED, or PASSWORD_REQUIRED, tell the user to open the server panel and complete the connection dialog; do not retry blindly.',
  ]
  if (server.remoteRoot !== undefined && server.remoteRoot !== '~') {
    lines.push(`Default working root configured by the user: ${server.remoteRoot}.`)
  }
  return lines.join('\n')
}

/**
 * Wire per-agent context injection and expose the busy check used by RPC.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context (only used for `ctx.on`/`ctx.effect`).
 * @param {{store: import('./store.js').ServerStore, connections: import('./transport.js').ConnectionManager, log?: (message: string) => void}} deps
 * @returns {{isServerBusy: (serverId: string) => boolean, boundSessionCount: (serverId: string) => number}}
 */
export function applyOrchestrator(ctx, deps) {
  const { store, connections } = deps
  const log = deps.log ?? (() => {})

  ctx.effect(() => ctx.on('agent/created', ({ agent }) => {
    try {
      const sessionId = /** @type {string} */ (agent.session.id)
      const scope = agent.ctx
      const systemPrompt = scope.get('systemPrompt')
      if (systemPrompt === undefined) {
        log(`agent ${sessionId}: systemPrompt service unavailable; server context not injected`)
        return
      }
      systemPrompt.context({
        name: CONTEXT_NAME,
        order: 5,
        text: () => targetContextText(store, connections, sessionId),
      })
    } catch (err) {
      // One agent's injection failure must not veto its publication.
      log(`agent context injection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }))

  return {
    /**
     * Whether any session is still bound to the server.
     * @param {string} serverId
     */
    isServerBusy(serverId) {
      return this.boundSessionCount(serverId) > 0
    },
    /**
     * Number of sessions currently bound to the server.
     * @param {string} serverId
     */
    boundSessionCount(serverId) {
      let count = 0
      for (const bound of Object.values(store.state.selectedBySession)) {
        if (bound === serverId) count += 1
      }
      return count
    },
  }
}

/**
 * Client-safe runtime summary of one server (redacted view + busy state).
 * @param {Record<string, unknown>} server
 * @param {{connected: boolean, sessions: number}} runtime
 * @returns {Record<string, unknown>}
 */
export function serverSummary(server, runtime) {
  return { ...publicServer(server, { connected: runtime.connected }), boundSessions: runtime.sessions }
}
