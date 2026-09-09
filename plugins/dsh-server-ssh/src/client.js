/**
 * dsh-server-ssh — browser half (bundled by build.mjs into the ModuleLoader
 * envelope; plain JS, React.createElement only).
 *
 * Contributes one entry to `conversation.session.header.utilities`: a capsule
 * that opens the SSH server manager modal. All server data flows through the
 * package-private RPC channel `/dsh-server-ssh` using the platform
 * ConnectionRpcResult envelope (`{ ok, value | error{code,message,details} }`);
 * the component never sees ctx — the `call` callback is closed over in apply
 * and delivered via the slot inject face. One idempotent <style> sheet mirrors
 * the official design-platform tokens (`--dsw-alias-*`) and geometry
 * (capsule r18/h32, dialog r24/layer-2/shadow-lv3, Button primary/ghost) so
 * the UI reads as native to the DSH shell; literal fallbacks keep the sheet
 * safe when a token is absent.
 */

const React = require('react')
const ReactDOM = require('react-dom')

const SLOT_NAME = 'dsh.personal.bar'
const RPC_CHANNEL = '/dsh-server-ssh'
const POLL_INTERVAL_MS = 5000

const h = React.createElement
const { useState, useEffect, useCallback } = React
const createPortal = ReactDOM.createPortal

// ---------------------------------------------------------------- styling --

const STYLE_ID = 'dsss-style'

