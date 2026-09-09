---
date: "2026-09-08T10:42:31.125Z"
symptom: "「个人部署层」设置页点击按钮报 `transport failure for /dsh-personal-hub/status: HTTP 405`（RPC 通道未注册）"
component: "dsh-personal-hub + validate-plugins 闸门"
severity: "major"
status: "fixed"
root_cause: "两处叠加：(1) 可选服务用 ctx.get 同步读取不等待挂载时机，服务尚未就绪时永久跳过注册；(2) 闸门 mock 与真实 Cordis 的属性/懒注入语义不一致，无法提前发现该缺陷。"
fix: "personal-hub/index.js 改懒注入 + connectionCtx.get；validate-plugins.mjs mockContext 支持 ctx.get 返回 mock 服务与 ctx.inject。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
---

用户打开「设置 → 插件 → 个人部署层」点击「重新检查」报错 `transport failure for /dsh-personal-hub/status: HTTP 405`。诊断：用 Node fetch 带 cookie 对三个通道发同一份平台信封 POST——/dsh-server-ssh/state 200、/dsh-github-push/state 200、/dsh-personal-hub/status 405（空 body），证明 personal-hub 的 RPC 通道根本没注册，405 来自 SPA fallback（未知 POST 路径）。根因一（时序）：host 半用 `const connection = ctx.get('connection'); if (connection !== undefined) {...}`，而 `ctx.get` 不等待服务——apply 执行时 connection 行可能尚未挂载，读回 undefined 后永久跳过注册；server-ssh/github-push 之所以正常是因为它们用 `inject: ['connection']`（硬依赖，Cordis 等待就绪）。修复：改为官方懒注入模式 `if (ctx.get('connection') === undefined) ctx.inject(['connection'], registerRpcChannel); else registerRpcChannel(ctx)`，回调内用 `connectionCtx.get('connection')` 取服务（不依赖属性代理）。根因二（闸门与运行时不一致）：闸门 mockContext 的 `ctx.get` 恒返回 undefined、且 Proxy 只认 `export const inject` 声明的属性，导致真实可用的懒注入写法在闸门里必抛 `cannot get property ... without inject`（真实 Cordis 的 reflect.ts 属性 trap 先查服务实现，找到即返回，未就绪才抛）。修复闸门两处：ctx.get 改为按 mock 服务存储返回；新增 ctx.inject 支持（名字齐全时以临时声明的 ctx 调回调，否则跳过——与真实语义一致）。验证：node --check 通过；validate-plugins 10/10；test-standard 4/4。
