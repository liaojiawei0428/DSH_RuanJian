/**
 * dsh-server-ssh — Host-half entry (source of truth; esbuild bundles this
 * directory into the deployed product `index.js`).
 *
 * Wiring: ServerStore (persisted under DSH_HOME) + ConnectionManager (ssh2
 * pool) feed three consumers — the seven `ssh_*` model tools, the per-agent
 * system-prompt context (orchestrator), and the browser RPC surface.
 *
 * Dependency stance (PLUGIN-STANDARD P2/P3): only `node:` builtins are
 * imported; `tools` and `connection` are injected Cordis services. apply()
 * fails loud on wiring errors (P6); tool/RPC runtime errors surface as typed
 * results, never as process faults.
 */

import { ServerStore } from './store.js'
import { ConnectionManager } from './transport.js'
import { createSshTools } from './tools.js'
import { applyRpc, RPC_CHANNEL } from './rpc.js'
import { applyOrchestrator } from './orchestrator.js'

export const name = 'server-ssh'

export const inject = ['tools', 'connection']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 */
export function apply(ctx) {
  const log = message => ctx.logger.warn(`[server-ssh] ${message}`)
  const store = new ServerStore({ log })
  store.load()
  const connections = new ConnectionManager({ log })

  for (const tool of createSshTools({ store, connections })) {
    ctx.effect(() => ctx.tools.register(tool))
  }

  const orchestrator = applyOrchestrator(ctx, { store, connections, log })
  applyRpc(ctx, {
    connection: ctx.connection,
    store,
    connections,
    orchestrator,
    log,
  })

  // Pool + held-password teardown belongs to the plugin fiber.
  ctx.effect(() => () => connections.dispose())

  ctx.logger.info(`[server-ssh] ready: ${store.listServers().length} server(s) stored, rpc channel ${RPC_CHANNEL}`)
}
