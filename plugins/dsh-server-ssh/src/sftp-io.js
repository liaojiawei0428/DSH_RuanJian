/**
 * dsh-server-ssh — remote IO primitives over SFTP + exec.
 *
 * File tools (read/write/edit/list) go through SFTP for byte-exact semantics;
 * bulk discovery (glob/grep) shells out to remote find/grep with hard caps so
 * a huge tree cannot flood the transcript. All paths are POSIX-normalized.
 */

import { SshError, looksLikeWindowsPath, resolveRemotePath, shellQuote } from './utils.js'

/** Hard cap for one `ssh_read` payload. */
export const READ_MAX_BYTES = 256 * 1024
/** Hard cap for `ssh_glob` result count. */
export const GLOB_MAX_RESULTS = 200
/** Hard cap for `ssh_grep` output lines. */
export const GREP_MAX_LINES = 100
/** Hard cap for one `ssh_bash` stdout tail window. */
export const BASH_TAIL_BYTES = 64 * 1024

/**
 * Read one remote file (text) enforcing the size cap.
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} path - remote path (absolute or `~`-relative).
 * @param {string} home - remote home for `~` expansion.
 * @returns {Promise<{text: string, truncated: boolean, size: number}>}
 */
export function readFile(sftp, path, home) {
  if (looksLikeWindowsPath(path)) throw new SshError('INVALID_INPUT', `path must be POSIX (got Windows-style: ${path})`)
  const abs = resolveRemotePath(path, home)
  return new Promise((resolve, reject) => {
    sftp.stat(abs, (statErr, stats) => {
      if (statErr !== undefined && statErr !== null) return reject(new SshError('REMOTE_ERROR', `stat failed: ${statErr.message}`, { stage: 'read' }))
      if (stats.isDirectory()) return reject(new SshError('INVALID_INPUT', `${abs} is a directory`, { stage: 'read' }))
      sftp.open(abs, 'r', (openErr, handle) => {
        if (openErr !== undefined && openErr !== null) return reject(new SshError('REMOTE_ERROR', `open failed: ${openErr.message}`, { stage: 'read' }))
        const truncated = stats.size > READ_MAX_BYTES
        const length = truncated ? READ_MAX_BYTES : stats.size
        sftp.read(handle, Buffer.alloc(length), 0, length, 0, (readErr, bytesRead, buffer) => {
          sftp.close(handle, () => {})
          if (readErr !== undefined && readErr !== null) return reject(new SshError('REMOTE_ERROR', `read failed: ${readErr.message}`, { stage: 'read' }))
          resolve({ text: /** @type {Buffer} */ (buffer).subarray(0, bytesRead).toString('utf8'), truncated, size: stats.size })
        })
      })
    })
  })
}

/**
 * Write one remote file atomically: content lands in a sibling tmp file that
 * is POSIX-renamed over the target, so a crash never truncates the original.
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} path - remote target path.
 * @param {string} home - remote home for `~` expansion.
 * @param {string} content - full new file content (utf8).
 * @returns {Promise<{path: string, bytes: number}>}
 */
export async function writeFile(sftp, path, home, content) {
  if (looksLikeWindowsPath(path)) throw new SshError('INVALID_INPUT', `path must be POSIX (got Windows-style: ${path})`)
  const abs = resolveRemotePath(path, home)
  const tmp = `${abs}.dsss-tmp-${process.pid}-${Date.now()}`
  await new Promise((resolve, reject) => {
    sftp.writeFile(tmp, content, 'utf8', (err) => (err !== undefined && err !== null ? reject(new SshError('REMOTE_ERROR', `tmp write failed: ${err.message}`, { stage: 'write' })) : resolve(undefined)))
  })
  try {
    await new Promise((resolve, reject) => {
      sftp.rename(tmp, abs, (err) => {
        if (err !== undefined && err !== null) return reject(new SshError('REMOTE_ERROR', `rename failed: ${err.message}`, { stage: 'write' }))
        resolve(undefined)
      })
    })
  } catch (err) {
    sftp.unlink(tmp, () => {})
    throw err
  }
  return { path: abs, bytes: Buffer.byteLength(content, 'utf8') }
}

/**
 * Remote text edit with unique-match enforcement (parity with local Edit tool):
 * `oldString` must occur exactly once unless `replaceAll` is set.
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} path
 * @param {string} home
 * @param {{oldString: string, newString: string, replaceAll?: boolean}} edit
 * @returns {Promise<{path: string, replacements: number}>}
 */
