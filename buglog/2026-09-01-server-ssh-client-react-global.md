---
date: "2026-09-01T00:00:00.000Z"
symptom: "DSH 服务正常启动，但 Web UI 顶部报 `Failed to load plugins: failed to import loader entry d0f21571 (dsh-server-ssh): React is not defined`。"
component: "dsh-server-ssh（自研 SSH 服务器配置插件）client 半端"
severity: "major"
status: "fixed"
root_cause: "plugins/dsh-server-ssh/src/client.js 第 18-20 行直接使用裸全局 `React`/`ReactDOM`（`const h = React.createElement` 等），没有任何 import/require——esbuild 以 external: [react, react-dom] 打 CJS bundle 时不会注入 import，产物第 30-32 行即 `var h = React.createElement;`，浏览器 ESM loader 中 React 不是全局 → 运行期 ReferenceError。对照同仓 dsh-deepseek-balance/client.js 的合规写法 `const React = require('react')`（平台 ModuleLoader 种子表含 react/react-dom，注入的 require 解析它们）。"
fix: "src/client.js 顶部补 `const React = require('react')` 与 `const ReactDOM = require('react-dom')`（与 PLATFORM_MODULES/balance 一致）；node build.mjs 重建后产物第 27-28 行出现 `var React = require(\"react\")` 接线；validate-plugins 8/8 PASS（含 dsh-server-ssh 的 ssh_read/ssh_write/ssh_edit/ssh_list/ssh_glob/ssh_grep/ssh_bash）；-Restart 重启后服务在听、err.log 空；浏览器刷新即可加载新 bundle（内容寻址 rev 更新）。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\client.js"
---

排查路径：① 用户报错为浏览器端 loader 失败，服务端 err.log 为空、闸门 8/8——客户端半端问题，与 2026-08-28 client-capsule-missing-inject-decl 同类（闸门对 client 只做 node --check 语法解析，验证不了浏览器运行期）。② 读 build.mjs：PLATFORM_MODULES 种子表明确含 react/react-dom，esbuild external 后 CJS 产物应留 `require(\"react\")`——但产物 30-32 行是裸 `React.createElement`，说明源码根本没 import。③ 对照 balance client 的 require 写法确认平台契约。④ 修复后重建、验证产物接线、重启服务。教训：写 client 半端必须从平台种子表 require（react/react-dom/cordis 等），不得依赖全局；此类运行期错误闸门语法检查抓不到，只能靠对照平台契约 + 浏览器验证。