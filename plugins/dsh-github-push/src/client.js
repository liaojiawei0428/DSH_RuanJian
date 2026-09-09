/**
 * dsh-github-push — browser half (bundled by build.mjs into the ModuleLoader
 * envelope; plain JS, React.createElement only).
 *
 * Contributes one entry to `conversation.session.header.utilities`: a capsule
 * that opens the GitHub project → repo binding manager. All data flows through
 * the package-private RPC channel `/dsh-github-push` using the platform
 * ConnectionRpcResult envelope (`{ ok, value | error{code,message,details} }`);
 * the component never sees ctx — the `call` callback is closed over in apply
 * and delivered via the slot inject face. One idempotent <style> sheet mirrors
 * the official design-platform tokens (same capsule/dialog/Button geometry as
 * dsh-server-ssh) so the UI reads native to the DSH shell. Layout is a single
 * vertical column with no scrolling (reuses the audited alignment rules:
 * min-width:0 chains, box-sizing, uniform item padding).
 */

const React = require('react')
const ReactDOM = require('react-dom')

const SLOT_NAME = 'dsh.personal.bar'
const RPC_CHANNEL = '/dsh-github-push'
const POLL_INTERVAL_MS = 15000

const h = React.createElement
const { useState, useEffect, useCallback } = React
const createPortal = ReactDOM.createPortal

// ---------------------------------------------------------------- styling --

const STYLE_ID = 'dshgp-style'