export async function editFile(sftp, path, home, edit) {
  const { text } = await readFile(sftp, path, home)
  const normalized = text.replace(/\r\n/g, '\n')
  const occurrences = normalized.split(edit.oldString).length - 1
  if (occurrences === 0) {
    throw new SshError('INVALID_INPUT', `oldString not found in ${resolveRemotePath(path, home)}`)
  }
  if (occurrences > 1 && edit.replaceAll !== true) {
    throw new SshError('INVALID_INPUT', `oldString matches ${occurrences} locations in ${resolveRemotePath(path, home)}; provide more context or set replaceAll`)
  }
  const next = edit.replaceAll === true
    ? normalized.split(edit.oldString).join(edit.newString)
    : normalized.replace(edit.oldString, edit.newString)
  await writeFile(sftp, path, home, next)
  return { path: resolveRemotePath(path, home), replacements: edit.replaceAll === true ? occurrences : 1 }
}

/**
 * List one remote directory.
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} path
 * @param {string} home
 * @returns {Promise<Array<{name: string, longname: string, isDirectory: boolean, size: number}>>}
 */
export function listDirectory(sftp, path, home) {
  if (looksLikeWindowsPath(path)) throw new SshError('INVALID_INPUT', `path must be POSIX (got Windows-style: ${path})`)
  const abs = resolveRemotePath(path, home)
  return new Promise((resolve, reject) => {
    sftp.readdir(abs, (err, list) => {
      if (err !== undefined && err !== null) return reject(new SshError('REMOTE_ERROR', `readdir failed: ${err.message}`, { stage: 'list' }))
      resolve(list.map((item) => ({
        name: item.filename,
        longname: item.longname,
        isDirectory: item.attrs.isDirectory() === true,
        size: Number(item.attrs.size),
      })))
    })
  })
}

/**
 * Remote glob through `find` with a result cap. Runs under a login shell, so
 * `~` and globs in base are expanded remotely.
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {import('ssh2').Client} client - ready connection.
 * @param {string} base - directory to search under.
 * @param {string} home - remote home.
 * @param {string} pattern - glob expression for `-path` matching (e.g. `*.log` or a recursive `src` glob).
 * @returns {Promise<{matches: string[], truncated: boolean}>}
 */
export async function remoteGlob(connections, client, base, home, pattern) {
  if (looksLikeWindowsPath(base)) throw new SshError('INVALID_INPUT', `base must be POSIX (got Windows-style: ${base})`)
  const absBase = resolveRemotePath(base, home)
  const findPattern = pattern.includes('/') ? pattern : `*${pattern}*`
  const command = `find ${shellQuote(absBase)} -path ${shellQuote(`${absBase}/${findPattern}`)} 2>/dev/null | head -n ${GLOB_MAX_RESULTS + 1}`
  const result = await connections.exec(client, command, { timeoutMs: 20000 })
  const all = result.stdout.split('\n').filter((line) => line.trim() !== '')
  return { matches: all.slice(0, GLOB_MAX_RESULTS), truncated: all.length > GLOB_MAX_RESULTS }
}

/**
 * Remote grep through `grep -rn` with a line cap.
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {import('ssh2').Client} client
 * @param {string} base - directory to search under.
 * @param {string} home - remote home.
 * @param {string} regex - POSIX extended regular expression.
 * @param {{include?: string}} [options] - `--include` glob filter (e.g. `*.py`).
 * @returns {Promise<{output: string, truncated: boolean, exitCode: number | undefined}>}
 */
export async function remoteGrep(connections, client, base, home, regex, options = {}) {
  if (looksLikeWindowsPath(base)) throw new SshError('INVALID_INPUT', `base must be POSIX (got Windows-style: ${base})`)
  const absBase = resolveRemotePath(base, home)
  const includeClause = options.include !== undefined ? ` --include=${shellQuote(options.include)}` : ''
  const command = `grep -rnE ${shellQuote(regex)}${includeClause} ${shellQuote(absBase)} 2>/dev/null | head -n ${GREP_MAX_LINES + 1}`
  const result = await connections.exec(client, command, { timeoutMs: 20000 })
  const lines = result.stdout.split('\n')
  const body = lines.filter((line) => line.trim() !== '')
  const truncated = body.length > GREP_MAX_LINES
  return { output: body.slice(0, GREP_MAX_LINES).join('\n'), truncated, exitCode: result.code }
}

/**
 * Run one shell command, returning a tail window plus exit code.
 * @param {import('./transport.js').ConnectionManager} connections
 * @param {import('ssh2').Client} client
 * @param {string} command
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{exitCode: number | undefined, stdout: string, stderr: string, timedOut: boolean}>}
 */
export async function remoteBash(connections, client, command, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000
  const result = await connections.exec(client, command, { timeoutMs })
  const stdoutRaw = result.stdout
  const tail = stdoutRaw.length > BASH_TAIL_BYTES ? stdoutRaw.slice(-BASH_TAIL_BYTES) : stdoutRaw
  return {
    exitCode: result.code,
    stdout: tail,
    stderr: result.stderr.length > 8192 ? `${result.stderr.slice(0, 8192)}…` : result.stderr,
    timedOut: result.code === undefined,
  }
}
