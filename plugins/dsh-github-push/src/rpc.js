/**
 * dsh-github-push — package-private Client→Host JSON RPC surface.
 *
 * One dedicated channel (`/dsh-github-push`); the endpoint segment selects
 * the operation. Responses use the platform ConnectionRpcResult envelope the
 * connection service already imposes on every handler return value:
 * `{ ok: true, value }` or `{ ok: false, error: { code, message, details } }`.
 * Domain failures ride the `ok: false` branch — the browser half rejects its
 * `rpc.call` promise with a typed `.code` — and `details` is always an object
 * (the client response parser rejects a missing one). Only lossless JSON
 * crosses the boundary; tokens never leave the host.
 */

import { GitError } from './git.js'
import { probeRepo, pushRepo } from './ops.js'
import { publicBinding } from './store.js'

/** RPC channel registered on the host connection service. */
export const RPC_CHANNEL = '/dsh-github-push'

/**
 * Normalize one thrown error into the platform error payload.
 * @param {unknown} err
 * @returns {{code: string, message: string, details: Record<string, string>}}
 */
export function toErrorPayload(err) {
  if (err instanceof GitError) {
    /** @type {Record<string, string>} */
    const details = {}
    if (typeof err.details.stderr === 'string' && err.details.stderr !== '') details.stderr = err.details.stderr
    return { code: err.code, message: err.message, details }
  }
  const message = err instanceof Error ? err.message : String(err)
  return { code: 'INTERNAL', message, details: {} }
}

/**
 * Wire the RPC endpoints onto the connection service.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {{connection: {rpc: {handle: (channel: string, handler: (endpoint: string, payload: unknown) => Promise<{ok: boolean, value?: unknown, error?: {code: string, message: string, details?: Record<string, string>}}> ) => () => void}}, store: import('./store.js').GithubStore, log?: (message: string) => void}} deps
 */