/**
 * One shared <style> element for every dshgp-* class. Re-inserted after HMR
 * remounts; content is static so a duplicate id replaces itself.
 */
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return
  const sheet = document.createElement('style')
  sheet.id = STYLE_ID
  sheet.textContent = `
/* ---- Header capsule (mirrors ui-primitives HeaderAction capsule) ---- */
.dshgp-cap { display:inline-flex; align-items:center; justify-content:center;
  min-width:0; height:32px; padding:0 14px; gap:6px;
  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.1)); border-radius:18px;
  background:transparent; color:var(--dsw-alias-label-primary,#0f1115);
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif);
  font-size:13px; line-height:20px; cursor:pointer; white-space:nowrap; }
.dshgp-cap:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-cap .dot { width:6px; height:6px; border-radius:50%; corner-shape:round; flex:none;
  background:var(--dsw-alias-label-tertiary,#81858c); }
.dshgp-cap .dot.on { background:var(--dsw-alias-state-success-primary,#22c55e); }

/* ---- Modal (mirrors ui-primitives Modal; elevation-prominent) ---- */
.dshgp-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center;
  justify-content:center; padding:24px; }
.dshgp-mask { position:absolute; inset:0;
  background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,0.24));
  backdrop-filter:var(--dsw-mask-blur,blur(2px)); }
.dshgp-modal { position:relative; z-index:1; display:flex; flex-direction:column;
  width:min(640px,100%);
  border:0; border-radius:24px; background:var(--dsw-alias-bg-layer-2,#fff);
  box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv3,0 0 1px 0 rgba(0,0,0,0.2),0 12px 32px 0 rgba(0,0,0,0.08))); }
.dshgp-head { display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:20px 24px 8px; }
.dshgp-title { margin:0; font-size:16px; line-height:24px; font-weight:500;
  color:var(--dsw-alias-label-primary,#0f1115); }
.dshgp-close { flex:none; display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:28px; border:none; border-radius:8px; background:transparent;
  color:var(--dsw-alias-label-secondary,#61666b); cursor:pointer; font-size:16px; line-height:1; }
.dshgp-close:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-body { display:flex; flex-direction:column; gap:14px;
  padding:8px 24px 24px; min-width:0; }
.dshgp-body > * { min-width:0; }

/* ---- Network settings panel ---- */
.dshgp-bound { display:flex; flex-direction:column; gap:8px; padding:10px 12px;
  border:0.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.1)); border-radius:14px;
  background:var(--dsw-alias-interactive-bg-hover-solid,rgba(0,0,0,0.02)); min-width:0; }
.dshgp-proxy-row { display:flex; align-items:flex-end; gap:8px; min-width:0; }
.dshgp-grow { flex:1 1 0; min-width:0; }

/* ---- Row item (same geometric language as dsh-server-ssh) ---- */
.dshgp-pane-title { margin:0; font-size:13px; line-height:20px; font-weight:600;
  color:var(--dsw-alias-label-secondary,#61666b); }
.dshgp-edit-warn { margin:0; font-size:11px; line-height:16px;
  color:var(--dsw-alias-state-warn-primary,#f59e0b); }
.dshgp-roster { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dshgp-item { display:flex; align-items:center; gap:10px; padding:7px 12px; min-width:0;
  border:1px solid transparent; border-radius:12px; cursor:pointer;
  background:transparent; text-align:left; width:100%; box-sizing:border-box; }
.dshgp-item:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-item.sel { border-color:var(--dsw-alias-border-l2,rgba(0,0,0,0.1));
  background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-dot { width:8px; height:8px; border-radius:50%; corner-shape:round; flex:none;
  background:var(--dsw-alias-label-tertiary,#81858c); }
.dshgp-dot.on { background:var(--dsw-alias-state-success-primary,#22c55e); }
.dshgp-dot.warn { background:var(--dsw-alias-state-warn-primary,#f59e0b); }
.dshgp-grow { flex:1 1 0; min-width:0; }
.dshgp-name { font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary,#0f1115);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgp-meta { margin-top:2px; font-size:11px; color:var(--dsw-alias-label-tertiary,#81858c);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgp-status { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; }
.dshgp-badge { flex:none; font-size:11px; line-height:18px; padding:0 8px; border-radius:9px;
  border:0.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.1));
  color:var(--dsw-alias-label-secondary,#61666b); white-space:nowrap; }
.dshgp-badge.ok { border-color:var(--dsw-alias-state-success-primary,#22c55e);
  color:var(--dsw-alias-state-success-primary,#22c55e); }
.dshgp-badge.warn { border-color:var(--dsw-alias-state-warn-primary,#f59e0b);
  color:var(--dsw-alias-state-warn-label,#b45309); }
.dshgp-badge.err { border-color:var(--dsw-alias-state-error-primary,#ec1313);
  color:var(--dsw-alias-state-error-primary,#ec1313); }
.dshgp-badge.bound { border-color:var(--dsw-alias-state-success-primary,#22c55e);
  color:var(--dsw-alias-state-success-primary,#22c55e); }
.dshgp-item-actions { display:flex; gap:4px; flex:none; flex-wrap:wrap; justify-content:flex-end; }
.dshgp-item-actions .dshgp-btn { min-width:44px; }
.dshgp-empty { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; padding:32px 12px; text-align:center;
  color:var(--dsw-alias-label-tertiary,#81858c); font-size:13px; }
.dshgp-bind-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dshgp-bind-label { flex:none; font-size:11px; line-height:18px;
  color:var(--dsw-alias-label-tertiary,#81858c); }

/* ---- Buttons (mirror ui-primitives Button) ---- */
.dshgp-btn { display:inline-flex; align-items:center; justify-content:center; gap:4px;
  border:none; border-radius:16px; cursor:pointer; font-size:12px; line-height:20px;
  padding:0 12px; height:28px; white-space:nowrap;
  color:var(--dsw-alias-label-primary,#0f1115); background:transparent;
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif); }
.dshgp-btn:disabled { cursor:not-allowed; opacity:0.4; }
.dshgp-btn.primary { background:var(--dsw-alias-button-primary-fill,#0f1115);
  color:var(--dsw-alias-label-primary-foreground,#fff); }
.dshgp-btn.primary:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover,#43454a); }
.dshgp-btn.ghost:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-btn.ghost:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active,rgba(38,49,72,0.1)); }
.dshgp-btn.outline { border:0.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,0.12)); }
.dshgp-btn.outline:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dshgp-btn.danger { color:var(--dsw-alias-state-error-primary,#ec1313); }
.dshgp-btn.tiny { height:22px; padding:0 8px; border-radius:11px; font-size:11px; line-height:18px; }
.dshgp-btn.bound { border:0.5px solid var(--dsw-alias-state-success-primary,#22c55e);
  color:var(--dsw-alias-state-success-primary,#22c55e); }

/* ---- Form ---- */
.dshgp-form { display:flex; flex-direction:column; gap:10px; }
.dshgp-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; }
.dshgp-grid .span2 { grid-column:1 / -1; }
.dshgp-field { display:flex; flex-direction:column; gap:4px; font-size:12px;
  color:var(--dsw-alias-label-secondary,#61666b); min-width:0; }
.dshgp-field input { height:32px; padding:0 10px; font-size:13px;
  border:0.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,0.15)); border-radius:8px; outline:none;
  background:var(--dsw-alias-bg-layer-1,#fff); color:var(--dsw-alias-label-primary,#0f1115);
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif);
  width:100%; box-sizing:border-box; }
.dshgp-field input:focus { border-color:var(--dsw-alias-brand-primary,#0f6bff); }
.dshgp-form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:2px; flex-wrap:wrap; }

/* ---- Notice band ---- */
.dshgp-note { font-size:12px; line-height:18px; border-radius:8px; padding:8px 12px; word-break:break-all; }
.dshgp-note.err { background:var(--dsw-static-red-50,#fef2f2); color:var(--dsw-alias-state-error-primary,#ec1313); }
.dshgp-note.ok { background:var(--dsw-static-green-100,#e6faed); color:var(--dsw-alias-state-success-primary,#16a34a); }
.dshgp-note.info { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06));
  color:var(--dsw-alias-label-secondary,#61666b); }

/* ---- Push confirmation band (same card language as SSH trust band) ---- */
.dshgp-push { display:flex; flex-direction:column; gap:8px; padding:10px 12px;
  border:1px dashed var(--dsw-alias-border-l3,rgba(0,0,0,0.12)); border-radius:12px; }
.dshgp-push-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:500;
  color:var(--dsw-alias-label-primary,#0f1115); min-width:0; }
.dshgp-push-title .dshgp-name { font-size:13px; }
.dshgp-push .dshgp-field input { height:32px; padding:0 10px; font-size:13px;
  border:0.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,0.15)); border-radius:8px; outline:none;
  background:var(--dsw-alias-bg-layer-1,#fff); color:var(--dsw-alias-label-primary,#0f1115);
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif);
  width:100%; box-sizing:border-box; }
.dshgp-push .dshgp-field input:focus { border-color:var(--dsw-alias-brand-primary,#0f6bff); }
.dshgp-push-actions { display:flex; gap:8px; justify-content:flex-end; }
.dshgp-hint { margin:0; font-size:11px; line-height:16px;
  color:var(--dsw-alias-label-tertiary,#81858c); }
.dshgp-hint-row { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
`
  document.head.appendChild(sheet)
}