/**
 * One shared <style> element for every dsss-* class. Re-inserted after HMR
 * remounts; content is static so a duplicate id replaces itself.
 * Tokens follow packages/client/ui-theme/src/styles/design-platform.css and
 * the Modal/Button/HeaderAction primitives.
 */
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return
  const sheet = document.createElement('style')
  sheet.id = STYLE_ID
  sheet.textContent = `
/* ---- Header capsule (mirrors ui-primitives HeaderAction capsule) ---- */
.dsss-cap { display:inline-flex; align-items:center; justify-content:center;
  min-width:0; height:32px; padding:0 14px; gap:6px;
  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.1)); border-radius:18px;
  background:transparent; color:var(--dsw-alias-label-primary,#0f1115);
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif);
  font-size:13px; line-height:20px; cursor:pointer; white-space:nowrap; }
.dsss-cap:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-cap:disabled { color:var(--dsw-alias-label-dimmed,rgba(0,0,0,0.25)); cursor:not-allowed; }
.dsss-cap .dot { width:6px; height:6px; border-radius:50%; corner-shape:round; flex:none;
  background:var(--dsw-alias-label-tertiary,#81858c); }
.dsss-cap .dot.on { background:var(--dsw-alias-state-success-primary,#22c55e); }

/* ---- Modal (mirrors ui-primitives Modal; elevation-prominent) ---- */
.dsss-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center;
  justify-content:center; padding:24px; }
.dsss-mask { position:absolute; inset:0;
  background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,0.24));
  backdrop-filter:var(--dsw-mask-blur,blur(2px)); }
.dsss-modal { position:relative; z-index:1; display:flex; flex-direction:column;
  width:min(640px,100%);
  border:0; border-radius:24px; background:var(--dsw-alias-bg-layer-2,#fff);
  box-shadow:var(--dsw-elevation-prominent,var(--dsw-shadow-lv3,0 0 1px 0 rgba(0,0,0,0.2),0 12px 32px 0 rgba(0,0,0,0.08))); }
.dsss-head { display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:20px 24px 8px; }
.dsss-title { margin:0; font-size:16px; line-height:24px; font-weight:500;
  color:var(--dsw-alias-label-primary,#0f1115); }
.dsss-close { flex:none; display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:28px; border:none; border-radius:8px; background:transparent;
  color:var(--dsw-alias-label-secondary,#61666b); cursor:pointer; font-size:16px; line-height:1; }
.dsss-close:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-body { display:flex; flex-direction:column; gap:14px;
  padding:8px 24px 24px; min-width:0; }
.dsss-body > * { min-width:0; }

/* ---- Server roster ---- */
.dsss-pane-title { margin:0; font-size:13px; line-height:20px; font-weight:600;
  color:var(--dsw-alias-label-secondary,#61666b); }
.dsss-roster { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dsss-item { display:flex; align-items:center; gap:10px; padding:7px 12px; min-width:0;
  border:1px solid transparent; border-radius:12px; cursor:pointer;
  background:transparent; text-align:left; width:100%; box-sizing:border-box; }
.dsss-item:hover { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-item.sel { border-color:var(--dsw-alias-border-l2,rgba(0,0,0,0.1));
  background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-item .dot { width:8px; height:8px; border-radius:50%; corner-shape:round; flex:none;
  background:var(--dsw-alias-label-tertiary,#81858c); }
.dsss-item .dot.on { background:var(--dsw-alias-state-success-primary,#22c55e); }
.dsss-item-actions { display:flex; gap:4px; flex:none; }
.dsss-item-actions .dsss-btn { min-width:44px; }
.dsss-item-grow { flex:1 1 0; min-width:0; }
.dsss-item-name { font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary,#0f1115);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsss-item-meta { font-size:11px; color:var(--dsw-alias-label-tertiary,#81858c);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsss-empty { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; padding:32px 12px; text-align:center;
  color:var(--dsw-alias-label-tertiary,#81858c); font-size:13px; }
.dsss-empty .primary { margin-top:2px; }

/* ---- Session-bound panel ---- */
/* Shares the roster item geometry (dot/name/meta/actions) for column
   alignment; only the container differs (bordered card + bind-row). */
.dsss-bound { display:flex; flex-direction:column; gap:8px; padding:10px 12px;
  border:0.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.1)); border-radius:14px;
  background:var(--dsw-alias-interactive-bg-hover-solid,rgba(0,0,0,0.02)); min-width:0; }
.dsss-bound .dsss-item { padding:7px 12px; border-color:var(--dsw-alias-border-l1,rgba(0,0,0,0.04));
  cursor:default; }
.dsss-bound .dsss-item:hover { background:transparent; }
.dsss-badge { flex:none; font-size:11px; line-height:18px; padding:0 8px; border-radius:9px;
  border:0.5px solid var(--dsw-alias-state-success-primary,#22c55e);
  color:var(--dsw-alias-state-success-primary,#22c55e); white-space:nowrap; }
.dsss-bind-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsss-bind-label { flex:none; font-size:11px; line-height:18px;
  color:var(--dsw-alias-label-tertiary,#81858c); }

/* ---- Buttons (mirror ui-primitives Button) ---- */
.dsss-btn { display:inline-flex; align-items:center; justify-content:center; gap:4px;
  border:none; border-radius:16px; cursor:pointer; font-size:12px; line-height:20px;
  padding:0 12px; height:28px; white-space:nowrap;
  color:var(--dsw-alias-label-primary,#0f1115); background:transparent;
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif); }
.dsss-btn:disabled { cursor:not-allowed; opacity:0.4; }
.dsss-btn.primary { background:var(--dsw-alias-button-primary-fill,#0f1115);
  color:var(--dsw-alias-label-primary-foreground,#fff); }
.dsss-btn.primary:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover,#43454a); }
.dsss-btn.ghost:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-btn.ghost:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active,rgba(38,49,72,0.1)); }
.dsss-btn.outline { border:0.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,0.12)); }
.dsss-btn.outline:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06)); }
.dsss-btn.danger { color:var(--dsw-alias-state-error-primary,#ec1313); }
.dsss-btn.tiny { height:22px; padding:0 8px; border-radius:11px; font-size:11px; line-height:18px; }
.dsss-btn.bound { border:0.5px solid var(--dsw-alias-state-success-primary,#22c55e);
  color:var(--dsw-alias-state-success-primary,#22c55e); }

/* ---- Form fields ---- */
.dsss-form { display:flex; flex-direction:column; gap:10px; }
.dsss-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; }
.dsss-grid .span2 { grid-column:1 / -1; }
.dsss-field { display:flex; flex-direction:column; gap:4px; font-size:12px;
  color:var(--dsw-alias-label-secondary,#61666b); min-width:0; }
.dsss-field input, .dsss-field select { height:32px; padding:0 10px; font-size:13px;
  border:0.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,0.15)); border-radius:8px; outline:none;
  background:var(--dsw-alias-bg-layer-1,#fff); color:var(--dsw-alias-label-primary,#0f1115);
  font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif);
  width:100%; box-sizing:border-box; }
.dsss-field input:focus, .dsss-field select:focus {
  border-color:var(--dsw-alias-brand-primary,#0f6bff); }
.dsss-form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:2px; flex-wrap:wrap; }

/* ---- Notice band ---- */
.dsss-note { font-size:12px; line-height:18px; border-radius:8px; padding:8px 12px; word-break:break-all; }
.dsss-note.err { background:var(--dsw-static-red-50,#fef2f2); color:var(--dsw-alias-state-error-primary,#ec1313); }
.dsss-note.ok { background:var(--dsw-static-green-100,#e6faed); color:var(--dsw-alias-state-success-primary,#16a34a); }
.dsss-note.info { background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,0.06));
  color:var(--dsw-alias-label-secondary,#61666b); }

/* ---- Trust fingerprint band ---- */
.dsss-trust { display:flex; flex-direction:column; gap:8px; padding:10px 12px;
  border:1px dashed var(--dsw-alias-state-warn-primary,#f59e0b); border-radius:12px;
  font-size:12px; color:var(--dsw-alias-label-secondary,#61666b); }
.dsss-trust code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:11px; user-select:all; word-break:break-all; color:var(--dsw-alias-state-warn-label,#b45309); }
.dsss-trust .dsss-actions { display:flex; gap:8px; flex-wrap:wrap; }

/* ---- Section frames ---- */
.dsss-pane { display:flex; flex-direction:column; gap:10px; }
.dsss-hint { margin:0; font-size:11px; line-height:16px;
  color:var(--dsw-alias-label-tertiary,#81858c); }
`
  document.head.appendChild(sheet)
}

