/**
 * dsh-server-ssh — the seven model-facing `ssh_*` tools.
 *
 * Registration objects are hand-written in the registry's compiled dialect
 * (this plugin cannot import `defineTool`): parameter roots are plain object
 * schemas whose `required` is a parent-level string array naming existing
 * properties, nested objects declare `additionalProperties: false`, literal
 * values use `const`, and no schema keyword appears beside `oneOf`.
 * A thrown `SshError` inside `execute` is safe: the registry converts it to a
 * model-visible error result and never lets it escape to the process.
 */

import { SshError } from './utils.js'
import {
  READ_MAX_BYTES,
  readFile,
  writeFile,
  editFile,
  listDirectory,
  remoteGlob,
  remoteGrep,
  remoteBash,
} from './sftp-io.js'

/** Hard cap for one `ssh_write` payload (bytes, utf8). */
export const WRITE_MAX_BYTES = 512 * 1024
/** Default timeout for `ssh_bash` when the model omits one. */
export const BASH_DEFAULT_TIMEOUT_MS = 30000
/** Upper bound accepted for `ssh_bash` timeouts. */
export const BASH_MAX_TIMEOUT_MS = 300000

/**
 * Max characters of one output segment (stdout/stderr/file content/grep
 * output) the tool render places into the model-visible text. The complete
 * value always stays on the result card; this cap only protects the model
 * context from unbounded remote output.
 */
export const MODEL_TEXT_CAP = 4000
/** Max entries of one list/glob result the render places into model text. */
export const MODEL_ENTRY_CAP = 30

/**
 * Clip one output segment for the model-visible text, marking the cut.
 * @param {string} text
 * @returns {string}
 */
function capText(text) {
  if (text.length <= MODEL_TEXT_CAP) return text
  return `${text.slice(0, MODEL_TEXT_CAP)}\n…[truncated by model cap; full output on the tool card]`
}

/**
 * Resolve the calling session's bound server and open a connection.
 * @param {import('./store.js').ServerStore} store
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {unknown} exec - tool run context (`exec.agent.session.id` names the caller).
 * @returns {Promise<{server: Record<string, unknown>, client: import('ssh2').Client, serverName: string}>}
 */
async function resolveTarget(store, connections, exec) {
  const agent = /** @type {{agent?: {session?: {id?: string}}} | undefined} */ (exec)?.agent
  const sessionId = agent?.session?.id
  if (typeof sessionId !== 'string' || sessionId === '') {
    throw new SshError('NO_TARGET', 'no calling session; the ssh_* tools only run inside an agent session')
  }
  const serverId = store.getTarget(sessionId)
  if (serverId === undefined) {
    throw new SshError('NO_TARGET', 'this session has no server selected; pick one in the server panel (server selector) first')
  }
  const server = store.getServer(serverId)
  if (server === undefined) {
    throw new SshError('SERVER_NOT_FOUND', 'the bound server no longer exists; pick another in the server panel')
  }
  const client = await connections.connect(server)
  return { server, client, serverName: /** @type {string} */ (server.name) }
}

/**
 * Fetch (and memoize per live connection) the remote login home directory.
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {Record<string, unknown>} server
 * @param {import('ssh2').Client} client
 * @returns {Promise<string>}
 */
async function remoteHome(connections, server, client) {
  const serverId = /** @type {string} */ (server.id)
  const existing = connections.homeCache?.get(serverId)
  if (existing !== undefined) return existing
  const sftpChannel = await connections.sftp(serverId, server)
  const home = await new Promise((resolve, reject) => {
    sftpChannel.realpath('.', (err, resolved) => (err !== undefined && err !== null ? reject(new SshError('REMOTE_ERROR', `realpath failed: ${err.message}`, { stage: 'home' })) : resolve(resolved)))
  })
  connections.homeCache ??= new Map()
  connections.homeCache.set(serverId, home)
  return home
}

/**
 * Require one non-empty string argument.
 * @param {Record<string, unknown>} args
 * @param {string} key
 * @returns {string}
 */
function requireString(args, key) {
  const value = args[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SshError('INVALID_INPUT', `${key} must be a non-empty string`)
  }
  return value
}

/**
 * Optional string argument (`undefined` when absent).
 * @param {Record<string, unknown>} args
 * @param {string} key
 * @returns {string | undefined}
 */
function optionalString(args, key) {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new SshError('INVALID_INPUT', `${key} must be a string`)
  return value
}

/**
 * Optional boolean argument (`undefined` when absent).
 * @param {Record<string, unknown>} args
 * @param {string} key
 * @returns {boolean | undefined}
 */
function optionalBoolean(args, key) {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw new SshError('INVALID_INPUT', `${key} must be a boolean`)
  return value
}

/**
 * Optional bounded integer argument.
 * @param {Record<string, unknown>} args
 * @param {string} key
 * @param {number} min
 * @param {number} max
 * @returns {number | undefined}
 */
function optionalInteger(args, key, min, max) {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new SshError('INVALID_INPUT', `${key} must be an integer in ${min}..${max}`)
  }
  return value
}

