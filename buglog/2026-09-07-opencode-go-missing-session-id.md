---
date: "2026-09-07T13:05:00.000Z"
symptom: "DSH 会话调用 opencode-go 套餐模型全部失败 400: {\"type\":\"MissingSessionID\",\"message\":\"Error from provider (Console Go): Request is missing x-opencode-session ...\"}。所有 Go 套餐模型不可用，非 Go 套餐模型正常。"
component: "dsh-opencode-session-id（新插件，修复用）"
severity: "critical"
status: "fixed"
root_cause: "opencode.ai 网关（OpenCode Go）自 2026-09-05 起强制要求所有出站推理请求携带 x-opencode-session 头（每会话一个稳定 ID，用于路由与 prompt 缓存优化），缺失即 400 MissingSessionID。DSH 的 pi-ai 适配器（llm-pi-ai）与 pi-ai 库（0.84.x）均不发送该头；官方文档已把 DeepSeek Harness 列入 Known Problematic Clients（discussion #5495，实测所有版本 header 存在率近零）。"
fix: "新增插件 dsh-opencode-session-id（零配置默认生效）：① llm/stream waterfall 监听器捕获 options.sessionId（agent-loop 保证携带，session-<uuid>），在下游流整个迭代期间保持作用域；② 包装全局 fetch，目标 URL 命中 opencode.ai（host 后缀/baseURL 前缀可配）且作用域内有令牌时，把 x-opencode-session 头克隆进请求（不覆盖已有头，body/URL/method 原样）。令牌默认原样发送会话 ID，可选 hashSessionId 改为 SHA-256(uuid)→纯字母数字令牌。实测（真实网关，deepseek-v4-flash）：无头 400 MissingSessionID；带 session-<uuid> 200；带 nanoid8 200。插件通过闸门 10/10、dump-config 组合树含行、服务重启健康、wire 级对照验证（插件路径 200 vs 裸请求 400）。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-opencode-session-id\\index.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-opencode-session-id\\README.md"
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
---

opencode Go 网关 2026-09-03 公告 09/05 起强制 x-opencode-session，Vercel AI SDK / Hermes / OpenClaw / pi 等生态全部被波及（各仓库均有同型 issue）。DSH 侧上游修复跟踪：deepseek-harness discussion #5495。本修复在 wire 层复刻 opencode 客户端自身行为，不依赖上游；插件零配置安装，唯一假设是每个 llm/stream 请求都发生在单会话流式上下文（DSH 循环现状成立）。卸载/禁用插件即恢复原 fetch。验证记录：health-check 全绿；wire 级对照（真实 key + 真实网关）：裸 fetch 400 MissingSessionID → 插件作用域包装后 200。