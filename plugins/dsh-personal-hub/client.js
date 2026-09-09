/**
 * dsh-personal-hub — browser half (personal plugin toolbar host).
 *
 * Owns ONE row below the composer card (`conversation.composer.dock`) and
 * declares the additive child slot `dsh.personal.bar`. Every personal plugin
 * registers its own capsule into that child slot, so all personal controls
 * share a single horizontal, wrapping row — space grows with the row instead
 * of competing with the shipped header buttons.
 *
 * Why a host row: an official list slot renders its entries as direct flex
 * children of the owning container, so several independent registrations
 * stack vertically. This host registers once and lays the child entries out
 * itself with `display:flex; flex-wrap:wrap`, keeping one row that wraps only
 * when the viewport truly runs out of width.
 *
 * This file is a hand-written client bundle in the platform's module-loader
 * format: `window.__ModuleLoader__.load({ id, factory })`, with the factory's
 * `require` resolving platform seed words (react, …).
 *
 * Since DSH 0.1.2 the boot mounts every client plugin's apply concurrently, so
 * the module must declare `inject: ['slots']` — the loader holds our apply
 * until the slots service is provided.
 */
window.__ModuleLoader__.load({
  id: 'dsh-personal-hub',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    /** Official slot that hosts the row below the composer card. */
    const HOST_SLOT = 'conversation.composer.dock'
    /** Additive child slot every personal plugin registers into. */
    const BAR_SLOT = 'dsh.personal.bar'

    const CSS = [
      '.dsph-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: 100%; max-width: var(--dsh-chat-content-width, 100%); margin: 0 auto; padding: 4px calc(var(--dsh-composer-side-clearance, 16px) + 16px) 0; box-sizing: border-box; }',
      '.dsph-bar:empty { display: none; }',
      '.dsph-page { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }',
      '.dsph-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
      '.dsph-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, #0f1115); }',
      '.dsph-sub { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #81858c); }',
      '.dsph-row { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.dsph-btn { display: inline-flex; align-items: center; justify-content: center; height: 28px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); border-radius: 14px; background: transparent; color: var(--dsw-alias-label-primary, #0f1115); font-size: 13px; cursor: pointer; }',
      '.dsph-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,0.06)); }',
      '.dsph-btn:disabled { color: var(--dsw-alias-label-dimmed, rgba(0,0,0,0.25)); cursor: not-allowed; }',
      '.dsph-btn.primary { border-color: transparent; background: var(--dsw-alias-state-success-primary, #22c55e); color: #fff; }',
      '.dsph-note { font-size: 12px; line-height: 18px; padding: 8px 12px; border-radius: 10px; white-space: pre-wrap; word-break: break-word; }',
      '.dsph-note.ok { background: rgba(34,197,94,0.10); color: var(--dsw-alias-state-success-primary, #16a34a); }',
      '.dsph-note.err { background: rgba(239,68,68,0.10); color: var(--dsw-alias-state-danger-primary, #dc2626); }',
      '.dsph-note.info { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(0,0,0,0.03)); color: var(--dsw-alias-label-secondary, #61666b); }',
      '.dsph-list { margin: 0; padding-left: 18px; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-secondary, #61666b); }',
      '.dsph-list li { word-break: break-word; }',
      '.dsph-sec { margin: 8px 0 4px; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary, #61666b); }',
      '.dsph-grid { display: flex; flex-wrap: wrap; gap: 6px; }',
      '.dsph-cell { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1)); border-radius: 12px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary, #0f1115); background: transparent; }',
      '.dsph-cell.off { color: var(--dsw-alias-label-tertiary, #81858c); }',
      '.dsph-cell.haspatch { border-color: var(--dsw-alias-state-success-primary, #22c55e); }',
      '.dsph-cellname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }',
      '.dsph-celltag { flex: none; font-size: 10px; line-height: 14px; padding: 0 6px; border-radius: 7px; background: rgba(34,197,94,0.12); color: var(--dsw-alias-state-success-primary, #16a34a); }',
    ].join('\n')

    /** RPC channel shared with the host half. */
    const RPC_CHANNEL = '/dsh-personal-hub'
    /** Official settings slot hosting one page inside the Plugins section. */
    const SETTINGS_TAB = 'settings.plugins.tab'

    /**
     * One horizontal row for every personal-plugin capsule. `renderSlot` is
     * the standard render share granted by declaring the child slot.
     * @param props - standard slot props (renderSlot face).
     * @returns the row element.
     */
    function PersonalBar(props) {
      return React.createElement(
        'div',
        { className: 'dsph-bar' },
        props.renderSlot(BAR_SLOT, {}),
      )
    }

    /**
     * Personal-layer management page: manifest drift status, one-click
     * reapply, and the raw action log. The host owns every decision; this
     * component only renders its JSON reply.
     * @param props - injected `call` face.
     * @returns the page element.
     */
    function PersonalHubPage(props) {
      const { call } = props
      const [state, setState] = React.useState({ kind: 'loading' })
      const [busy, setBusy] = React.useState(false)

      const refresh = React.useCallback(async () => {
        setBusy(true)
        try {
          const value = await call('status')
          setState({ kind: 'status', value })
        } catch (err) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
        } finally {
          setBusy(false)
        }
      }, [call])

      React.useEffect(() => { void refresh() }, [refresh])

      const runReapply = async () => {
        setBusy(true)
        try {
          const value = await call('reapply')
          setState({ kind: 'reapply', value })
        } catch (err) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
        } finally {
          setBusy(false)
        }
      }

      const children = []
      children.push(React.createElement('div', { className: 'dsph-head', key: 'head' },
        React.createElement('div', null,
          React.createElement('p', { className: 'dsph-title' }, '个人部署层'),
          React.createElement('p', { className: 'dsph-sub' }, '按 personal-hub 清单重建 web profile（依赖、bundles、patch 托管条目）。'),
        ),
        React.createElement('div', { className: 'dsph-row' },
          React.createElement('button', {
            type: 'button', className: 'dsph-btn', disabled: busy, onClick: () => { void refresh() },
          }, busy ? '检查中…' : '重新检查'),
          React.createElement('button', {
            type: 'button', className: 'dsph-btn primary', disabled: busy, onClick: () => { void runReapply() },
          }, busy ? '执行中…' : '一键重建'),
        ),
      ))

      if (state.kind === 'loading') {
        children.push(React.createElement('div', { className: 'dsph-note info', key: 'loading' }, '正在读取清单状态…'))
      } else if (state.kind === 'error') {
        children.push(React.createElement('div', { className: 'dsph-note err', key: 'err' }, '读取失败：' + state.message))
      } else if (state.kind === 'status') {
        const v = state.value
        children.push(React.createElement('div', {
          className: 'dsph-note ' + (v.ok ? 'ok' : 'err'), key: 'status',
        }, v.ok ? '无漂移：' + v.summary : '漂移 ' + v.drift.length + ' 项'))
        if (!v.ok && Array.isArray(v.drift) && v.drift.length > 0) {
          children.push(React.createElement('ul', { className: 'dsph-list', key: 'drift' },
            v.drift.map((item, i) => React.createElement('li', { key: i }, String(item)))))
        }
        // 清单插件列表（status 端点附加返回）
        const pluginRows = []
        if (Array.isArray(v.plugins) && v.plugins.length > 0) {
          pluginRows.push(React.createElement('p', { className: 'dsph-sec', key: 'sec' },
            '清单插件（' + v.plugins.length + '）'))
          pluginRows.push(React.createElement('div', { className: 'dsph-grid', key: 'grid' },
            v.plugins.map((p, i) => React.createElement('div', {
              className: 'dsph-cell' + (p.hasPatch ? ' haspatch' : ''),
              title: p.hasPatch ? '含 patch 覆盖条目' : undefined,
              key: String(p.name) + '-' + i,
            },
              React.createElement('span', { className: 'dsph-cellname' }, String(p.name)),
              p.hasPatch ? React.createElement('span', { className: 'dsph-celltag' }, 'patch') : null,
            ))))
        }
        if (Array.isArray(v.official) && v.official.length > 0) {
          pluginRows.push(React.createElement('p', { className: 'dsph-sec', key: 'sec-official' },
            '官方基底（' + v.official.length + '）'))
          pluginRows.push(React.createElement('div', { className: 'dsph-grid', key: 'grid-official' },
            v.official.map((name, i) => React.createElement('div', { className: 'dsph-cell off', key: 'o' + i },
              React.createElement('span', { className: 'dsph-cellname' }, String(name))))))
        }
        if (Array.isArray(v.extras) && v.extras.length > 0) {
          pluginRows.push(React.createElement('p', { className: 'dsph-sec', key: 'sec-extras' },
            '部署覆盖（' + v.extras.length + '）'))
          pluginRows.push(React.createElement('div', { className: 'dsph-grid', key: 'grid-extras' },
            v.extras.map((e, i) => React.createElement('div', { className: 'dsph-cell off', key: 'x' + i },
              React.createElement('span', { className: 'dsph-cellname' }, String(e.id ?? e.name ?? e))))))
        }
        children.push(...pluginRows)
      } else if (state.kind === 'reapply') {
        const v = state.value
        children.push(React.createElement('div', {
          className: 'dsph-note ' + (v.ok ? 'ok' : 'err'), key: 'result',
        }, v.ok ? '重建完成，重启 DSH 服务后生效。' : '重建失败：' + (v.error ?? '未知错误')))
        if (Array.isArray(v.actions) && v.actions.length > 0) {
          children.push(React.createElement('ul', { className: 'dsph-list', key: 'actions' },
            v.actions.map((item, i) => React.createElement('li', { key: i }, String(item)))))
        }
      }
      return React.createElement('div', { className: 'dsph-page' }, children)
    }

    /**
     * One RPC round trip against the host half. A platform `ok:false` result
     * rejects with the host-provided message so the page can show it.
     * @param endpoint - `status` | `validate` | `reapply`.
     * @returns the host value.
     */
    function makeCall(ctx) {
      return async (endpoint) => {
        const connection = ctx.get('connection')
        if (connection === undefined) throw new Error('连接服务尚未就绪，请稍后重试')
        const result = await connection.rpc.call(RPC_CHANNEL, endpoint, { args: {} })
        if (result.ok === false) {
          throw new Error(result.error?.message ?? '未知错误')
        }
        return result.value
      }
    }

    /** Browser-half entry: register the toolbar row and the settings page. */
    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) {
        console.warn('[dsh-personal-hub] slots service unavailable despite inject declaration; UI not registered')
        return
      }

      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-personal-hub'
      tag.textContent = CSS
      document.head.append(tag)
      ctx.effect(() => () => { tag.remove() }, 'dsh-personal-hub: styles')

      const call = makeCall(ctx)

      slots.inject(HOST_SLOT, () => slots.register({
        name: HOST_SLOT,
        id: 'personal-bar',
        order: 50,
        children: { [BAR_SLOT]: { kind: 'list', scope: 'session' } },
      }, PersonalBar))

      slots.inject(SETTINGS_TAB, () => slots.register({
        name: SETTINGS_TAB,
        id: 'personal-hub',
        order: 30,
        label: '个人部署层',
        inject: () => ({ call }),
      }, PersonalHubPage))
    }

    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