/**
 * Build the seven tool definitions bound to shared store/connections.
 * @param {{store: import('./store.js').ServerStore, connections: import('./transport.js').ConnectionManager}} deps
 * @returns {Array<Record<string, unknown>>} registry-ready tool definitions.
 */
export function createSshTools(deps) {
  const { store, connections } = deps

  return [
    {
      name: 'ssh_read',
      description: `Read one text file on the SSH server bound to this session (UTF-8, up to ${READ_MAX_BYTES / 1024}KB; larger files are returned truncated).`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Remote file path; absolute, or `~`-relative against the login home.' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            path: { type: 'string' },
            content: { type: 'string' },
            truncated: { type: 'boolean' },
            size: { type: 'integer' },
          },
          required: ['server', 'path', 'content', 'truncated', 'size'],
        },
        render: (_args, value) => {
          const head = `[${value.server}] read ${value.path}${value.truncated ? ' (truncated)' : ''} (${value.size} bytes)`
          const content = String(value.content ?? '')
          return [{ type: 'text', text: content === '' ? head : `${head}\n${capText(content)}` }]
        },
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const path = requireString(args, 'path')
        const home = await remoteHome(connections, target.server, target.client)
        const sftpChannel = await connections.sftp(/** @type {string} */ (target.server.id), target.server)
        const result = await readFile(sftpChannel, path, home)
        return { server: target.serverName, path, content: result.text, truncated: result.truncated, size: result.size }
      },
    },
    {
      name: 'ssh_write',
      description: `Create or fully replace one text file on the session's SSH server (UTF-8, up to ${WRITE_MAX_BYTES / 1024}KB). Written atomically via a sibling temp file and rename.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Remote target path (POSIX; `~` allowed).' },
          content: { type: 'string', description: 'Full new file content.' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            path: { type: 'string' },
            bytes: { type: 'integer' },
          },
          required: ['server', 'path', 'bytes'],
        },
        render: (_args, value) => [{ type: 'text', text: `[${value.server}] wrote ${value.path} (${value.bytes} bytes)` }],
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const path = requireString(args, 'path')
        const content = requireString(args, 'content')
        if (Buffer.byteLength(content, 'utf8') > WRITE_MAX_BYTES) {
          throw new SshError('INVALID_INPUT', `content exceeds the ${WRITE_MAX_BYTES / 1024}KB ssh_write cap; split into chunks or use ssh_bash`)
        }
        const home = await remoteHome(connections, target.server, target.client)
        const sftpChannel = await connections.sftp(/** @type {string} */ (target.server.id), target.server)
        const result = await writeFile(sftpChannel, path, home, content)
        return { server: target.serverName, path: result.path, bytes: result.bytes }
      },
    },
    {
      name: 'ssh_edit',
      description: `Targeted string replacement in one file on the session's SSH server. The old string must occur exactly once unless replaceAll is true; CRLF files are normalized to LF.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Remote file path (POSIX; `~` allowed).' },
          old_string: { type: 'string', description: 'Exact text to replace.' },
          new_string: { type: 'string', description: 'Replacement text.' },
          replace_all: { type: 'boolean', description: 'Replace every occurrence instead of requiring a unique match.' },
        },
        required: ['path', 'old_string', 'new_string'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            path: { type: 'string' },
            replacements: { type: 'integer' },
          },
          required: ['server', 'path', 'replacements'],
        },
        render: (_args, value) => [{ type: 'text', text: `[${value.server}] edited ${value.path} (${value.replacements} replacement${value.replacements === 1 ? '' : 's'})` }],
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const path = requireString(args, 'path')
        const oldString = requireString(args, 'old_string')
        const newString = optionalString(args, 'new_string') ?? ''
        const replaceAll = optionalBoolean(args, 'replace_all')
        const home = await remoteHome(connections, target.server, target.client)
        const sftpChannel = await connections.sftp(/** @type {string} */ (target.server.id), target.server)
        const result = await editFile(sftpChannel, path, home, { oldString, newString, replaceAll })
        return { server: target.serverName, path: result.path, replacements: result.replacements }
      },
    },
    {
      name: 'ssh_list',
      description: `List one directory on the session's SSH server with names, sizes, and types.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Remote directory path (defaults to the login home).' },
        },
        required: [],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            path: { type: 'string' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  isDirectory: { type: 'boolean' },
                  size: { type: 'integer' },
                },
                required: ['name', 'isDirectory', 'size'],
              },
            },
          },
          required: ['server', 'path', 'entries'],
        },
        render: (_args, value) => {
          const entries = value.entries ?? []
          const head = `[${value.server}] listed ${value.path} (${entries.length} entries)`
          if (entries.length === 0) return [{ type: 'text', text: head }]
          const lines = entries.slice(0, MODEL_ENTRY_CAP).map((entry) => `${entry.isDirectory ? 'd' : '-'} ${entry.name}${entry.isDirectory ? '/' : ` (${entry.size} B)`}`)
          if (entries.length > MODEL_ENTRY_CAP) lines.push(`…[${entries.length - MODEL_ENTRY_CAP} more on the tool card]`)
          return [{ type: 'text', text: `${head}\n${lines.join('\n')}` }]
        },
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const path = optionalString(args, 'path') ?? '~'
        const home = await remoteHome(connections, target.server, target.client)
        const sftpChannel = await connections.sftp(/** @type {string} */ (target.server.id), target.server)
        const entries = await listDirectory(sftpChannel, path, home)
        return {
          server: target.serverName,
          path: path === '~' ? home : path,
          entries: entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory, size: entry.size })),
        }
      },
    },
    {
      name: 'ssh_glob',
      description: 'Find files under a directory on the session\'s SSH server by glob pattern (remote `find`, capped at 200 results).',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob expression matched against paths under base, e.g. `*.log` or `src/**/*.js`.' },
          base: { type: 'string', description: 'Directory to search under (defaults to the login home).' },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            matches: { type: 'array', items: { type: 'string' } },
            truncated: { type: 'boolean' },
          },
          required: ['server', 'matches', 'truncated'],
        },
        render: (_args, value) => {
          const matches = value.matches ?? []
          const head = `[${value.server}] glob found ${matches.length} path${matches.length === 1 ? '' : 's'}${value.truncated ? ' (capped)' : ''}`
          if (matches.length === 0) return [{ type: 'text', text: head }]
          const lines = matches.slice(0, MODEL_ENTRY_CAP)
          if (matches.length > MODEL_ENTRY_CAP) lines.push(`…[${matches.length - MODEL_ENTRY_CAP} more on the tool card]`)
          return [{ type: 'text', text: `${head}\n${lines.join('\n')}` }]
        },
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const pattern = requireString(args, 'pattern')
        const base = optionalString(args, 'base') ?? '~'
        const home = await remoteHome(connections, target.server, target.client)
        const result = await remoteGlob(connections, target.client, base, home, pattern)
        return { server: target.serverName, matches: result.matches, truncated: result.truncated }
      },
    },
    {
      name: 'ssh_grep',
      description: 'Search file contents under a directory on the session\'s SSH server with a POSIX extended regex (remote `grep -rn`, capped at 100 output lines).',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'POSIX extended regular expression.' },
          base: { type: 'string', description: 'Directory to search under (defaults to the login home).' },
          include: { type: 'string', description: 'Filename glob filter, e.g. `*.py`.' },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            output: { type: 'string' },
            truncated: { type: 'boolean' },
            exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }], description: 'grep exit code; null when the command timed out.' },
          },
          required: ['server', 'output', 'truncated', 'exitCode'],
        },
        render: (_args, value) => {
          const head = `[${value.server}] grep exit ${value.exitCode ?? 'timeout'}${value.truncated ? ' (100-line cap hit)' : ''}`
          const output = String(value.output ?? '')
          return [{ type: 'text', text: output === '' ? head : `${head}\n${capText(output)}` }]
        },
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const pattern = requireString(args, 'pattern')
        const base = optionalString(args, 'base') ?? '~'
        const include = optionalString(args, 'include')
        const home = await remoteHome(connections, target.server, target.client)
        const result = await remoteGrep(connections, target.client, base, home, pattern, include === undefined ? {} : { include })
        return { server: target.serverName, output: result.output, truncated: result.truncated, exitCode: result.exitCode ?? null }
      },
    },
    {
      name: 'ssh_bash',
      description: `Run one shell command on the session's SSH server. Stdout is returned as a ${64}KB tail window (model-visible text capped at ${MODEL_TEXT_CAP} chars; the command is killed after the timeout).`,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute (runs through the login shell).' },
          timeout_ms: { type: 'integer', description: `Kill the command after this many milliseconds (default ${BASH_DEFAULT_TIMEOUT_MS}, max ${BASH_MAX_TIMEOUT_MS}).` },
        },
        required: ['command'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            server: { type: 'string' },
            exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
            stdout: { type: 'string' },
            stderr: { type: 'string' },
            timedOut: { type: 'boolean' },
          },
          required: ['server', 'exitCode', 'stdout', 'stderr', 'timedOut'],
        },
        render: (_args, value) => {
          const exit = value.exitCode ?? (value.timedOut ? 'timeout' : 'unknown')
          const parts = [`[${value.server}] bash exit ${exit}`]
          const stdout = String(value.stdout ?? '')
          if (stdout !== '') parts.push(capText(stdout))
          const stderr = String(value.stderr ?? '')
          if (stderr !== '') parts.push(`[stderr]\n${capText(stderr)}`)
          return [{ type: 'text', text: parts.join('\n') }]
        },
      },
      async execute(args, exec) {
        const target = await resolveTarget(store, connections, exec)
        const command = requireString(args, 'command')
        const timeoutMs = optionalInteger(args, 'timeout_ms', 1000, BASH_MAX_TIMEOUT_MS) ?? BASH_DEFAULT_TIMEOUT_MS
        const result = await remoteBash(connections, target.client, command, { timeoutMs })
        return { server: target.serverName, exitCode: result.exitCode ?? null, stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut }
      },
    },
  ]
}
