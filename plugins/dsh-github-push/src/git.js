/**
 * dsh-github-push — git execution wrapper.
 *
 * All git invocations go through `git -C <worktree>` with:
 *  - explicit UTF-8 (GIT_CONFIG_GLOBAL=/dev/null so no user global config
 *    interferes; GIT_TERMINAL_PROMPT=0 so git never blocks on credentials);
 *  - every command's cwd pinned to the bound project path (never the plugin
 *    dir, never the agent workspace);
 *  - PATs supplied through GIT_ASKPASS pointing at a private temp script that
 *    echoes the token — the token never appears in argv (visible in `ps` /
 *    Windows command-line logging) nor in any git config/remote.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Domain error with a machine-readable code for the RPC error envelope. */
export class GitError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, string>} [details]
   */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'GitError'
    this.code = code
    this.details = details
  }
}

/**
 * Create a private GIT_ASKPASS script that answers GitHub credential prompts:
 * "Username:" → `oauth2`, "Password:" → the token. The token travels only via
 * an environment variable; argv stays clean, no git config/remote is touched.
 * Windows: git-for-windows ships `sh`, so a POSIX script works.
 * @param {string} token
 * @returns {Promise<{dir: string, script: string, env: Record<string, string>}>}
 */
async function makeAskpass(token) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-github-askpass-'))
  const script = join(dir, 'askpass.sh')
  const content = [
    '#!/bin/sh',
    'case "$1" in',
    '  *Username*) printf "oauth2\\n";;',
    '  *Password*) printf "%s\\n" "$GITHUB_PUSH_TOKEN";;',
    '  *) exit 0;;',
    'esac',
    '',
  ].join('\n')
  await writeFile(script, content, { encoding: 'utf8', mode: 0o700 })
  return { dir, script, env: { GITHUB_PUSH_TOKEN: token } }
}

/**
 * Run one git command and resolve with { stdout, stderr }. Rejects with
 * GitError carrying the exit code and merged output.
 * @param {string} worktree
 * @param {string[]} args
 * @param {{token?: string, proxy?: string}} [options] - `proxy` overrides the
 *   HTTP(S)_PROXY env for this command (e.g. a per-plugin proxy setting); when
 *   absent the inherited environment (incl. any user shell proxy) is used.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export function runGit(worktree, args, options = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_CONFIG_SYSTEM: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
    }
    if (options.proxy !== undefined && options.proxy !== '') {
      env.HTTP_PROXY = options.proxy
      env.HTTPS_PROXY = options.proxy
      env.http_proxy = options.proxy
      env.https_proxy = options.proxy
    }
    let askpassDir
    const prepare = options.token !== undefined && options.token !== ''
      ? makeAskpass(options.token).then(({ dir, script, env: askEnv }) => {
          askpassDir = dir
          env.GIT_ASKPASS = script
          Object.assign(env, askEnv)
        })
      : Promise.resolve()

    const cleanup = async () => {
      if (askpassDir !== undefined) {
        try { await rm(askpassDir, { recursive: true, force: true }) } catch { /* best effort */ }
      }
    }

    prepare.then(() => {
      const child = spawn('git', ['-C', worktree, ...args], {
        env,
        cwd: process.cwd(),
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8') })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8') })
      child.on('error', (err) => {
        cleanup().then(() => reject(new GitError('GIT_SPAWN', `无法启动 git：${err.message}`)))
      })
      child.on('close', async (code) => {
        await cleanup()
        if (code === 0) resolve({ stdout, stderr, code })
        else reject(new GitError('GIT_FAILED', `git ${args.join(' ')} 失败（exit ${code}）`, { stderr, stdout }))
      })
    }).catch((err) => {
      reject(new GitError('ASKPASS_FAILED', `无法准备凭据脚本：${err.message}`))
    })
  })
}