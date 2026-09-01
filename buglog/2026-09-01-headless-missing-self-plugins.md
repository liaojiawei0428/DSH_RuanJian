---
date: "2026-09-01T02:53:09.677Z"
symptom: "headless 模式会话缺少全部自研插件：无 D7 工具分工规则注入、无 buglog 工具、无 python 工具——规则与环境只覆盖 web。"
component: "dsh-headless-profile"
severity: "major"
status: "fixed"
root_cause: "headless profile 的 composition（package.json bundles）是独立于 web profile 维护的；此前全局规则强化只覆盖 web profile，headless 从未加入自研插件，导致 headless 会话绕过了\"无论哪个项目统一规则\"的要求。"
fix: "重写 C:\\Users\\Administrator\\.dsh\\profiles\\headless\\package.json：dsh.profile.bundles 置为 [@deepseek-ai/dsh-base, @deepseek-ai/dsh-headless, dsh-bug-log, dsh-locale-language, dsh-tool-python]，dependencies 增加 3 条 link:E:/DSH/DSH-ops/plugins/<name>；pnpm install 后验证 node_modules 3/3 链接生效；node -e 冒烟 import 3 插件全部加载并返回正确 inject 面。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\headless\\package.json"
  - "E:\\DSH\\DSH-ops\\DEPLOY.md"
---

上一会话（2026-09-01 10:15 前后）为兑现"全局规则应用于整个 DSH 环境"的用户要求，发现 headless composition 未同步。执行：备份原 package.json 到 ~/.dsh/backups/20260901-102545-headless-profile/ → 原子重写（bundles 5 项、dependencies 3 条 link）→ pnpm install → 逐 link 验证 node_modules 真实指向 → node -e 冒烟 import 3/3（inject faces：locale=["systemPrompt"]、bug-log=["tools","systemPrompt"]、tool-python=["tools","shell","systemPrompt"]，均 host-side 无 client 依赖）。影响在下次 headless 启动生效；web 服务未动。本条同时清偿 buglog .pending-backfills.json 中 2026-09-01T02:15:48Z 的待补项。
