window.__ModuleLoader__.load({ id: "dsh-server-ssh", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var React = require("react");
var ReactDOM = require("react-dom");
var SLOT_NAME = "dsh.personal.bar";
var RPC_CHANNEL = "/dsh-server-ssh";
var POLL_INTERVAL_MS = 5e3;
var h = React.createElement;
var { useState, useEffect, useCallback } = React;
var createPortal = ReactDOM.createPortal;
var STYLE_ID = "dsss-style";
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return;
  const sheet = document.createElement("style");
  sheet.id = STYLE_ID;
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
`;
  document.head.appendChild(sheet);
}
var ERROR_TEXT = {
  HOST_KEY_UNTRUSTED: "\u4E3B\u673A\u5BC6\u94A5\u672A\u88AB\u4FE1\u4EFB\uFF08\u9996\u6B21\u8FDE\u63A5\u9700\u5728\u6D4B\u8BD5\u65F6\u786E\u8BA4\u6307\u7EB9\uFF09",
  HOST_KEY_CHANGED: "\u4E3B\u673A\u5BC6\u94A5\u5DF2\u53D8\u5316\uFF0C\u4E0E\u5DF2\u5B58\u6307\u7EB9\u4E0D\u7B26",
  AUTH_FAILED: "\u8BA4\u8BC1\u5931\u8D25\uFF1A\u68C0\u67E5\u7528\u6237\u540D\u3001\u5BC6\u94A5\u8DEF\u5F84\u6216\u5BC6\u7801",
  PASSWORD_REQUIRED: "\u8BE5\u8BA4\u8BC1\u65B9\u5F0F\u9700\u8981\u5BC6\u7801",
  SERVER_BUSY: "\u4ECD\u6709\u4F1A\u8BDD\u7ED1\u5B9A\u6B64\u670D\u52A1\u5668",
  SERVER_NOT_FOUND: "\u670D\u52A1\u5668\u4E0D\u5B58\u5728",
  INVALID_INPUT: "\u8F93\u5165\u4E0D\u5408\u6CD5",
  NO_TARGET: "\u5F53\u524D\u4F1A\u8BDD\u672A\u7ED1\u5B9A\u670D\u52A1\u5668",
  BAD_REQUEST: "\u8BF7\u6C42\u53C2\u6570\u9519\u8BEF"
};
function errorText(err) {
  const hint = ERROR_TEXT[err.code];
  return hint !== void 0 ? `${hint}\uFF08${err.message}\uFF09` : err.message;
}
function emptyForm() {
  return { name: "", host: "", port: "22", username: "root", authType: "key", keyPath: "", password: "", remoteRoot: "~" };
}
function formOf(server) {
  return {
    name: server.name,
    host: server.host,
    port: String(server.port),
    username: server.username,
    authType: server.auth.type,
    keyPath: server.auth.keyPath ?? "",
    password: "",
    remoteRoot: server.remoteRoot ?? "~"
  };
}
function inputOf(form) {
  const input = {
    name: form.name,
    host: form.host,
    port: Number(form.port),
    username: form.username,
    auth: form.authType === "key" ? { type: "key", keyPath: form.keyPath } : { type: form.authType },
    remoteRoot: form.remoteRoot
  };
  if (form.password !== "") input.password = form.password;
  return input;
}
function SshEntry(props) {
  const [open, setOpen] = useState(false);
  const [bound, setBound] = useState(false);
  useEffect(() => {
    ensureStyles();
    let alive = true;
    const probe = async () => {
      try {
        const data = await props.call("state");
        if (alive) setBound(data?.selectedBySession?.[props.sessionId] !== void 0);
      } catch {
      }
    };
    void probe();
    const timer = setInterval(probe, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [props.call, props.sessionId]);
  if (props.sessionId === void 0) return null;
  return [
    h(
      "button",
      {
        key: "btn",
        className: "dsss-cap",
        title: "SSH \u670D\u52A1\u5668\u7BA1\u7406",
        onClick: () => {
          void (async () => {
            try {
              const data = await props.call("state");
              setBound(data?.selectedBySession?.[props.sessionId] !== void 0);
            } catch {
            }
          })();
          setOpen(true);
        }
      },
      h("span", { className: "dot" + (bound ? " on" : "") }),
      "SSH"
    ),
    open ? h(ServerManager, {
      key: "panel",
      sessionId: props.sessionId,
      call: props.call,
      onClose: () => setOpen(false)
    }) : null
  ];
}
function ServerManager(props) {
  const { sessionId, call, onClose } = props;
  const [state, setState] = useState(void 0);
  const [notice, setNotice] = useState(void 0);
  const [editing, setEditing] = useState(void 0);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await call("state");
      setState({ ...data });
    } catch (err) {
      setNotice({ kind: "err", text: `\u8BFB\u53D6\u5931\u8D25\uFF1A${err.message}` });
    }
  }, [call, sessionId]);
  useEffect(() => {
    setNotice(void 0);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh, sessionId]);
  const act = useCallback(async (endpoint, args, done) => {
    setBusy(true);
    setNotice(void 0);
    try {
      const data = await call(endpoint, args);
      if (done !== void 0) done(data);
      await refresh();
      return data;
    } catch (err) {
      setNotice({ kind: "err", text: errorText(err) });
      return void 0;
    } finally {
      setBusy(false);
    }
  }, [call, refresh]);
  const servers = state?.servers ?? [];
  const boundServer = servers.find((s) => s.id === state?.selectedBySession?.[sessionId]);
  const selectedServerId = boundServer !== void 0 ? boundServer.id : state?.selectedBySession?.[sessionId] !== void 0 ? "deleted" : void 0;
  return createPortal(
    h(
      "div",
      { className: "dsss-overlay" },
      h("div", { className: "dsss-mask", onMouseDown: onClose }),
      h(
        "div",
        { className: "dsss-modal" },
        h(
          "div",
          { className: "dsss-head" },
          h("h3", { className: "dsss-title" }, "SSH \u670D\u52A1\u5668"),
          h("button", { className: "dsss-close", title: "\u5173\u95ED", onClick: onClose }, "\u2715")
        ),
        h(
          "div",
          { className: "dsss-body" },
          notice != null && h("div", { className: `dsss-note ${notice.kind}` }, notice.text),
          h(
            "div",
            { className: "dsss-bound" },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("p", { className: "dsss-pane-title", style: { margin: 0 } }, "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u7ED1\u5B9A"),
              h("button", {
                className: "dsss-btn tiny ghost",
                disabled: busy || selectedServerId === void 0,
                onClick: () => {
                  void act("target.clear", { sessionId }, () => setNotice({ kind: "ok", text: "\u5DF2\u89E3\u7ED1\u5F53\u524D\u4F1A\u8BDD" }));
                }
              }, "\u89E3\u7ED1")
            ),
            selectedServerId === void 0 ? h("div", { className: "dsss-empty", style: { padding: "16px 12px" } }, "\u672C\u4F1A\u8BDD\u5C1A\u672A\u7ED1\u5B9A\u670D\u52A1\u5668\u3002\u70B9\u51FB\u4E0B\u65B9\u5217\u8868\u884C\u5185\u300C\u7ED1\u5B9A\u300D\uFF0C\u6216\u5728\u672C\u533A\u5757\u9009\u62E9\u670D\u52A1\u5668\u7ED1\u5B9A\u3002") : selectedServerId === "deleted" ? h(
              "div",
              { className: "dsss-item bound" },
              h("span", { className: "dot" }),
              h(
                "span",
                { className: "dsss-item-grow" },
                h("div", { className: "dsss-item-name" }, "\u5DF2\u7ED1\u5B9A\u7684\u670D\u52A1\u5668\u4E0D\u5B58\u5728"),
                h("div", { className: "dsss-item-meta" }, "\u539F\u7ED1\u5B9A\u76EE\u6807\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A\u670D\u52A1\u5668")
              ),
              h("span", { className: "dsss-badge" }, "\u9700\u91CD\u7ED1")
            ) : h(
              "div",
              { className: "dsss-item bound" },
              h("span", { className: "dot on" }),
              h(
                "span",
                { className: "dsss-item-grow" },
                h("div", { className: "dsss-item-name" }, labelOf(servers, selectedServerId)),
                h("div", { className: "dsss-item-meta" }, "\u672C\u4F1A\u8BDD\u9ED8\u8BA4\u76EE\u6807 \xB7 ssh_* \u5DE5\u5177\u4F5C\u7528\u4E8E\u6B64\u670D\u52A1\u5668")
              ),
              h("span", { className: "dsss-badge bound" }, "\u5DF2\u7ED1\u5B9A")
            ),
            servers.filter((s) => s.id !== selectedServerId).length > 0 ? h(
              "div",
              { className: "dsss-bind-row" },
              h("span", { className: "dsss-bind-label" }, "\u7ED1\u5B9A\u5230\uFF1A"),
              servers.filter((s) => s.id !== selectedServerId).map(
                (s) => h("button", {
                  key: s.id,
                  className: "dsss-btn tiny outline",
                  disabled: busy,
                  onClick: () => {
                    void act("target.set", { sessionId, serverId: s.id });
                  }
                }, s.name)
              )
            ) : null
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            h("p", { className: "dsss-pane-title", style: { margin: 0 } }, "\u670D\u52A1\u5668\u5217\u8868"),
            h("button", {
              className: "dsss-btn primary",
              disabled: busy,
              onClick: () => setEditing({ id: void 0, form: emptyForm() })
            }, "\u65B0\u589E")
          ),
          servers.length === 0 ? h("div", { className: "dsss-empty" }, "\u8FD8\u6CA1\u6709\u670D\u52A1\u5668\uFF0C\u70B9\u51FB\u300C\u65B0\u589E\u300D\u5F00\u59CB\u914D\u7F6E\u3002") : h(
            "div",
            { className: "dsss-roster" },
            servers.map((s) => h(
              "div",
              {
                key: s.id,
                className: "dsss-item" + (editing !== void 0 && editing.id === s.id ? " sel" : ""),
                onClick: () => setEditing({ id: s.id, form: formOf(s) })
              },
              h("span", { className: "dot" + (s.connected ? " on" : "") }),
              h(
                "span",
                { className: "dsss-item-grow" },
                h("div", { className: "dsss-item-name" }, s.name),
                h(
                  "div",
                  { className: "dsss-item-meta" },
                  `${s.username}@${s.host}:${s.port} \xB7 ${authLabel(s.auth.type)}`
                )
              ),
              s.id === selectedServerId ? h("button", {
                className: "dsss-btn tiny outline bound",
                disabled: busy,
                onClick: (e) => {
                  e.stopPropagation();
                  void act("target.clear", { sessionId }, () => setNotice({ kind: "ok", text: "\u5DF2\u89E3\u7ED1\u5F53\u524D\u4F1A\u8BDD" }));
                }
              }, "\u5DF2\u7ED1\u5B9A \xB7 \u89E3\u7ED1") : null,
              h(
                "div",
                { className: "dsss-item-actions", onClick: (e) => e.stopPropagation() },
                s.id === selectedServerId ? null : h("button", {
                  className: "dsss-btn tiny outline",
                  disabled: busy,
                  onClick: () => {
                    void act("target.set", { sessionId, serverId: s.id });
                  }
                }, "\u7ED1\u5B9A"),
                h("button", {
                  className: "dsss-btn tiny ghost",
                  disabled: busy,
                  onClick: () => {
                    void act("server.reconnect", { id: s.id }, () => setNotice({ kind: "ok", text: `\u300C${s.name}\u300D\u5DF2\u91CD\u8FDE` }));
                  }
                }, "\u91CD\u8FDE"),
                h("button", {
                  className: "dsss-btn tiny danger",
                  disabled: busy,
                  onClick: () => {
                    if (window.confirm(`\u5220\u9664\u670D\u52A1\u5668\u300C${s.name}\u300D\uFF1F`) !== true) return;
                    void act("server.remove", { id: s.id, force: true }, () => setNotice({ kind: "ok", text: `\u300C${s.name}\u300D\u5DF2\u5220\u9664` }));
                  }
                }, "\u5220\u9664")
              )
            ))
          ),
          h(
            "div",
            { className: "dsss-hint" },
            selectedServerId === void 0 ? "\u5C1A\u672A\u7ED1\u5B9A\u670D\u52A1\u5668\uFF1B\u70B9\u51FB\u884C\u5185\u300C\u7ED1\u5B9A\u300D\u540E\uFF0Cssh_* \u5DE5\u5177\u5373\u4F5C\u7528\u4E8E\u6B64\u670D\u52A1\u5668\u3002" : "\u300C\u5DF2\u7ED1\u5B9A\u300D\u670D\u52A1\u5668\u662F\u5F53\u524D\u4F1A\u8BDD\u7684 ssh_* \u9ED8\u8BA4\u76EE\u6807\u3002"
          ),
          editing != null && h(ServerForm, {
            key: editing.id ?? "new",
            editing,
            busy,
            onCancel: () => setEditing(void 0),
            onSubmit: (args, message) => {
              void act("server.testAndSave", args, () => setNotice({ kind: "ok", text: message }));
            },
            onTest: (args) => call("server.test", args),
            setNotice
          })
        )
      )
    ),
    document.body
  );
}
function ServerForm(props) {
  const { editing, busy, onCancel, onSubmit, onTest, setNotice } = props;
  const [form, setForm] = useState(editing.form);
  const [testing, setTesting] = useState(false);
  const [trust, setTrust] = useState(null);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const buildArgs = () => ({
    input: inputOf(form),
    partial: editing.id !== void 0,
    // One-shot probe credential; validateServerInput drops input.password, so
    // it never reaches the store.
    password: form.password !== "" ? form.password : void 0
  });
  const runTest = async (allowFingerprint) => {
    setTesting(true);
    setNotice(allowFingerprint === void 0 ? { kind: "info", text: "\u6B63\u5728\u8FDE\u63A5\u5E76\u63A2\u6D4B\u8FDC\u7AEF\u2026" } : { kind: "info", text: "\u6B63\u5728\u7528\u5DF2\u786E\u8BA4\u7684\u6307\u7EB9\u91CD\u65B0\u8FDE\u63A5\u2026" });
    try {
      const args = buildArgs();
      if (allowFingerprint !== void 0) args.allowFingerprint = allowFingerprint;
      const data = await onTest(args);
      setTrust(null);
      setNotice({ kind: "ok", text: `\u8FDE\u63A5\u6210\u529F\uFF1A\u6307\u7EB9 ${data.fingerprint || "\uFF08\u672A\u6355\u83B7\uFF09"} \xB7 ${data.uname ?? ""}` });
    } catch (err) {
      const fp = err.fingerprint;
      if ((err.code === "HOST_KEY_UNTRUSTED" || err.code === "HOST_KEY_CHANGED") && typeof fp === "string" && fp !== "") {
        setTrust({ fingerprint: fp, changed: err.code === "HOST_KEY_CHANGED" });
        setNotice({
          kind: "err",
          text: err.code === "HOST_KEY_CHANGED" ? "\u8B66\u544A\uFF1A\u4E3B\u673A\u5BC6\u94A5\u4E0E\u5DF2\u5B58\u6307\u7EB9\u4E0D\u4E00\u81F4\uFF0C\u53EF\u80FD\u662F\u4E3B\u673A\u91CD\u88C5\u6216\u4E2D\u95F4\u4EBA\u653B\u51FB\uFF0C\u8BF7\u4ED4\u7EC6\u6838\u5BF9\u3002" : "\u9996\u6B21\u8FDE\u63A5\u8BE5\u4E3B\u673A\uFF0C\u8BF7\u6838\u5BF9\u4E0B\u65B9\u6307\u7EB9\u540E\u786E\u8BA4\u4FE1\u4EFB\u3002"
        });
      } else {
        setNotice({ kind: "err", text: errorText(err) });
      }
    } finally {
      setTesting(false);
    }
  };
  return h(
    "div",
    { className: "dsss-pane" },
    h("p", { className: "dsss-pane-title" }, editing.id === void 0 ? "\u65B0\u589E\u670D\u52A1\u5668" : `\u7F16\u8F91\u300C${editing.form.name}\u300D`),
    h(
      "div",
      { className: "dsss-form" },
      h(
        "div",
        { className: "dsss-grid" },
        h(
          "label",
          { className: "dsss-field" },
          "\u540D\u79F0",
          h("input", { value: form.name, onChange: set("name"), placeholder: "\u4F8B\u5982\uFF1A\u751F\u4EA7 Web \u673A" })
        ),
        h(
          "label",
          { className: "dsss-field" },
          "\u4E3B\u673A",
          h("input", { value: form.host, onChange: set("host"), placeholder: "IP \u6216\u57DF\u540D" })
        ),
        h(
          "label",
          { className: "dsss-field" },
          "\u7AEF\u53E3",
          h("input", { value: form.port, onChange: set("port"), inputMode: "numeric" })
        ),
        h(
          "label",
          { className: "dsss-field" },
          "\u7528\u6237\u540D",
          h("input", { value: form.username, onChange: set("username") })
        ),
        h(
          "label",
          { className: "dsss-field" },
          "\u8BA4\u8BC1\u65B9\u5F0F",
          h(
            "select",
            { value: form.authType, onChange: set("authType") },
            h("option", { value: "key" }, "\u79C1\u94A5\uFF08\u9ED8\u8BA4 ~/.ssh \u5BC6\u94A5\uFF09"),
            h("option", { value: "agent" }, "SSH \u4EE3\u7406"),
            h("option", { value: "password" }, "\u5BC6\u7801"),
            h("option", { value: "auto" }, "\u81EA\u52A8\u5C1D\u8BD5")
          )
        ),
        form.authType === "key" ? h(
          "label",
          { className: "dsss-field" },
          "\u79C1\u94A5\u8DEF\u5F84\uFF08\u7559\u7A7A\u7528\u9ED8\u8BA4\u5BC6\u94A5\uFF09",
          h("input", { value: form.keyPath, onChange: set("keyPath"), placeholder: "C:/Users/\u2026/.ssh/id_ed25519" })
        ) : form.authType === "password" || form.authType === "auto" ? h(
          "label",
          { className: "dsss-field" },
          "\u5BC6\u7801\uFF08\u4EC5\u5B58\u5185\u5B58\uFF0C\u4E0D\u843D\u76D8\uFF09",
          h("input", { type: "password", value: form.password, onChange: set("password") })
        ) : h("label", { className: "dsss-field" }, "", h("span", null)),
        h(
          "label",
          { className: "dsss-field span2" },
          "\u8FDC\u7AEF\u6839\u76EE\u5F55",
          h("input", { value: form.remoteRoot, onChange: set("remoteRoot") })
        )
      )
    ),
    trust != null && h(
      "div",
      { className: "dsss-trust" },
      h(
        "div",
        null,
        trust.changed ? "\u65B0\u6307\u7EB9\uFF1A" : "\u4E3B\u673A\u6307\u7EB9\uFF1A",
        h("code", null, trust.fingerprint)
      ),
      h(
        "div",
        { className: "dsss-actions" },
        h("button", {
          className: "dsss-btn primary",
          disabled: testing || busy,
          onClick: () => {
            void runTest(trust.fingerprint);
          }
        }, "\u6838\u5BF9\u65E0\u8BEF\uFF0C\u4FE1\u4EFB\u5E76\u91CD\u8BD5"),
        h("button", { className: "dsss-btn ghost", disabled: testing, onClick: () => setTrust(null) }, "\u4E0D\u4FE1\u4EFB")
      )
    ),
    h(
      "div",
      { className: "dsss-form-actions" },
      h("button", { className: "dsss-btn outline", disabled: busy || testing, onClick: () => {
        void runTest();
      } }, testing ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"),
      h("button", {
        className: "dsss-btn primary",
        disabled: busy || testing,
        onClick: () => onSubmit(buildArgs(), editing.id === void 0 ? "\u670D\u52A1\u5668\u5DF2\u4FDD\u5B58" : "\u670D\u52A1\u5668\u5DF2\u66F4\u65B0")
      }, "\u4FDD\u5B58"),
      h("button", { className: "dsss-btn ghost", onClick: onCancel }, "\u53D6\u6D88")
    )
  );
}
function labelOf(servers, id) {
  const found = servers.find((s) => s.id === id);
  return found !== void 0 ? found.name : id;
}
function authLabel(type) {
  const labels = { key: "\u79C1\u94A5", agent: "\u4EE3\u7406", password: "\u5BC6\u7801", auto: "\u81EA\u52A8" };
  return labels[type] ?? type;
}
var inject = ["slots"];
function apply(ctx) {
  const call = async (endpoint, args) => {
    const connection = ctx.get("connection");
    if (connection === void 0) throw new Error("\u8FDE\u63A5\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    const result = await connection.rpc.call(RPC_CHANNEL, endpoint, { args: args ?? {} });
    if (result.ok === false) {
      const failure = result.error ?? { code: "INTERNAL", message: "\u672A\u77E5\u9519\u8BEF", details: {} };
      const err = new Error(failure.message);
      err.code = failure.code;
      const details = failure.details;
      if (details !== null && typeof details === "object") {
        if (typeof details.stage === "string") err.stage = details.stage;
        if (typeof details.fingerprint === "string") err.fingerprint = details.fingerprint;
      }
      throw err;
    }
    return result.value;
  };
  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register({
    name: SLOT_NAME,
    id: "server-ssh",
    order: 30,
    inject: () => ({ call })
  }, SshEntry));
}
return module.exports; } });