// ---------------------------------------------------------------- helpers --

/** Friendly Chinese text for known domain error codes. */
const ERROR_TEXT = {
  TOKEN_MISSING: '该绑定尚未配置 GitHub Token',
  NOT_A_REPO: '目标目录不是 git 仓库',
  NOTHING_TO_PUSH: '没有未提交的改动',
  COMMIT_FAILED: '提交失败',
  PUSH_FAILED: '推送失败',
  BINDING_NOT_FOUND: '绑定不存在',
  GIT_FAILED: 'git 命令失败',
  GIT_SPAWN: '无法启动 git',
  BAD_REQUEST: '请求参数错误',
}

/** @param {{code: string, message: string}} err */
function errorText(err) {
  const hint = ERROR_TEXT[err.code]
  return hint !== undefined ? `${hint}：${err.message}` : err.message
}

/** Empty form for a new binding. */
function emptyForm() {
  return { name: '', localPath: '', repoOwner: '', repoName: '', branch: 'main', token: '' }
}

/** Seed the form from a persisted binding (token never round-trips). */
function formOf(binding) {
  return {
    name: binding.name,
    localPath: binding.localPath,
    repoOwner: binding.repoOwner,
    repoName: binding.repoName,
    branch: binding.branch ?? 'main',
    token: '',
  }
}

/** @param {string} owner @param {string} repo */
function repoLabel(owner, repo) {
  return `${owner}/${repo}`
}

/**
 * Status chip label for one binding's probe result.
 * @param {Record<string, unknown>} status
 */
