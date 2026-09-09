window.__ModuleLoader__.load({ id: "dsh-github-push", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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
var RPC_CHANNEL = "/dsh-github-push";
var POLL_INTERVAL_MS = 15e3;
var h = React.createElement;
var { useState, useEffect, useCallback } = React;
var createPortal = ReactDOM.createPortal;
var STYLE_ID = "dshgp-style";
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return;
  const sheet = document.createElement("style");
  sheet.id = STYLE_ID;
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
`;
  document.head.appendChild(sheet);
}
var ERROR_TEXT = {
  TOKEN_MISSING: "\u8BE5\u7ED1\u5B9A\u5C1A\u672A\u914D\u7F6E GitHub Token",
  NOT_A_REPO: "\u76EE\u6807\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93",
  NOTHING_TO_PUSH: "\u6CA1\u6709\u672A\u63D0\u4EA4\u7684\u6539\u52A8",
  COMMIT_FAILED: "\u63D0\u4EA4\u5931\u8D25",
  PUSH_FAILED: "\u63A8\u9001\u5931\u8D25",
  BINDING_NOT_FOUND: "\u7ED1\u5B9A\u4E0D\u5B58\u5728",
  GIT_FAILED: "git \u547D\u4EE4\u5931\u8D25",
  GIT_SPAWN: "\u65E0\u6CD5\u542F\u52A8 git",
  BAD_REQUEST: "\u8BF7\u6C42\u53C2\u6570\u9519\u8BEF"
};
function errorText(err) {
  const hint = ERROR_TEXT[err.code];
  return hint !== void 0 ? `${hint}\uFF1A${err.message}` : err.message;
}
function emptyForm() {
  return { name: "", localPath: "", repoOwner: "", repoName: "", branch: "main", token: "" };
}
function formOf(binding) {
  return {
    name: binding.name,
    localPath: binding.localPath,
    repoOwner: binding.repoOwner,
    repoName: binding.repoName,
    branch: binding.branch ?? "main",
    token: ""
  };
}
function repoLabel(owner, repo) {
  return `${owner}/${repo}`;
}
function statusChips(status) {
  if (status === void 0 || typeof status !== "object") return [h("span", { className: "dshgp-badge" }, "\u672A\u77E5")];
  const chips = [];
  if (status.isRepo === false) {
    chips.push(h("span", { className: "dshgp-badge warn" }, "\u672A\u521D\u59CB\u5316"));
    return chips;
  }
  chips.push(h("span", { className: "dshgp-badge" }, `\u5206\u652F ${status.branch ?? "?"}`));
  const changes = Number(status.changes ?? 0);
  if (changes > 0) chips.push(h("span", { className: "dshgp-badge warn" }, `${changes} \u5904\u672A\u63D0\u4EA4`));
  const ahead = Number(status.ahead ?? 0);
  const behind = Number(status.behind ?? 0);
  if (ahead > 0) chips.push(h("span", { className: "dshgp-badge ok" }, `\u9886\u5148 ${ahead}`));
  if (behind > 0) chips.push(h("span", { className: "dshgp-badge err" }, `\u843D\u540E ${behind}`));
  if (changes === 0 && ahead === 0 && behind === 0) chips.push(h("span", { className: "dshgp-badge ok" }, "\u5DF2\u540C\u6B65"));
  return chips;
}
function GhEntry(props) {
  const [open, setOpen] = useState(false);
  const [bound, setBound] = useState(false);
  useEffect(() => {
    ensureStyles();
    let alive = true;
    const probe = async () => {
      try {
        const data = await props.call("state");
        if (alive) {
          setBound(data?.selectedBySession?.[props.sessionId] !== void 0);
        }
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
        className: "dshgp-cap",
        title: "GitHub \u9879\u76EE\u63A8\u9001",
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
      "Git \u63A8\u9001"
    ),
    open ? h(GhManager, {
      key: "panel",
      call: props.call,
      sessionId: props.sessionId,
      onClose: () => setOpen(false)
    }) : null
  ];
}
function GhManager(props) {
  const { call, sessionId, onClose } = props;
  const [state, setState] = useState(void 0);
  const [notice, setNotice] = useState(void 0);
  const [editing, setEditing] = useState(void 0);
  const [pushing, setPushing] = useState(void 0);
  const [commitMessage, setCommitMessage] = useState("");
  const [proxyInput, setProxyInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const refresh = useCallback(async () => {
    try {
      const data = await call("state");
      setState({ ...data });
      setProxyInput((prev) => prev === "" ? data?.settings?.proxy ?? "" : prev);
      setUserInput((prev) => prev === "" ? data?.settings?.githubUser ?? "" : prev);
    } catch (err) {
      setNotice({ kind: "err", text: errorText(err) });
    }
  }, [call]);
  useEffect(() => {
    setNotice(void 0);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  const act = useCallback(async (endpoint, args, done) => {
    try {
      const data = await call(endpoint, args);
      if (done !== void 0) done(data);
      await refresh();
      return data;
    } catch (err) {
      setNotice({ kind: "err", text: errorText(err) });
      return void 0;
    }
  }, [call, refresh]);
  const bindings = state?.bindings ?? [];
  const boundBinding = bindings.find((b) => b.id === state?.selectedBySession?.[sessionId]);
  const selectedBindingId = boundBinding !== void 0 ? (
    /** @type {string} */
    boundBinding.id
  ) : state?.selectedBySession?.[sessionId] !== void 0 ? "deleted" : void 0;
  return createPortal(
    h(
      "div",
      { className: "dshgp-overlay" },
      h("div", { className: "dshgp-mask", onMouseDown: onClose }),
      h(
        "div",
        { className: "dshgp-modal" },
        h(
          "div",
          { className: "dshgp-head" },
          h("h3", { className: "dshgp-title" }, "GitHub \u9879\u76EE\u63A8\u9001"),
          h("button", { className: "dshgp-close", title: "\u5173\u95ED", onClick: onClose }, "\u2715")
        ),
        h(
          "div",
          { className: "dshgp-body" },
          notice != null && h("div", { className: `dshgp-note ${notice.kind}` }, notice.text),
          h(
            "div",
            { className: "dshgp-bound" },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("p", { className: "dshgp-pane-title", style: { margin: 0 } }, "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u7ED1\u5B9A"),
              h("button", {
                className: "dshgp-btn tiny ghost",
                disabled: selectedBindingId === void 0,
                onClick: () => {
                  void act("target.clear", { sessionId }, () => setNotice({ kind: "ok", text: "\u5DF2\u89E3\u7ED1\u5F53\u524D\u4F1A\u8BDD" }));
                }
              }, "\u89E3\u7ED1")
            ),
            selectedBindingId === void 0 ? h("div", { className: "dshgp-empty", style: { padding: "16px 12px" } }, "\u672C\u4F1A\u8BDD\u5C1A\u672A\u7ED1\u5B9A\u4ED3\u5E93\u3002\u70B9\u51FB\u4E0B\u65B9\u5217\u8868\u884C\u5185\u300C\u7ED1\u5B9A\u300D\uFF0C\u6216\u5728\u672C\u533A\u5757\u9009\u62E9\u7ED1\u5B9A\u3002") : selectedBindingId === "deleted" ? h(
              "div",
              { className: "dshgp-item bound" },
              h("span", { className: "dshgp-dot" }),
              h(
                "span",
                { className: "dshgp-grow" },
                h("div", { className: "dshgp-name" }, "\u5DF2\u7ED1\u5B9A\u7684\u4ED3\u5E93\u4E0D\u5B58\u5728"),
                h("div", { className: "dshgp-meta" }, "\u539F\u7ED1\u5B9A\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A\u4ED3\u5E93")
              ),
              h("span", { className: "dshgp-badge" }, "\u9700\u91CD\u7ED1")
            ) : h(
              "div",
              { className: "dshgp-item bound" },
              h("span", { className: "dshgp-dot on" }),
              h(
                "span",
                { className: "dshgp-grow" },
                h("div", { className: "dshgp-name" }, boundBinding.name),
                h("div", { className: "dshgp-meta" }, repoLabel(boundBinding.repoOwner, boundBinding.repoName) + " \xB7 \u672C\u4F1A\u8BDD\u9ED8\u8BA4\u63A8\u9001\u76EE\u6807")
              ),
              h("span", { className: "dshgp-badge bound" }, "\u5DF2\u7ED1\u5B9A")
            ),
            bindings.filter((b) => b.id !== selectedBindingId).length > 0 ? h(
              "div",
              { className: "dshgp-bind-row" },
              h("span", { className: "dshgp-bind-label" }, "\u7ED1\u5B9A\u5230\uFF1A"),
              bindings.filter((b) => b.id !== selectedBindingId).map(
                (b) => h("button", {
                  key: b.id,
                  className: "dshgp-btn tiny outline",
                  onClick: () => {
                    void act("target.set", { sessionId, bindingId: b.id }, () => setNotice({ kind: "ok", text: `\u5DF2\u7ED1\u5B9A\u300C${b.name}\u300D` }));
                  }
                }, b.name)
              )
            ) : null
          ),
          h(
            "div",
            { className: "dshgp-bound" },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("p", { className: "dshgp-pane-title", style: { margin: 0 } }, "\u5168\u5C40\u8BBE\u7F6E")
            ),
            h(
              "div",
              { className: "dshgp-proxy-row" },
              h(
                "label",
                { className: "dshgp-field dshgp-grow" },
                "\u4EE3\u7406\u5730\u5740\uFF08GitHub \u76F4\u8FDE\u4E0D\u901A\u65F6\u586B\uFF0C\u5982 http://127.0.0.1:7688\uFF09",
                h("input", {
                  value: proxyInput,
                  onChange: (e) => setProxyInput(e.target.value),
                  placeholder: "http://127.0.0.1:7688"
                })
              )
            ),
            h(
              "div",
              { className: "dshgp-proxy-row" },
              h(
                "label",
                { className: "dshgp-field dshgp-grow" },
                "GitHub \u7528\u6237\u540D\uFF08\u65B0\u5EFA\u7ED1\u5B9A\u65F6\u81EA\u52A8\u9884\u586B\u4ED3\u5E93\u5C5E\u4E3B\uFF09",
                h("input", {
                  value: userInput,
                  onChange: (e) => setUserInput(e.target.value),
                  placeholder: "\u4F8B\u5982\uFF1Aliaojiawei0428"
                })
              ),
              h("button", {
                className: "dshgp-btn primary",
                onClick: () => {
                  void act("settings.set", { proxy: proxyInput.trim(), githubUser: userInput.trim() }, () => setNotice({ kind: "ok", text: "\u5168\u5C40\u8BBE\u7F6E\u5DF2\u4FDD\u5B58" }));
                }
              }, "\u4FDD\u5B58")
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            h("p", { className: "dshgp-pane-title", style: { margin: 0 } }, "\u9879\u76EE\u4ED3\u5E93\u7ED1\u5B9A"),
            h("button", {
              className: "dshgp-btn primary",
              onClick: () => {
                const form = emptyForm();
                if (userInput.trim() !== "") form.repoOwner = userInput.trim();
                setEditing({ id: void 0, form });
              }
            }, "\u65B0\u589E\u7ED1\u5B9A")
          ),
          bindings.length === 0 ? h("div", { className: "dshgp-empty" }, "\u8FD8\u6CA1\u6709\u7ED1\u5B9A\uFF0C\u70B9\u51FB\u300C\u65B0\u589E\u7ED1\u5B9A\u300D\u914D\u7F6E\u672C\u5730\u9879\u76EE\u5BF9\u5E94\u7684 GitHub \u4ED3\u5E93\u3002") : h(
            "div",
            { className: "dshgp-roster" },
            bindings.map((b) => h(
              "div",
              {
                key: b.id,
                className: "dshgp-item" + (editing !== void 0 && editing.id === b.id ? " sel" : ""),
                onClick: () => setEditing({ id: b.id, form: formOf(b) })
              },
              h("span", {
                className: "dshgp-dot" + (b.status?.isRepo === true ? " on" : " warn")
              }),
              h(
                "span",
                { className: "dshgp-grow" },
                h("div", { className: "dshgp-name" }, b.name),
                h(
                  "div",
                  { className: "dshgp-meta" },
                  `${b.localPath} \u2192 ${repoLabel(b.repoOwner, b.repoName)}`
                ),
                h("div", { className: "dshgp-status" }, ...statusChips(b.status))
              ),
              h(
                "div",
                { className: "dshgp-item-actions", onClick: (e) => e.stopPropagation() },
                b.id === selectedBindingId ? h("button", {
                  className: "dshgp-btn tiny outline bound",
                  onClick: () => {
                    void act("target.clear", { sessionId }, () => setNotice({ kind: "ok", text: "\u5DF2\u89E3\u7ED1\u5F53\u524D\u4F1A\u8BDD" }));
                  }
                }, "\u5DF2\u7ED1\u5B9A \xB7 \u89E3\u7ED1") : h("button", {
                  className: "dshgp-btn tiny outline",
                  onClick: () => {
                    void act("target.set", { sessionId, bindingId: b.id }, () => setNotice({ kind: "ok", text: `\u5DF2\u7ED1\u5B9A\u300C${b.name}\u300D` }));
                  }
                }, "\u7ED1\u5B9A"),
                h("button", {
                  className: "dshgp-btn tiny outline",
                  disabled: pushing === b.id,
                  onClick: () => {
                    setPushing(b.id);
                    setCommitMessage("");
                    setNotice({ kind: "info", text: `\u300C${b.name}\u300D\u5C06\u6267\u884C add \u2192 commit \u2192 push` });
                  }
                }, "\u63A8\u9001"),
                h("button", {
                  className: "dshgp-btn tiny ghost",
                  onClick: () => {
                    void act("binding.probe", { id: b.id }, () => setNotice({ kind: "ok", text: `\u300C${b.name}\u300D\u72B6\u6001\u5DF2\u5237\u65B0` }));
                  }
                }, "\u5237\u65B0"),
                h("button", {
                  className: "dshgp-btn tiny danger",
                  onClick: () => {
                    if (window.confirm(`\u5220\u9664\u7ED1\u5B9A\u300C${b.name}\u300D\uFF1F`) !== true) return;
                    void act("binding.remove", { id: b.id }, () => setNotice({ kind: "ok", text: `\u300C${b.name}\u300D\u5DF2\u5220\u9664` }));
                  }
                }, "\u5220\u9664")
              )
            ))
          ),
          h(
            "div",
            { className: "dshgp-hint-row" },
            h(
              "p",
              { className: "dshgp-hint" },
              bindings.length === 0 ? "\u914D\u7F6E\u300C\u65B0\u589E\u7ED1\u5B9A\u300D\u5C06\u672C\u5730\u9879\u76EE\u63A8\u9001\u5230 GitHub \u4ED3\u5E93\uFF1BToken \u5B58\u672C\u673A\u3001\u754C\u9762\u4E0D\u663E\u793A\u3002" : "\u70B9\u300C\u63A8\u9001\u300D\u6267\u884C git add \u2192 commit \u2192 push\uFF1B\u7EBF\u4E0A\u4ED3\u5E93\u88AB\u5176\u4ED6\u4EBA\u6539\u52A8\u65F6\u9700\u5148\u672C\u5730\u540C\u6B65\u3002"
            )
          ),
          pushing !== void 0 && (() => {
            const b = bindings.find((x) => x.id === pushing);
            if (b === void 0) return null;
            return h(
              "div",
              { className: "dshgp-push" },
              h(
                "div",
                { className: "dshgp-push-title" },
                h("span", { className: "dshgp-dot warn" }),
                h("span", { className: "dshgp-grow" }, `\u63A8\u9001\u300C${b.name}\u300D\u5230 ${repoLabel(b.repoOwner, b.repoName)}\uFF08\u5206\u652F ${b.branch}\uFF09`)
              ),
              h(
                "label",
                { className: "dshgp-field" },
                "\u63D0\u4EA4\u8BF4\u660E\uFF08\u7559\u7A7A\u7528\u9ED8\u8BA4\uFF09",
                h("input", { value: commitMessage, onChange: (e) => setCommitMessage(e.target.value), placeholder: "chore: DSH sync" })
              ),
              h(
                "div",
                { className: "dshgp-push-actions" },
                h("button", {
                  className: "dshgp-btn ghost",
                  onClick: () => setPushing(void 0)
                }, "\u53D6\u6D88"),
                h("button", {
                  className: "dshgp-btn primary",
                  onClick: () => {
                    const id = pushing;
                    void act("push", { id, commitMessage: commitMessage.trim() }, (data) => {
                      setPushing(void 0);
                      setCommitMessage("");
                      setNotice({ kind: "ok", text: `\u63A8\u9001\u6210\u529F\uFF1A${data.commitMessage}` });
                    });
                  }
                }, "\u786E\u8BA4\u63A8\u9001")
              )
            );
          })(),
          editing != null && h(BindingForm, {
            key: editing.id ?? "new",
            editing,
            onCancel: () => setEditing(void 0),
            onSubmit: (args, message) => {
              void act("binding.upsert", { input: args }, () => {
                setEditing(void 0);
                setNotice({ kind: "ok", text: message });
              });
            },
            setNotice
          })
        )
      )
    ),
    document.body
  );
}
function BindingForm(props) {
  const { editing, onCancel, onSubmit } = props;
  const [form, setForm] = useState(editing.form);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const argsOf = () => {
    const input = { ...form };
    if (editing.id !== void 0) input.id = editing.id;
    if (input.token === "") delete input.token;
    return input;
  };
  return h(
    "div",
    { className: "dshgp-form" },
    h("p", { className: "dshgp-pane-title" }, editing.id === void 0 ? "\u65B0\u589E\u7ED1\u5B9A" : `\u7F16\u8F91\u300C${editing.form.name}\u300D`),
    editing.id !== void 0 && h(
      "p",
      { className: "dshgp-edit-warn" },
      "\u6B63\u5728\u7F16\u8F91\u5DF2\u6709\u7ED1\u5B9A\uFF0C\u4FDD\u5B58\u5C06\u66F4\u65B0\u6B64\u8BB0\u5F55\uFF08\u4E0D\u4F1A\u65B0\u5EFA\uFF09"
    ),
    h(
      "div",
      { className: "dshgp-grid" },
      h(
        "label",
        { className: "dshgp-field" },
        "\u7ED1\u5B9A\u540D\u79F0",
        h("input", { value: form.name, onChange: set("name"), placeholder: "\u4F8B\u5982\uFF1ADSH-ops" })
      ),
      h(
        "label",
        { className: "dshgp-field" },
        "\u672C\u5730\u9879\u76EE\u8DEF\u5F84",
        h("input", { value: form.localPath, onChange: set("localPath"), placeholder: "E:/DSH/DSH-ops" })
      ),
      h(
        "label",
        { className: "dshgp-field" },
        "GitHub \u7528\u6237\u540D / \u7EC4\u7EC7",
        h("input", { value: form.repoOwner, onChange: set("repoOwner"), placeholder: "owner" })
      ),
      h(
        "label",
        { className: "dshgp-field" },
        "\u4ED3\u5E93\u540D",
        h("input", { value: form.repoName, onChange: set("repoName"), placeholder: "repo" })
      ),
      h(
        "label",
        { className: "dshgp-field" },
        "\u76EE\u6807\u5206\u652F",
        h("input", { value: form.branch, onChange: set("branch"), placeholder: "main" })
      ),
      h(
        "label",
        { className: "dshgp-field" },
        "GitHub Token\uFF08\u7559\u7A7A\u4E0D\u6539\uFF09",
        h("input", { type: "password", value: form.token, onChange: set("token"), placeholder: "ghp_\u2026 / github_pat_\u2026" })
      )
    ),
    h(
      "div",
      { className: "dshgp-form-actions" },
      h("button", {
        className: "dshgp-btn primary",
        onClick: () => onSubmit(argsOf(), editing.id === void 0 ? "\u7ED1\u5B9A\u5DF2\u4FDD\u5B58" : "\u7ED1\u5B9A\u5DF2\u66F4\u65B0")
      }, editing.id === void 0 ? "\u4FDD\u5B58" : "\u4FDD\u5B58\u66F4\u6539"),
      h("button", { className: "dshgp-btn ghost", onClick: onCancel }, "\u53D6\u6D88")
    )
  );
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
        if (typeof details.stderr === "string") err.stderr = details.stderr;
      }
      throw err;
    }
    return result.value;
  };
  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register({
    name: SLOT_NAME,
    id: "github-push",
    order: 40,
    inject: () => ({ call })
  }, GhEntry));
}
return module.exports; } });
