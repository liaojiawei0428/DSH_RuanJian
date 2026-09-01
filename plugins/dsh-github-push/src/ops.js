/**
 * dsh-github-push — high-level repository operations (status probe + push).
 *
 * Each operation is scoped to one binding: the worktree is the bound local
 * path, the remote is derived from the binding's owner/repo via a token-scoped
 * URL that exists only inside the askpass flow (never stored in git config).
 *
 * Safety rules:
 *  - we never `git init` here; a non-repo path is a state the UI surfaces with
 *    a clear message (the user decides whether to init locally).
 *  - push is a plain fast-forward push; a diverged remote fails with GIT_FAILED
 *    and the stderr hints at `git pull --rebase` — we never force.
 */

import { GitError, runGit } from './git.js'

/**
 * Probe one worktree: is it a git repo, current branch, uncommitted changes,
 * and — when a token is available — how far ahead/behind origin it is.
 * @param {string} worktree
 * @param {{owner: string, repo: string, token?: string, branch?: string, proxy?: string}} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function probeRepo(worktree, options = {}) {
  const proxy = options.proxy
  // 1. Is this a git repository at all?
  const isRepo = await runGit(worktree, ['rev-parse', '--is-inside-work-tree'], {})
    .then(() => true)
    .catch(() => false)

  if (!isRepo) {
    return { isRepo: false, branch: undefined, changes: 0, ahead: 0, behind: 0, message: '不是 git 仓库（该目录尚未初始化）' }
  }

  const branch = await runGit(worktree, ['rev-parse', '--abbrev-ref', 'HEAD'], {})
    .then(r => r.stdout.trim())
    .catch(() => '')

  // 2. Uncommitted / staged changes count (porcelain one-line per change).
  const changes = await runGit(worktree, ['status', '--porcelain'], {})
    .then(r => r.stdout.split('\n').filter(l => l.trim() !== '').length)
    .catch(() => 0)

  // 3. Ahead/behind vs the remote branch — only meaningful with a token
  //    (anonymous ls-remote would fail on private repos and probes public
  //    ones without auth; keep it token-gated). We never write `origin/...`
  //    refs: the remote hash is resolved via ls-remote and compared through
  //    merge-base + rev-list.
  const token = options.token
  if (typeof token === 'string' && token !== '' && branch !== '') {
    const remoteHash = await lsRemoteHash(worktree, { owner: options.owner, repo: options.repo, token, branch, proxy })
    if (remoteHash !== undefined) {
      const headHash = await runGit(worktree, ['rev-parse', 'HEAD'], {})
        .then(r => r.stdout.trim())
        .catch(() => undefined)
      if (headHash !== undefined && headHash !== remoteHash) {
        const ahead = await runGit(worktree, ['rev-list', '--count', `${remoteHash}..HEAD`], {})
          .then(r => Number(r.stdout.trim())).catch(() => 0)
        const behind = await runGit(worktree, ['rev-list', '--count', `HEAD..${remoteHash}`], {})
          .then(r => Number(r.stdout.trim())).catch(() => 0)
        return { isRepo: true, branch, changes, ahead, behind }
      }
    }
  }

  return { isRepo: true, branch, changes, ahead: 0, behind: 0 }
}

/**
 * Resolve the remote branch tip with an authenticated ls-remote. Returns the
 * full hash or undefined when the branch does not exist remotely / the token
 * cannot access it. Does not alter local refs.
 * @param {string} worktree
 * @param {{owner: string, repo: string, token: string, branch: string, proxy?: string}} opts
 * @returns {Promise<string | undefined>}
 */
async function lsRemoteHash(worktree, { owner, repo, token, branch, proxy }) {
  const url = plainRemoteUrl(owner, repo)
  const out = await runGit(worktree, ['ls-remote', '--heads', url, `refs/heads/${branch}`], { token, proxy })
    .catch(() => undefined)
  if (out === undefined) return undefined
  const line = out.stdout.split('\n').find(l => l.trim() !== '')
  return line !== undefined ? line.split(/\s+/)[0] : undefined
}

/**
 * Push the bound branch to the GitHub remote. Fast-forward only; a diverged
 * remote rejects with the git stderr attached. `commitMessage` is optional —
 * when omitted and there are changes we commit with a conventional default.
 * @param {string} worktree
 * @param {{owner: string, repo: string, token: string, branch: string, commitMessage?: string, proxy?: string}} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function pushRepo(worktree, opts) {
  const { owner, repo, token, branch, proxy } = opts
  if (typeof token !== 'string' || token === '') {
    throw new GitError('TOKEN_MISSING', '该绑定尚未配置 GitHub Token')
  }

  // 1. Ensure we are in a git repo.
  const isRepo = await runGit(worktree, ['rev-parse', '--is-inside-work-tree'], {})
    .then(() => true)
    .catch(() => false)
  if (!isRepo) throw new GitError('NOT_A_REPO', '目标目录不是 git 仓库，请先在本地 git init')

  // 2. Stage all changes and commit (message optional; default conventional).
  const changes = await runGit(worktree, ['status', '--porcelain'], {})
    .then(r => r.stdout.split('\n').filter(l => l.trim() !== '').length)
    .catch(() => 0)
  if (changes === 0) {
    throw new GitError('NOTHING_TO_PUSH', '没有未提交的改动，无需推送')
  }

  await runGit(worktree, ['add', '-A'], {})
  const message = opts.commitMessage !== undefined && opts.commitMessage.trim() !== ''
    ? opts.commitMessage.trim()
    : 'chore: DSH sync'
  let commitOut = ''
  try {
    commitOut = (await runGit(worktree, ['commit', '-m', message], {})).stdout
  } catch (err) {
    throw new GitError('COMMIT_FAILED', `提交失败：${err instanceof Error ? err.message : String(err)}`, {
      stderr: err instanceof GitError ? (err.details.stderr ?? '') : '',
    })
  }

  // 3. Push with the token via askpass; the plain HTTPS URL is passed as the
  //    push target so no remote is written into .git/config and the token
  //    never appears in argv (askpass answers the credential prompt).
  const url = plainRemoteUrl(owner, repo)
  try {
    const pushOut = await runGit(worktree, ['push', url, `HEAD:refs/heads/${branch}`], { token, proxy })
    return {
      pushed: true,
      commitMessage: message,
      committed: commitOut,
      pushedOutput: pushOut.stdout,
      pushedStderr: pushOut.stderr,
    }
  } catch (err) {
    throw new GitError('PUSH_FAILED', `推送失败：${err instanceof Error ? err.message : String(err)}`, {
      stderr: err instanceof GitError ? (err.details.stderr ?? '') : '',
    })
  }
}

/**
 * Plain HTTPS remote URL (no token inside). Credentials are supplied by the
 * askpass flow so the token never appears in argv, config, or remotes.
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
export function plainRemoteUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}.git`
}