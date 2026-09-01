/**
 * dsh-github-push — Host-half entry (source of truth; esbuild bundles this
 * directory into the deployed product `index.js`).
 *
 * Wiring: GithubStore (bindings + tokens persisted under DSH_HOME) feeds the
 * browser RPC surface (state / binding CRUD / probe / manual push). Every
 * registration is effect-wrapped; the connection service is a hard inject.
 *
 * Dependency stance (PLUGIN-STANDARD P2/P3): only `node:` builtins are
 * imported; `connection` is the injected Cordis service. apply() fails loud on
 * wiring errors (P6); RPC runtime errors surface as typed results.
 */

import { GithubStore } from './store.js'
import { applyRpc, RPC_CHANNEL } from './rpc.js'

export const name = 'github-push'

export const inject = ['connection']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 */
export function apply(ctx) {
  const log = message => ctx.logger.warn(`[github-push] ${message}`)
  const store = new GithubStore({ log })
  // Load is async; orchestrate it as a promise that runs at apply time. The
  // store's read views are safe to touch before load (fresh empty state), and
  // the RPC handlers resolve through the same object, so an early call just
  // sees the empty store until load completes.
  void store.load()

  applyRpc(ctx, { connection: ctx.connection, store, log })

  ctx.logger.info(`[github-push] ready: ${store.listBindings().length} binding(s) stored, rpc channel ${RPC_CHANNEL}`)
}