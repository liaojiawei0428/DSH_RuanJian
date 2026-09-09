---
date: "2026-09-08T10:38:44.695Z"
symptom: "personal_hub_reapply 执行期间整个 DSH 服务冻结（所有会话与 Web 界面无响应），直到 pnpm install 结束"
component: "dsh-personal-hub"
severity: "major"
status: "fixed"
root_cause: "reapply 用 spawnSync 同步等待 pnpm install，阻塞事件循环（工具调用期间服务冻结）；接入 RPC 后该阻塞会直接表现为 GUI 无响应。"
fix: "index.js：spawnSync → 异步 runPnpmInstall + async reapply + 工具 execute await；新增 RPC 通道与设置页；client.js 新增 PersonalHubPage。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\client.js"
---

为个人部署层新增设置页（settings.plugins.tab）时发现：personal_hub_reapply 的 reapply() 用 spawnSync 同步执行 pnpm install，会阻塞 Node 事件循环——模型调用该工具期间整个服务（所有会话 + Web 服务器）冻结，且计划中的浏览器"一键重建"按钮一旦接入会直接卡死 GUI。修复：抽出 runPnpmInstall(profileDir) 用异步 spawn 包装（Promise + close/error/timeout 三个结算点，超时 kill 并 unref 定时器），reapply 改 async，工具 execute 改为 await reapply(...)（此前 execute 虽标 async 但直接 return 同步结果，改 async 后必须 await，否则返回 Promise 会被 output schema 拒绝）。同时 host 半新增包私有 RPC 通道 /dsh-personal-hub（status/validate/reapply 端点，connection 用 ctx.get 可选读取，缺省不影响工具），client 半新增「设置 → 插件 → 个人部署层」页面消费该通道。实证：Node 探针真实加载 host 半并调用端点——status 返回真实状态、validate 通过、未知端点正确拒绝 UNKNOWN_ENDPOINT；执行 reapply 0.5s 完成且"复检无漂移"。顺带修掉 profile 与清单的 2 项漂移（bundles 顺序、cordis.patch.yml 缺 opencode-session-id 托管条目），status 现为 drift 0。
