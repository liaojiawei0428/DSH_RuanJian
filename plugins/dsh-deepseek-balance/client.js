/**
 * dsh-deepseek-balance — browser half (client bundle).
 *
 * Registers the balance capsule into the personal plugin toolbar row
 * (`dsh.personal.bar`, the wrapping row hosted by dsh-personal-hub below the
 * composer card, separate from the shipped header buttons) and fetches the
 * Host route `/api/dsh/deepseek-balance` for the balance data.
 *
 * This file is a hand-written client bundle in the platform's module-loader
 * format: `window.__ModuleLoader__.load({ id, factory })`, with the factory's
 * `require` resolving platform seed words (react, @deepseek-ai/cordis, …).
 *
 * Since DSH 0.1.2 the boot mounts every client plugin's apply concurrently, so
 * the module must declare `inject: ['slots']` — the loader holds our apply
 * until the slots service is provided. Without the declaration our apply ran
 * before slots existed and `ctx.get('slots')` returned undefined (silently
 * dropping both capsules).
 */
window.__ModuleLoader__.load({
  id: 'dsh-deepseek-balance',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const CSS = [
      '.dsbal-hdr { display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 6px 12px; gap: 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px; color: var(--dsw-alias-label-primary); background: transparent; font-family: var(--dsw-font-family); font-size: 13px; font-weight: 400; line-height: 20px; cursor: pointer; white-space: nowrap; }',
      '.dsbal-hdr:hover { background: var(--dsw-alias-interactive-bg-hover); }',
      '.dsbal-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--dsw-static-deepseek-450); flex: none; }',
      '.dsbal-amount { font-weight: 600; }',
      '.dsbal-low .dsbal-amount { color: var(--dsw-alias-state-warn-label); }',
      '.dsbal-muted { color: var(--dsw-alias-label-dimmed); }',
      '.dsbal-err { color: var(--dsw-alias-state-error-secondary); }',
      '.dsbal-update { border-color: var(--dsw-alias-state-warn-label); color: var(--dsw-alias-state-warn-label); font-weight: 600; animation: dsbal-pulse 2s ease-in-out infinite; }',
      '@keyframes dsbal-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }',
    ].join('\n')

    /** Map the API currency code to a display symbol. */
    function symbol(currency) {
      if (currency === 'CNY') return '¥'
      if (currency === 'USD') return '$'
      return ''
    }

    /** Query the Host route; resolves the parsed JSON payload. */
    function fetchBalance() {
      return window.fetch('/api/dsh/deepseek-balance', { headers: { accept: 'application/json' } })
        .then((res) => res.json())
        .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }))
    }

    /** Auto-refresh cadence: 5 minutes, silent (no loading flicker). */
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000

    /** The header utilities capsule next to the Session log export button. */
    function BalanceHeader() {
      const [state, setState] = React.useState({ status: 'loading' })

      const load = (force) => {
        if (force !== true) setState({ status: 'loading' })
        fetchBalance().then((res) => {
          if (res && res.ok === true && res.balance) {
            setState({ status: 'ok', balance: res.balance })
          } else {
            setState({ status: 'error', message: res && res.error ? res.error : '未知错误' })
          }
        })
      }

      React.useEffect(() => {
        load(false)
        const timer = setInterval(() => { load(true) }, REFRESH_INTERVAL_MS)
        return () => clearInterval(timer)
      }, [])

      let cls = 'dsbal-hdr'
      let inner = null
      let title = 'DeepSeek 余额（点击刷新）'

      if (state.status === 'loading') {
        inner = React.createElement('span', { className: 'dsbal-muted' }, '余额 …')
        title = '正在查询 DeepSeek 余额'
      } else if (state.status === 'error') {
        cls += ' dsbal-err'
        inner = React.createElement('span', null, '余额查询失败')
        title = 'DeepSeek 余额查询失败：' + state.message
      } else {
        const b = state.balance
        const sym = symbol(b.currency)
        const totalNum = Number(b.total)
        if (Number.isFinite(totalNum) && totalNum <= 10) cls += ' dsbal-low'
        title = 'DeepSeek 余额（点击刷新）\n总额: ' + sym + b.total + '\n赠送: ' + sym + b.granted + '\n充值: ' + sym + b.toppedUp + '\n状态: ' + (b.isAvailable ? '可用' : '不可用')
        inner = [
          React.createElement('span', { className: 'dsbal-dot', key: 'dot' }),
          React.createElement('span', { key: 'label' }, '余额 '),
          React.createElement('span', { className: 'dsbal-amount', key: 'amount' }, sym + b.total),
        ]
      }

      return React.createElement('button', {
        type: 'button',
        className: cls,
        title,
        onClick: () => { load(true) },
      }, inner)
    }

    /** Poll interval for the repo-status route (host enforces the real check cadence). */
    const REPO_STATUS_INTERVAL_MS = 5 * 60 * 1000

    /** Query the Host repo-status route; resolves the parsed JSON payload. */
    function fetchRepoStatus(force) {
      return window.fetch('/api/dsh/repo-status' + (force ? '?force=1' : ''), { headers: { accept: 'application/json' } })
        .then((res) => res.json())
        .catch((err) => ({ checkError: String(err && err.message ? err.message : err) }))
    }

    /** Trigger the detached updater via the Host route. */
    function triggerUpdate() {
      return window.fetch('/api/dsh/update-now', { method: 'POST', headers: { accept: 'application/json' } })
        .then((res) => res.json())
        .catch((err) => ({ ok: false, error: String(err && err.message ? err.message : err) }))
    }

    /** The version capsule next to the balance capsule: DSH version + update prompt. */
    function VersionHeader() {
      const [state, setState] = React.useState({ status: 'loading' })

      const check = (force) => {
        if (force !== true) setState({ status: 'loading' })
        fetchRepoStatus(force).then((res) => {
          if (res && typeof res.version === 'string') {
            setState({
              status: 'ok',
              version: res.version,
              hasUpdate: res.hasUpdate === true,
              latest: res.latest,
              current: res.current,
              checkError: res.checkError,
            })
          } else {
            setState({ status: 'error', message: res && res.error ? res.error : '未知错误' })
          }
        })
      }

      React.useEffect(() => {
        check(false)
        const timer = setInterval(() => { check(true) }, REPO_STATUS_INTERVAL_MS)
        return () => clearInterval(timer)
      }, [])

      const [updating, setUpdating] = React.useState(false)

      const onClick = () => {
        if (updating) return
        if (state.status === 'ok' && state.hasUpdate) {
          setUpdating(true)
          triggerUpdate().then((res) => {
            if (res && res.ok === true) {
              setState({ status: 'updating' })
            } else {
              setUpdating(false)
              setState({ status: 'error', message: res && res.error ? res.error : '更新启动失败' })
            }
          })
        } else {
          check(true)
        }
      }

      let cls = 'dsbal-hdr'
      let inner = null
      let title = 'DSH 版本（点击检查更新）'

      if (state.status === 'loading') {
        inner = React.createElement('span', { className: 'dsbal-muted' }, 'DSH版本号：…')
        title = '正在检查 DSH 版本'
      } else if (state.status === 'updating') {
        inner = React.createElement('span', null, '正在更新…')
        title = '自动更新已启动：已弹出更新终端窗口，git 拉取/依赖安装/构建进度都在该窗口中显示；完成后服务自动重启，刷新页面即见新版'
      } else if (state.status === 'error') {
        cls += ' dsbal-err'
        inner = React.createElement('span', null, '版本检查失败')
        title = 'DSH 版本检查失败：' + state.message
      } else if (state.hasUpdate) {
        cls += ' dsbal-update'
        inner = React.createElement('span', null, '有新版本')
        title = '有新版本（' + state.latest + '），点击立即自动更新'
      } else {
        inner = React.createElement('span', null, 'DSH版本号：' + state.version)
        title = 'DSH ' + state.version + '（已是最新，点击立即检查）\n本地提交: ' + state.current
          + (state.latest ? '\n官方最新: ' + state.latest : '')
          + (state.checkError ? '\n检查异常: ' + state.checkError : '')
      }

      return React.createElement('button', {
        type: 'button',
        className: cls,
        title,
        onClick,
      }, inner)
    }

    /** Browser-half entry: register the capsules into the header utilities row. */
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) {
        console.warn('[dsh-deepseek-balance] slots service unavailable despite inject declaration; capsules not registered')
        return
      }

      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-deepseek-balance'
      tag.textContent = CSS
      document.head.append(tag)
      ctx.effect(() => () => { tag.remove() }, 'dsh-deepseek-balance: styles')

      slots.inject('dsh.personal.bar', () => slots.register(
        { name: 'dsh.personal.bar', id: 'deepseek-balance', order: 100, label: 'DeepSeek 余额' },
        BalanceHeader,
      ))
      slots.inject('dsh.personal.bar', () => slots.register(
        { name: 'dsh.personal.bar', id: 'deepseek-balance-version', order: 101, label: 'DSH 版本' },
        VersionHeader,
      ))
    }

    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
