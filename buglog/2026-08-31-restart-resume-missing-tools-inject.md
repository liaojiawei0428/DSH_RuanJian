---
date: "2026-08-31T00:00:00.000Z"
symptom: "start-dsh-web.ps1 三次尝试全部失败：dsh-web.err.log 报 `failed to apply loader entry restart-resume (dsh-restart-resume): cannot get property \"tools\" without inject`，插件树加载失败、DSH 服务无法启动。"
component: "dsh-restart-resume"
severity: "critical"
status: "fixed"
root_cause: "dsh-restart-resume/index.js 的 `inject` 只声明了 `['sessionController']`，但 apply 内 `ctx.effect(() => ctx.tools.register(...))` 访问 `ctx.tools`。该 Cordis 版本对未在 inject 声明的属性访问直接抛错（loader 在 apply 前未持行等待 tools 就绪）。对照同仓 dsh-tool-python 声明 `inject = ['tools', 'shell', 'systemPrompt']` 正常。闸门 validate-plugins 对 apply 路径用桩 ctx 执行，桩上 tools 可用，故闸门全绿未拦截——与 2026-08-28 client-capsule-missing-inject-decl 同类教训：闸门验证不了运行时挂载的注入门控。"
fix: "plugins/dsh-restart-resume/index.js：`export const inject = ['tools', 'sessionController']`（tools 为工具注册硬依赖，符合 P3 最小注入语义），同步更新头部 P3 注释。validate-plugins.mjs 7/7 PASS。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
---

排查路径：① dsh-web.err.log 栈顶 `index.js:223:24` → `ctx.effect(() => ctx.tools.register(...))`，报错为 Cordis 属性访问门控 "cannot get property X without inject"。② 对照 dsh-tool-python/index.js:461 `inject = ['tools', 'shell', 'systemPrompt']`，确认 tools 必须在 inject 声明。③ 闸门为何全绿：validate-plugins.mjs 用桩 ctx 执行 apply，桩对任意属性均可访问，注入门控在真实 loader 挂载时才生效。④ 修复后重跑闸门 7/7 PASS。教训：新增注册工具（ctx.tools.register）的插件，inject 必须含 `'tools'`；闸门只证桩路径，不证真实注入。