function statusChips(status) {
  if (status === undefined || typeof status !== 'object') return [h('span', { className: 'dshgp-badge' }, '未知')]
  const chips = []
  if (status.isRepo === false) {
    chips.push(h('span', { className: 'dshgp-badge warn' }, '未初始化'))
    return chips
  }
  chips.push(h('span', { className: 'dshgp-badge' }, `分支 ${status.branch ?? '?'}`))
  const changes = Number(status.changes ?? 0)
  if (changes > 0) chips.push(h('span', { className: 'dshgp-badge warn' }, `${changes} 处未提交`))
  const ahead = Number(status.ahead ?? 0)
  const behind = Number(status.behind ?? 0)
  if (ahead > 0) chips.push(h('span', { className: 'dshgp-badge ok' }, `领先 ${ahead}`))
  if (behind > 0) chips.push(h('span', { className: 'dshgp-badge err' }, `落后 ${behind}`))
  if (changes === 0 && ahead === 0 && behind === 0) chips.push(h('span', { className: 'dshgp-badge ok' }, '已同步'))
  return chips
}

// -------------------------------------------------------------- components --

/**
 * Header capsule: opens the GitHub push manager.
 * @param {{sessionId?: string, call: (endpoint: string, args?: object) => Promise<any>}} props
 */