// ---------------------------------------------------------------- helpers --

/** Friendly Chinese text for known domain error codes. */
const ERROR_TEXT = {
  HOST_KEY_UNTRUSTED: '主机密钥未被信任（首次连接需在测试时确认指纹）',
  HOST_KEY_CHANGED: '主机密钥已变化，与已存指纹不符',
  AUTH_FAILED: '认证失败：检查用户名、密钥路径或密码',
  PASSWORD_REQUIRED: '该认证方式需要密码',
  SERVER_BUSY: '仍有会话绑定此服务器',
  SERVER_NOT_FOUND: '服务器不存在',
  INVALID_INPUT: '输入不合法',
  NO_TARGET: '当前会话未绑定服务器',
  BAD_REQUEST: '请求参数错误',
}

/** @param {{code: string, message: string}} err */
function errorText(err) {
  const hint = ERROR_TEXT[err.code]
  return hint !== undefined ? `${hint}（${err.message}）` : err.message
}

/** Empty form template for a new server. */
function emptyForm() {
  return { name: '', host: '', port: '22', username: 'root', authType: 'key', keyPath: '', password: '', remoteRoot: '~' }
}

/** Seed the form from a persisted server record (password never round-trips). */
function formOf(server) {
  return {
    name: server.name,
    host: server.host,
    port: String(server.port),
    username: server.username,
    authType: server.auth.type,
    keyPath: server.auth.keyPath ?? '',
    password: '',
    remoteRoot: server.remoteRoot ?? '~',
  }
}