export function applyRpc(ctx, deps) {
  const { connection, store } = deps
  const log = deps.log ?? (() => {})

  ctx.effect(() => connection.rpc.handle(RPC_CHANNEL, async (endpoint, payload) => {
    /** @type {Record<string, unknown>} */
    const args = (payload !== null && typeof payload === 'object' && 'args' in payload
      ? /** @type {{args: Record<string, unknown>}} */ (payload).args
      : {}) ?? {}
    try {
      return { ok: true, value: await dispatch(endpoint, args) }
    } catch (err) {
      const error = toErrorPayload(err)
      if (error.code === 'INTERNAL') log(`rpc ${endpoint} internal error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
      return { ok: false, error }
    }
  }))

  /**
   * Endpoint dispatch. Throws GitError (or plain Error) for domain failures.
   * @param {string} endpoint
   * @param {Record<string, unknown>} args
   */
  async function dispatch(endpoint, args) {
    switch (endpoint) {
      case 'state': return stateSnapshot()
      case 'binding.upsert': return upsertBinding(args)
      case 'binding.remove': return removeBinding(args)
      case 'binding.probe': return probeBinding(args)
      case 'push': return push(args)
      case 'settings.get': return getSettings()
      case 'settings.set': return setSettings(args)
      case 'target.set': return setTarget(args)
      case 'target.clear': return clearTarget(args)
      default: throw new GitError('BAD_REQUEST', `unknown endpoint: ${endpoint}`)
    }
  }

  /** Resolve the effective proxy URL (plugin setting, else shell env). */
  function proxyFor() {
    const setting = store.getSetting('proxy')
    if (setting !== undefined && setting !== '') return setting
    if (process.env.HTTPS_PROXY !== undefined && process.env.HTTPS_PROXY !== '') return process.env.HTTPS_PROXY
    if (process.env.HTTP_PROXY !== undefined && process.env.HTTP_PROXY !== '') return process.env.HTTP_PROXY
    return undefined
  }

  /** @returns {Record<string, unknown>} */
  function getSettings() {
    return { proxy: store.getSetting('proxy') ?? '', githubUser: store.getGithubUser() }
  }

  /**
   * @param {Record<string, unknown>} args
   */
  function setSettings(args) {
    if (typeof args.proxy === 'string') store.setSetting('proxy', args.proxy.trim())
    if (typeof args.githubUser === 'string') store.setSetting('githubUser', args.githubUser.trim())
    return getSettings()
  }

  /**
   * Bind one binding to a session (the session's default push target).
   * @param {Record<string, unknown>} args
   */
  async function setTarget(args) {
    const sessionId = typeof args.sessionId === 'string' && args.sessionId !== '' ? args.sessionId : ''
    const bindingId = typeof args.bindingId === 'string' ? args.bindingId : ''
    if (sessionId === '') throw new GitError('BAD_REQUEST', 'sessionId is required')
    if (bindingId === '') throw new GitError('BAD_REQUEST', 'bindingId is required')
    if (store.getBinding(bindingId) === undefined) throw new GitError('BINDING_NOT_FOUND', `no binding with id ${bindingId}`)
    store.setTarget(sessionId, bindingId)
    return { bound: bindingId }
  }

  /**
   * Unbind the current session.
   * @param {Record<string, unknown>} args
   */
  function clearTarget(args) {
    const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
    if (sessionId === '') throw new GitError('BAD_REQUEST', 'sessionId is required')
    store.setTarget(sessionId, undefined)
    return { bound: undefined }
  }

  /**
   * Full client state snapshot: bindings plus a live probe of each (repo
   * state + ahead/behind when a token is present). Never includes tokens.
   * @returns {Promise<Record<string, unknown>>}
   */
  async function stateSnapshot() {
    const bindings = store.listBindings()
    const proxy = proxyFor()
    const probed = []
    for (const binding of bindings) {
      const id = /** @type {string} */ (binding.id)
      const token = store.getToken(id)
      const status = await probeRepo(/** @type {string} */ (binding.localPath), {
        owner: /** @type {string} */ (binding.repoOwner),
        repo: /** @type {string} */ (binding.repoName),
        token,
        branch: /** @type {string} */ (binding.branch),
        proxy,
      })
      probed.push(publicBinding(binding, { status, hasToken: token !== undefined }))
    }
    return { bindings: probed, settings: getSettings(), selectedBySession: { ...store.getTargets() } }
  }

  /**
   * Create (no id) or update (with id) one binding. Creating NEVER reuses an
   * id, so a new binding can never overwrite an existing one; updating targets
   * exactly the given id and errors when that binding is gone. The token arg is
   * written to credentials on create or update.
   * @param {Record<string, unknown>} args
   */
  async function upsertBinding(args) {
    const input = /** @type {Record<string, unknown>} */ (args.input ?? {})
    const id = typeof input.id === 'string' && input.id !== '' ? input.id : undefined
    for (const field of ['name', 'localPath', 'repoOwner', 'repoName', 'branch']) {
      if (typeof input[field] !== 'string' || input[field] === '') {
        throw new GitError('BAD_REQUEST', `${field} 不能为空`)
      }
    }
    const fields = {
      name: input.name,
      localPath: input.localPath,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      branch: /** @type {string} */ (input.branch ?? 'main'),
    }
    let record
    if (id === undefined) {
      record = store.createBinding(fields)
    } else {
      record = store.updateBinding(id, fields) // throws when the id is gone
    }
    const token = typeof input.token === 'string' && input.token !== '' ? input.token : undefined
    if (token !== undefined) store.setToken(/** @type {string} */ (record.id), token)
    return { binding: publicBinding(record) }
  }

  /**
   * @param {Record<string, unknown>} args
   */
  async function removeBinding(args) {
    const id = typeof args.id === 'string' ? args.id : ''
    if (id === '') throw new GitError('BAD_REQUEST', 'id is required')
    const removed = store.removeBinding(id)
    return { removed }
  }

  /**
   * Refresh just one binding's repo state (no token round-trip needed on the
   * wire — the host reads the stored token itself).
   * @param {Record<string, unknown>} args
   */
  async function probeBinding(args) {
    const id = typeof args.id === 'string' ? args.id : ''
    const binding = store.getBinding(id)
    if (binding === undefined) throw new GitError('BINDING_NOT_FOUND', `no binding with id ${id}`)
    const token = store.getToken(id)
    const status = await probeRepo(/** @type {string} */ (binding.localPath), {
      owner: /** @type {string} */ (binding.repoOwner),
      repo: /** @type {string} */ (binding.repoName),
      token,
      branch: /** @type {string} */ (binding.branch),
      proxy: proxyFor(),
    })
    return { binding: publicBinding(binding, { status, hasToken: token !== undefined }) }
  }

  /**
   * Manual push of one binding: stage → commit → push.
   * @param {Record<string, unknown>} args
   */
  async function push(args) {
    const id = typeof args.id === 'string' ? args.id : ''
    const binding = store.getBinding(id)
    if (binding === undefined) throw new GitError('BINDING_NOT_FOUND', `no binding with id ${id}`)
    const token = store.getToken(id)
    if (token === undefined) throw new GitError('TOKEN_MISSING', '该绑定尚未配置 GitHub Token')
    const result = await pushRepo(/** @type {string} */ (binding.localPath), {
      owner: /** @type {string} */ (binding.repoOwner),
      repo: /** @type {string} */ (binding.repoName),
      token,
      branch: /** @type {string} */ (binding.branch),
      commitMessage: typeof args.commitMessage === 'string' ? args.commitMessage : undefined,
      proxy: proxyFor(),
    })
    return result
  }
}