function GhEntry(props) {
  const [open, setOpen] = useState(false)
  const [bound, setBound] = useState(false)
  useEffect(() => {
    ensureStyles()
    let alive = true
    const probe = async () => {
      try {
        const data = await props.call('state')
        if (alive) {
          setBound(data?.selectedBySession?.[props.sessionId] !== undefined)
        }
      } catch { /* keep last state */ }
    }
    void probe()
    const timer = setInterval(probe, POLL_INTERVAL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [props.call, props.sessionId])
  if (props.sessionId === undefined) return null
  return [
    h('button', {
      key: 'btn',
      className: 'dshgp-cap',
      title: 'GitHub 项目推送',
      onClick: () => {
        void (async () => {
          try {
            const data = await props.call('state')
            setBound(data?.selectedBySession?.[props.sessionId] !== undefined)
          } catch { /* keep last state */ }
        })()
        setOpen(true)
      },
    },
      h('span', { className: 'dot' + (bound ? ' on' : '') }),
      'Git 推送'),
    open ? h(GhManager, {
      key: 'panel',
      call: props.call,
      sessionId: props.sessionId,
      onClose: () => setOpen(false),
    }) : null,
  ]
}

/**
 * Modal: binding roster + add/edit form + manual push + session binding.
 * @param {{call: Function, sessionId: string, onClose: () => void}} props
 */
function GhManager(props) {
  const { call, sessionId, onClose } = props
  const [state, setState] = useState(undefined)
  const [notice, setNotice] = useState(undefined)
  const [editing, setEditing] = useState(undefined)
  const [pushing, setPushing] = useState(undefined)
  const [commitMessage, setCommitMessage] = useState('')
  const [proxyInput, setProxyInput] = useState('')
  const [userInput, setUserInput] = useState('')

  const refresh = useCallback(async () => {
    try {
      const data = await call('state')
      setState({ ...data })
      setProxyInput(prev => prev === '' ? (data?.settings?.proxy ?? '') : prev)
      setUserInput(prev => prev === '' ? (data?.settings?.githubUser ?? '') : prev)
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) })
    }
  }, [call])

  useEffect(() => {
    setNotice(undefined)
    void refresh()
    const timer = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  /** Run one mutating endpoint with busy/notice handling. */
  const act = useCallback(async (endpoint, args, done) => {
    try {
      const data = await call(endpoint, args)
      if (done !== undefined) done(data)
      await refresh()
      return data
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) })
      return undefined
    }
  }, [call, refresh])

  const bindings = state?.bindings ?? []
  const boundBinding = bindings.find(b => b.id === state?.selectedBySession?.[sessionId])
  const selectedBindingId = boundBinding !== undefined
    ? /** @type {string} */ (boundBinding.id)
    : state?.selectedBySession?.[sessionId] !== undefined ? 'deleted' : undefined

  return createPortal(
    h('div', { className: 'dshgp-overlay' },
      h('div', { className: 'dshgp-mask', onMouseDown: onClose }),
      h('div', { className: 'dshgp-modal' },
        h('div', { className: 'dshgp-head' },
          h('h3', { className: 'dshgp-title' }, 'GitHub 项目推送'),
          h('button', { className: 'dshgp-close', title: '关闭', onClick: onClose }, '✕'),
        ),
        h('div', { className: 'dshgp-body' },

          notice != null && h('div', { className: `dshgp-note ${notice.kind}` }, notice.text),

          h('div', { className: 'dshgp-bound' },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('p', { className: 'dshgp-pane-title', style: { margin: 0 } }, '当前会话已绑定'),
              h('button', {
                className: 'dshgp-btn tiny ghost', disabled: selectedBindingId === undefined,
                onClick: () => { void act('target.clear', { sessionId }, () => setNotice({ kind: 'ok', text: '已解绑当前会话' })) },
              }, '解绑'),
            ),
            selectedBindingId === undefined
              ? h('div', { className: 'dshgp-empty', style: { padding: '16px 12px' } }, '本会话尚未绑定仓库。点击下方列表行内「绑定」，或在本区块选择绑定。')
              : selectedBindingId === 'deleted'
                ? h('div', { className: 'dshgp-item bound' },
                    h('span', { className: 'dshgp-dot' }),
                    h('span', { className: 'dshgp-grow' },
                      h('div', { className: 'dshgp-name' }, '已绑定的仓库不存在'),
                      h('div', { className: 'dshgp-meta' }, '原绑定已被删除，请重新绑定仓库'),
                    ),
                    h('span', { className: 'dshgp-badge' }, '需重绑'),
                  )
                : h('div', { className: 'dshgp-item bound' },
                    h('span', { className: 'dshgp-dot on' }),
                    h('span', { className: 'dshgp-grow' },
                      h('div', { className: 'dshgp-name' }, boundBinding.name),
                      h('div', { className: 'dshgp-meta' }, repoLabel(boundBinding.repoOwner, boundBinding.repoName) + ' · 本会话默认推送目标'),
                    ),
                    h('span', { className: 'dshgp-badge bound' }, '已绑定'),
                  ),
            bindings.filter(b => b.id !== selectedBindingId).length > 0
              ? h('div', { className: 'dshgp-bind-row' },
                  h('span', { className: 'dshgp-bind-label' }, '绑定到：'),
                  bindings.filter(b => b.id !== selectedBindingId).map(b =>
                    h('button', {
                      key: b.id, className: 'dshgp-btn tiny outline',
                      onClick: () => { void act('target.set', { sessionId, bindingId: b.id }, () => setNotice({ kind: 'ok', text: `已绑定「${b.name}」` })) },
                    }, b.name),
                  ),
                )
              : null,
          ),

          h('div', { className: 'dshgp-bound' },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('p', { className: 'dshgp-pane-title', style: { margin: 0 } }, '全局设置'),
            ),
            h('div', { className: 'dshgp-proxy-row' },
              h('label', { className: 'dshgp-field dshgp-grow' }, '代理地址（GitHub 直连不通时填，如 http://127.0.0.1:7688）',
                h('input', {
                  value: proxyInput,
                  onChange: (e) => setProxyInput(e.target.value),
                  placeholder: 'http://127.0.0.1:7688',
                })),
            ),
            h('div', { className: 'dshgp-proxy-row' },
              h('label', { className: 'dshgp-field dshgp-grow' }, 'GitHub 用户名（新建绑定时自动预填仓库属主）',
                h('input', {
                  value: userInput,
                  onChange: (e) => setUserInput(e.target.value),
                  placeholder: '例如：liaojiawei0428',
                })),
              h('button', {
                className: 'dshgp-btn primary',
                onClick: () => {
                  void act('settings.set', { proxy: proxyInput.trim(), githubUser: userInput.trim() }, () => setNotice({ kind: 'ok', text: '全局设置已保存' }))
                },
              }, '保存'),
            ),
          ),

          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('p', { className: 'dshgp-pane-title', style: { margin: 0 } }, '项目仓库绑定'),
            h('button', {
              className: 'dshgp-btn primary',
              onClick: () => {
                const form = emptyForm()
                if (userInput.trim() !== '') form.repoOwner = userInput.trim()
                setEditing({ id: undefined, form })
              },
            }, '新增绑定'),
          ),
          bindings.length === 0
            ? h('div', { className: 'dshgp-empty' }, '还没有绑定，点击「新增绑定」配置本地项目对应的 GitHub 仓库。')
            : h('div', { className: 'dshgp-roster' },
                bindings.map(b => h('div', {
                  key: b.id,
                  className: 'dshgp-item' + (editing !== undefined && editing.id === b.id ? ' sel' : ''),
                  onClick: () => setEditing({ id: b.id, form: formOf(b) }),
                },
                  h('span', {
                    className: 'dshgp-dot' + (b.status?.isRepo === true ? ' on' : ' warn'),
                  }),
                  h('span', { className: 'dshgp-grow' },
                    h('div', { className: 'dshgp-name' }, b.name),
                    h('div', { className: 'dshgp-meta' },
                      `${b.localPath} → ${repoLabel(b.repoOwner, b.repoName)}`),
                    h('div', { className: 'dshgp-status' }, ...statusChips(b.status)),
                  ),
                  h('div', { className: 'dshgp-item-actions', onClick: (e) => e.stopPropagation() },
                    b.id === selectedBindingId
                      ? h('button', {
                          className: 'dshgp-btn tiny outline bound',
                          onClick: () => { void act('target.clear', { sessionId }, () => setNotice({ kind: 'ok', text: '已解绑当前会话' })) },
                        }, '已绑定 · 解绑')
                      : h('button', {
                          className: 'dshgp-btn tiny outline',
                          onClick: () => { void act('target.set', { sessionId, bindingId: b.id }, () => setNotice({ kind: 'ok', text: `已绑定「${b.name}」` })) },
                        }, '绑定'),
                    h('button', {
                      className: 'dshgp-btn tiny outline', disabled: pushing === b.id,
                      onClick: () => {
                        setPushing(b.id)
                        setCommitMessage('')
                        setNotice({ kind: 'info', text: `「${b.name}」将执行 add → commit → push` })
                      },
                    }, '推送'),
                    h('button', {
                      className: 'dshgp-btn tiny ghost',
                      onClick: () => { void act('binding.probe', { id: b.id }, () => setNotice({ kind: 'ok', text: `「${b.name}」状态已刷新` })) },
                    }, '刷新'),
                    h('button', {
                      className: 'dshgp-btn tiny danger',
                      onClick: () => {
                        if (window.confirm(`删除绑定「${b.name}」？`) !== true) return
                        void act('binding.remove', { id: b.id }, () => setNotice({ kind: 'ok', text: `「${b.name}」已删除` }))
                      },
                    }, '删除'),
                  ),
                )),
              ),

          h('div', { className: 'dshgp-hint-row' },
            h('p', { className: 'dshgp-hint' },
              bindings.length === 0
                ? '配置「新增绑定」将本地项目推送到 GitHub 仓库；Token 存本机、界面不显示。'
                : '点「推送」执行 git add → commit → push；线上仓库被其他人改动时需先本地同步。'),
          ),

          pushing !== undefined && (() => {
            const b = bindings.find(x => x.id === pushing)
            if (b === undefined) return null
            return h('div', { className: 'dshgp-push' },
              h('div', { className: 'dshgp-push-title' },
                h('span', { className: 'dshgp-dot warn' }),
                h('span', { className: 'dshgp-grow' }, `推送「${b.name}」到 ${repoLabel(b.repoOwner, b.repoName)}（分支 ${b.branch}）`),
              ),
              h('label', { className: 'dshgp-field' }, '提交说明（留空用默认）',
                h('input', { value: commitMessage, onChange: (e) => setCommitMessage(e.target.value), placeholder: 'chore: DSH sync' })),
              h('div', { className: 'dshgp-push-actions' },
                h('button', {
                  className: 'dshgp-btn ghost',
                  onClick: () => setPushing(undefined),
                }, '取消'),
                h('button', {
                  className: 'dshgp-btn primary',
                  onClick: () => {
                    const id = pushing
                    void act('push', { id, commitMessage: commitMessage.trim() }, (data) => {
                      setPushing(undefined)
                      setCommitMessage('')
                      setNotice({ kind: 'ok', text: `推送成功：${data.commitMessage}` })
                    })
                  },
                }, '确认推送'),
              ),
            )
          })(),

          editing != null && h(BindingForm, {
            key: editing.id ?? 'new',
            editing,
            onCancel: () => setEditing(undefined),
            onSubmit: (args, message) => {
              void act('binding.upsert', { input: args }, () => {
                setEditing(undefined)
                setNotice({ kind: 'ok', text: message })
              })
            },
            setNotice,
          }),
        ),
      ),
    ),
    document.body,
  )
}