/** Form state -> RPC `input` object; empty optional strings are dropped. */
function inputOf(form) {
  const input = {
    name: form.name,
    host: form.host,
    port: Number(form.port),
    username: form.username,
    auth: form.authType === 'key'
      ? { type: 'key', keyPath: form.keyPath }
      : { type: form.authType },
    remoteRoot: form.remoteRoot,
  }
  if (form.password !== '') input.password = form.password
  return input
}

// -------------------------------------------------------------- components --

/**
 * Header capsule: opens the server manager modal. Mirrors the official
 * header-utilities capsule geometry (h32, r18, border-l2) with a live binding
 * dot (green = current session has a bound server).
 * @param {{sessionId?: string, call: (endpoint: string, args?: object) => Promise<any>}} props
 */
function SshEntry(props) {
  const [open, setOpen] = useState(false)
  const [bound, setBound] = useState(false)
  useEffect(() => {
    ensureStyles()
    let alive = true
    const probe = async () => {
      try {
        const data = await props.call('state')
        if (alive) setBound(data?.selectedBySession?.[props.sessionId] !== undefined)
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
      className: 'dsss-cap',
      title: 'SSH 服务器管理',
      onClick: () => {
        // Probe the current session's binding before opening so the modal
        // never shows a stale bound server.
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
      'SSH'),
    open ? h(ServerManager, {
      key: 'panel',
      sessionId: props.sessionId,
      call: props.call,
      onClose: () => setOpen(false),
    }) : null,
  ]
}

/**
 * Modal: server roster, session binding, and the add/edit form.
 * @param {{sessionId: string, call: Function, onClose: () => void}} props
 */
function ServerManager(props) {
  const { sessionId, call, onClose } = props
  const [state, setState] = useState(undefined)
  const [notice, setNotice] = useState(undefined)
  const [editing, setEditing] = useState(undefined)
  const [busy, setBusy] = useState(false)

  // Pull a fresh snapshot; keyed on sessionId so a session switch (the modal
  // is session-scoped and remounts) always re-reads its own binding, never a
  // stale snapshot from the previous session.
  const refresh = useCallback(async () => {
    try {
      const data = await call('state')
      setState({ ...data })
    } catch (err) {
      setNotice({ kind: 'err', text: `读取失败：${err.message}` })
    }
  }, [call, sessionId])

  useEffect(() => {
    setNotice(undefined)
    void refresh()
    const timer = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh, sessionId])

  /** Run one mutating endpoint with busy/notice handling. */
  const act = useCallback(async (endpoint, args, done) => {
    setBusy(true)
    setNotice(undefined)
    try {
      const data = await call(endpoint, args)
      if (done !== undefined) done(data)
      await refresh()
      return data
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) })
      return undefined
    } finally {
      setBusy(false)
    }
  }, [call, refresh])

  // Binding may point at a server that was deleted since; normalize it so the
  // bound card shows an explicit "needs re-bind" state instead of a ghost.
  const servers = state?.servers ?? []
  const boundServer = servers.find(s => s.id === state?.selectedBySession?.[sessionId])
  const selectedServerId = boundServer !== undefined
    ? boundServer.id
    : state?.selectedBySession?.[sessionId] !== undefined ? 'deleted' : undefined

  return createPortal(
    h('div', { className: 'dsss-overlay' },
      h('div', { className: 'dsss-mask', onMouseDown: onClose }),
      h('div', { className: 'dsss-modal' },
        h('div', { className: 'dsss-head' },
          h('h3', { className: 'dsss-title' }, 'SSH 服务器'),
          h('button', { className: 'dsss-close', title: '关闭', onClick: onClose }, '✕'),
        ),
        h('div', { className: 'dsss-body' },

          notice != null && h('div', { className: `dsss-note ${notice.kind}` }, notice.text),

          h('div', { className: 'dsss-bound' },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('p', { className: 'dsss-pane-title', style: { margin: 0 } }, '当前会话已绑定'),
              h('button', {
                className: 'dsss-btn tiny ghost', disabled: busy || selectedServerId === undefined,
                onClick: () => { void act('target.clear', { sessionId }, () => setNotice({ kind: 'ok', text: '已解绑当前会话' })) },
              }, '解绑'),
            ),
            selectedServerId === undefined
              ? h('div', { className: 'dsss-empty', style: { padding: '16px 12px' } }, '本会话尚未绑定服务器。点击下方列表行内「绑定」，或在本区块选择服务器绑定。')
              : selectedServerId === 'deleted'
                ? h('div', { className: 'dsss-item bound' },
                    h('span', { className: 'dot' }),
                    h('span', { className: 'dsss-item-grow' },
                      h('div', { className: 'dsss-item-name' }, '已绑定的服务器不存在'),
                      h('div', { className: 'dsss-item-meta' }, '原绑定目标已被删除，请重新绑定服务器'),
                    ),
                    h('span', { className: 'dsss-badge' }, '需重绑'),
                  )
                : h('div', { className: 'dsss-item bound' },
                    h('span', { className: 'dot on' }),
                    h('span', { className: 'dsss-item-grow' },
                      h('div', { className: 'dsss-item-name' }, labelOf(servers, selectedServerId)),
                      h('div', { className: 'dsss-item-meta' }, '本会话默认目标 · ssh_* 工具作用于此服务器'),
                    ),
                    h('span', { className: 'dsss-badge bound' }, '已绑定'),
                  ),
            servers.filter(s => s.id !== selectedServerId).length > 0
              ? h('div', { className: 'dsss-bind-row' },
                  h('span', { className: 'dsss-bind-label' }, '绑定到：'),
                  servers.filter(s => s.id !== selectedServerId).map(s =>
                    h('button', {
                      key: s.id, className: 'dsss-btn tiny outline', disabled: busy,
                      onClick: () => { void act('target.set', { sessionId, serverId: s.id }) },
                    }, s.name),
                  ),
                )
              : null,
          ),

          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('p', { className: 'dsss-pane-title', style: { margin: 0 } }, '服务器列表'),
            h('button', {
              className: 'dsss-btn primary', disabled: busy,
              onClick: () => setEditing({ id: undefined, form: emptyForm() }),
            }, '新增'),
          ),
          servers.length === 0
            ? h('div', { className: 'dsss-empty' }, '还没有服务器，点击「新增」开始配置。')
            : h('div', { className: 'dsss-roster' },
                servers.map(s => h('div', {
                  key: s.id,
                  className: 'dsss-item' + (editing !== undefined && editing.id === s.id ? ' sel' : ''),
                  onClick: () => setEditing({ id: s.id, form: formOf(s) }),
                },
                  h('span', { className: 'dot' + (s.connected ? ' on' : '') }),
                  h('span', { className: 'dsss-item-grow' },
                    h('div', { className: 'dsss-item-name' }, s.name),
                    h('div', { className: 'dsss-item-meta' },
                      `${s.username}@${s.host}:${s.port} · ${authLabel(s.auth.type)}`),
                  ),
                  s.id === selectedServerId
                    ? h('button', {
                        className: 'dsss-btn tiny outline bound', disabled: busy,
                        onClick: (e) => { e.stopPropagation(); void act('target.clear', { sessionId }, () => setNotice({ kind: 'ok', text: '已解绑当前会话' })) },
                      }, '已绑定 · 解绑')
                    : null,
                  h('div', { className: 'dsss-item-actions', onClick: (e) => e.stopPropagation() },
                    s.id === selectedServerId ? null : h('button', {
                      className: 'dsss-btn tiny outline', disabled: busy,
                      onClick: () => { void act('target.set', { sessionId, serverId: s.id }) },
                    }, '绑定'),
                    h('button', {
                      className: 'dsss-btn tiny ghost', disabled: busy,
                      onClick: () => { void act('server.reconnect', { id: s.id }, () => setNotice({ kind: 'ok', text: `「${s.name}」已重连` })) },
                    }, '重连'),
                    h('button', {
                      className: 'dsss-btn tiny danger', disabled: busy,
                      onClick: () => {
                        if (window.confirm(`删除服务器「${s.name}」？`) !== true) return
                        void act('server.remove', { id: s.id, force: true }, () => setNotice({ kind: 'ok', text: `「${s.name}」已删除` }))
                      },
                    }, '删除'),
                  ),
                )),
              ),
          h('div', { className: 'dsss-hint' },
            selectedServerId === undefined
              ? '尚未绑定服务器；点击行内「绑定」后，ssh_* 工具即作用于此服务器。'
              : '「已绑定」服务器是当前会话的 ssh_* 默认目标。',
          ),

          editing != null && h(ServerForm, {
            key: editing.id ?? 'new',
            editing,
            busy,
            onCancel: () => setEditing(undefined),
            onSubmit: (args, message) => {
              void act('server.testAndSave', args, () => setNotice({ kind: 'ok', text: message }))
            },
            onTest: (args) => call('server.test', args),
            setNotice,
          }),
        ),
      ),
    ),
    document.body,
  )
}

