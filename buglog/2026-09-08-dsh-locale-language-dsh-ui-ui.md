---
date: "2026-09-08T10:33:32.436Z"
symptom: "dsh-locale-language 的\"跟随 DSH UI 语言\"失效：UI 切英文后模型系统提示仍为中文指令"
component: "dsh-locale-language"
severity: "minor"
status: "fixed"
root_cause: "插件用 ctx.settings 访问未在 inject 声明的可选服务，Cordis Guard 抛错被 try/catch 吞成 fallback，导致 UI 语言跟随静默失效（P3 违规）。"
fix: "dsh-locale-language/index.js：activeLocale 改用 ctx.get('settings')，并补充 P3 说明与官方新 order 表注释；闸门复验 10/10。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-locale-language\\index.js"
---

审查 0.1.3-alpha.2 下自研插件适配时发现：dsh-locale-language 的 activeLocale() 用 `ctx.settings?.get?.('locale')` 读取 UI 语言偏好，但插件的 inject 只声明了 ['systemPrompt']，未声明 settings。Cordis Guard 对未声明 inject 的服务属性访问抛 `cannot get property "settings" without inject`（官方多处测试引证该文案），而可选链 ?. 只在值 null/undefined 时短路、不捕获 getter 抛错，因此异常传播到外层 try/catch 被吞掉 → 函数恒返回 FALLBACK_LOCALE('zh')。后果：把 DSH UI 语言切成英文时，模型系统提示里的 locale 段仍输出中文指令，语言跟随功能实际失效（界面语言为中文时因 fallback 恰好一致而不可见）。修复：改用 `ctx.get('settings')?.get?.('locale')`（P3 规定可选服务用 ctx.get 读取并处理 undefined，不写进 inject——写 inject 会让插件在 settings 缺失时整体 pending）。同时更新文件头注释，说明 0.1.3-alpha.2 重构后的官方 order 表（DEPLOYMENT_PERSONA_PREFIX 0 … HARNESS_SOURCE 10000），section order -50 的负值在新体系下位于最前，符合"语言规则最优先"的原意，故保留不改。验证：node --check 语法通过；validate-plugins 10/10 全绿；行为差异仅在 UI 语言设为 en 时可见（提示词 locale 段应输出英文）。