/**
 * Add/edit binding form.
 * @param {{editing: {id?: string, form: Record<string, string>}, onCancel: () => void, onSubmit: (args: Record<string, unknown>, message: string) => void, setNotice: (n: {kind: string, text: string} | undefined) => void}} props
 */
function BindingForm(props) {
  const { editing, onCancel, onSubmit } = props
  const [form, setForm] = useState(editing.form)

  /** @param {string} key @returns {(e: {target: {value: string}}) => void} */
  const set = key => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const argsOf = () => {
    const input = { ...form }
    if (editing.id !== undefined) input.id = editing.id
    if (input.token === '') delete input.token
    return input
  }

  return h('div', { className: 'dshgp-form' },
    h('p', { className: 'dshgp-pane-title' }, editing.id === undefined ? '新增绑定' : `编辑「${editing.form.name}」`),
    editing.id !== undefined && h('p', { className: 'dshgp-edit-warn' },
      '正在编辑已有绑定，保存将更新此记录（不会新建）'),
    h('div', { className: 'dshgp-grid' },
      h('label', { className: 'dshgp-field' }, '绑定名称',
        h('input', { value: form.name, onChange: set('name'), placeholder: '例如：DSH-ops' })),
      h('label', { className: 'dshgp-field' }, '本地项目路径',
        h('input', { value: form.localPath, onChange: set('localPath'), placeholder: 'E:/DSH/DSH-ops' })),
      h('label', { className: 'dshgp-field' }, 'GitHub 用户名 / 组织',
        h('input', { value: form.repoOwner, onChange: set('repoOwner'), placeholder: 'owner' })),
      h('label', { className: 'dshgp-field' }, '仓库名',
        h('input', { value: form.repoName, onChange: set('repoName'), placeholder: 'repo' })),
      h('label', { className: 'dshgp-field' }, '目标分支',
        h('input', { value: form.branch, onChange: set('branch'), placeholder: 'main' })),
      h('label', { className: 'dshgp-field' }, 'GitHub Token（留空不改）',
        h('input', { type: 'password', value: form.token, onChange: set('token'), placeholder: 'ghp_… / github_pat_…' })),
    ),
    h('div', { className: 'dshgp-form-actions' },
      h('button', {
        className: 'dshgp-btn primary',
        onClick: () => onSubmit(argsOf(), editing.id === undefined ? '绑定已保存' : '绑定已更新'),
      }, editing.id === undefined ? '保存' : '保存更改'),
      h('button', { className: 'dshgp-btn ghost', onClick: onCancel }, '取消'),
    ),
  )
}

// ------------------------------------------------------------------- apply --

export const inject = ['slots']

/**
 * Client plugin body: register the header-utilities entry once the
 * conversation package declares the slot.
 * @param {object} ctx - client root context (slots + optional connection).
 */
export function apply(ctx) {
  /**
   * One RPC round trip; a platform `ok:false` result rejects with `.code`.
   * @param {string} endpoint
   * @param {Record<string, unknown>} [args]
   */
  const call = async (endpoint, args) => {
    const connection = ctx.get('connection')
    if (connection === undefined) throw new Error('连接服务尚未就绪，请稍后重试')
    const result = await connection.rpc.call(RPC_CHANNEL, endpoint, { args: args ?? {} })
    if (result.ok === false) {
      const failure = result.error ?? { code: 'INTERNAL', message: '未知错误', details: {} }
      const err = new Error(failure.message)
      err.code = failure.code
      const details = failure.details
      if (details !== null && typeof details === 'object') {
        if (typeof details.stderr === 'string') err.stderr = details.stderr
      }
      throw err
    }
    return result.value
  }

  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register({
    name: SLOT_NAME,
    id: 'github-push',
    order: 40,
    inject: () => ({ call }),
  }, GhEntry))
}