/**
 * Add/edit form with test-before-save and the TOFU host-key trust flow:
 * a first probe to an unknown host rejects with HOST_KEY_UNTRUSTED plus the
 * presented fingerprint; the user confirms and the retry carries it as
 * `allowFingerprint`.
 * @param {{editing: {id: string | undefined, form: object}, busy: boolean, onCancel: () => void, onSubmit: (args: object, message: string) => void, onTest: (args: object) => Promise<any>, setNotice: (notice: {kind: string, text: string} | undefined) => void}} props
 */
function ServerForm(props) {
  const { editing, busy, onCancel, onSubmit, onTest, setNotice } = props
  const [form, setForm] = useState(editing.form)
  const [testing, setTesting] = useState(false)
  const [trust, setTrust] = useState(null)
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const buildArgs = () => ({
    input: inputOf(form),
    partial: editing.id !== undefined,
    // One-shot probe credential; validateServerInput drops input.password, so
    // it never reaches the store.
    password: form.password !== '' ? form.password : undefined,
  })

  const runTest = async (allowFingerprint) => {
    setTesting(true)
    setNotice(allowFingerprint === undefined
      ? { kind: 'info', text: '正在连接并探测远端…' }
      : { kind: 'info', text: '正在用已确认的指纹重新连接…' })
    try {
      const args = buildArgs()
      if (allowFingerprint !== undefined) args.allowFingerprint = allowFingerprint
      const data = await onTest(args)
      setTrust(null)
      setNotice({ kind: 'ok', text: `连接成功：指纹 ${data.fingerprint || '（未捕获）'} · ${data.uname ?? ''}` })
    } catch (err) {
      const fp = err.fingerprint
      if ((err.code === 'HOST_KEY_UNTRUSTED' || err.code === 'HOST_KEY_CHANGED') && typeof fp === 'string' && fp !== '') {
        setTrust({ fingerprint: fp, changed: err.code === 'HOST_KEY_CHANGED' })
        setNotice({
          kind: 'err',
          text: err.code === 'HOST_KEY_CHANGED'
            ? '警告：主机密钥与已存指纹不一致，可能是主机重装或中间人攻击，请仔细核对。'
            : '首次连接该主机，请核对下方指纹后确认信任。',
        })
      } else {
        setNotice({ kind: 'err', text: errorText(err) })
      }
    } finally {
      setTesting(false)
    }
  }

  return h('div', { className: 'dsss-pane' },
    h('p', { className: 'dsss-pane-title' }, editing.id === undefined ? '新增服务器' : `编辑「${editing.form.name}」`),
    h('div', { className: 'dsss-form' },
      h('div', { className: 'dsss-grid' },
        h('label', { className: 'dsss-field' }, '名称',
          h('input', { value: form.name, onChange: set('name'), placeholder: '例如：生产 Web 机' })),
        h('label', { className: 'dsss-field' }, '主机',
          h('input', { value: form.host, onChange: set('host'), placeholder: 'IP 或域名' })),
        h('label', { className: 'dsss-field' }, '端口',
          h('input', { value: form.port, onChange: set('port'), inputMode: 'numeric' })),
        h('label', { className: 'dsss-field' }, '用户名',
          h('input', { value: form.username, onChange: set('username') })),
        h('label', { className: 'dsss-field' }, '认证方式',
          h('select', { value: form.authType, onChange: set('authType') },
            h('option', { value: 'key' }, '私钥（默认 ~/.ssh 密钥）'),
            h('option', { value: 'agent' }, 'SSH 代理'),
            h('option', { value: 'password' }, '密码'),
            h('option', { value: 'auto' }, '自动尝试'))),
        form.authType === 'key'
          ? h('label', { className: 'dsss-field' }, '私钥路径（留空用默认密钥）',
              h('input', { value: form.keyPath, onChange: set('keyPath'), placeholder: 'C:/Users/…/.ssh/id_ed25519' }))
          : form.authType === 'password' || form.authType === 'auto'
            ? h('label', { className: 'dsss-field' }, '密码（仅存内存，不落盘）',
                h('input', { type: 'password', value: form.password, onChange: set('password') }))
            : h('label', { className: 'dsss-field' }, '', h('span', null)),
        h('label', { className: 'dsss-field span2' }, '远端根目录',
          h('input', { value: form.remoteRoot, onChange: set('remoteRoot') })),
      ),
    ),
    trust != null && h('div', { className: 'dsss-trust' },
      h('div', null, trust.changed ? '新指纹：' : '主机指纹：',
        h('code', null, trust.fingerprint)),
      h('div', { className: 'dsss-actions' },
        h('button', {
          className: 'dsss-btn primary', disabled: testing || busy,
          onClick: () => { void runTest(trust.fingerprint) },
        }, '核对无误，信任并重试'),
        h('button', { className: 'dsss-btn ghost', disabled: testing, onClick: () => setTrust(null) }, '不信任'),
      ),
    ),
    h('div', { className: 'dsss-form-actions' },
      h('button', { className: 'dsss-btn outline', disabled: busy || testing, onClick: () => { void runTest() } }, testing ? '测试中…' : '测试连接'),
      h('button', {
        className: 'dsss-btn primary', disabled: busy || testing,
        onClick: () => onSubmit(buildArgs(), editing.id === undefined ? '服务器已保存' : '服务器已更新'),
      }, '保存'),
      h('button', { className: 'dsss-btn ghost', onClick: onCancel }, '取消'),
    ),
  )
}

/** @param {Array<Record<string, any>>} servers */
function labelOf(servers, id) {
  const found = servers.find(s => s.id === id)
  return found !== undefined ? found.name : id
}

/** @param {string} type */
function authLabel(type) {
  const labels = { key: '私钥', agent: '代理', password: '密码', auto: '自动' }
  return labels[type] ?? type
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
   * One RPC round trip; a platform `ok:false` result rejects with `.code`,
   * `.stage`, and `.fingerprint` (when present) so callers can branch on the
   * typed code and drive the host-key trust flow.
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
        if (typeof details.stage === 'string') err.stage = details.stage
        if (typeof details.fingerprint === 'string') err.fingerprint = details.fingerprint
      }
      throw err
    }
    return result.value
  }

  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register({
    name: SLOT_NAME,
    id: 'server-ssh',
    order: 30,
    inject: () => ({ call }),
  }, SshEntry))
}
