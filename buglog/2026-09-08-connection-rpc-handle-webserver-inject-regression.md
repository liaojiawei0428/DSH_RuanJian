---
date: "2026-09-08T13:50:00.000Z"
symptom: "DSH 重启失败：服务绑定 3080 后立即死亡，3+3 次尝试全部失败（G3 自动隔离误伤 dsh-github-push 两次，服务最终宕机）。err.log 报：failed to apply loader entry server-ssh (dsh-server-ssh): cannot get property \"webServer\" without inject。"
component: "packages/client/connection（上游回归）/ dsh-server-ssh"
severity: "critical"
status: "fixed"
root_cause: "更新（0.1.3-alpha.2，pi-ai 0.85 同期）把 connection 插件的 inject 从 ['webServer','credentials'] 改为 ['credentials']，/api 路由改为 ctx.inject(['webServer']) 懒注入——但 HostConnectionService.register()（rpc.handle 路径）仍执行 owner.effect(() => owner.webServer.register(route))，owner 为 connection 插件自身 ctx，其 fiber 链已不再声明 webServer → Cordis 守卫抛 'cannot get property webServer without inject'。in-repo 唯一 rpc.handle 消费方是 dsh-server-ssh（本地插件，web profile 用）；api-gateway 用 rpc.intercept（不碰 webServer）故未暴露。最小复现：credentials+webserver+connection+测试插件调用 rpc.handle 即抛错；在插件侧 inject 声明 webServer 无效（守卫查 owner fiber 链，实测仍抛）。"
fix: "packages/client/connection/src/rpc-host.ts 一行：register() 内 owner.webServer.register(route) → owner.root.webServer.register(route)（webServer 为根服务；lib/index.js 同步手工修补，lib 为 gitignore 构建产物，下次全量构建自动带修复）。验证：最小复现通过 rpc.handle 不抛错；重启后服务正常，/dsh-server-ssh 通道 200，settings/describe 与 llm/listProviders OK，err.log 空，10 插件全载。dsh-server-ssh 与 dsh-github-push 均无辜（启动失败 100% 是 connection 回归），已恢复。注意：src 变更会使下次 update-dsh.ps1 工作区干净检查失败——上游修复前需保留此文件（或更新后重打此一行补丁）。"
related_files:
  - "E:\\DSH\\Deepseek_DSH\\packages\\client\\connection\\src\\rpc-host.ts"
  - "E:\\DSH\\Deepseek_DSH\\packages\\client\\connection\\lib\\index.js"
---

排查路径：err.log 定位 dsh-server-ssh → 对比新旧 connection src（git diff d347e70390..c389f96bf3）发现 inject 重构 → 最小挂载复现（credentials+webserver+connection+测试插件）→ 修正前经验测试有缺陷（webServer 未挂载时 fiber 永不执行被超时误判），挂载真实 webServer 后稳定复现 → 测试 owner.root 方案通过 → 同步 src+lib。上游本质：connection 重构了自身 /api 挂载为懒注入，但漏改了 rpc.handle 的 register() 路径，破坏所有第三方 rpc.handle 消费者。G3 定位器两次误判 dsh-github-push（err.log 匹配偏差）——本次两个插件均无罪。恢复 dsh-server-ssh/dsh-github-push 均已回 bundles。