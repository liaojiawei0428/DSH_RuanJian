---
date: "2026-08-28T09:49:20.805Z"
symptom: "cordis_inspect_query 平台 client、provider Slots、方法 listSubTree 时传 input 对象（如 {\"root\": \"...\"}）恒报 \"input\" must be an object；省略 input 则正常返回紧凑树（同一会话三次复现）"
component: "harness-tool-cordis-inspect-query"
severity: "minor"
status: "open"
root_cause: "harness 工具层对 client 平台 inspect 查询的 input 参数反序列化/校验有缺陷：合法 JSON 对象在到达 Provider 前被判为非对象（host 平台 Service/Event 查询不受影响，疑为 client 查询链路特有）。"
fix: "绕行：依赖无 input 的紧凑树输出获取槽位契约；带 root 的完整查询暂不可用。建议 harness 侧检查 input 参数序列化（对象被拒而省略正常）。"
related_files:
---

背景：胶囊消失排查时需要用 Slots.listSubTree 带 root 查询会话头部 utilities 槽位的完整注册契约，以核对 dsh-deepseek-balance 的注册选项（id/order/label）。无 input 调用返回紧凑树可用；带 input 必拒。绕行：从紧凑树中已包含的槽位契约信息确认了注册协议（conversation.session.header.utilities 为 list 槽、选项 id/order/label），足以完成 client.js 编写；渲染层最终以页面 bundle 内容检查 + 用户目视确认兜底。待 harness 侧修复后可恢复带 root 的精确契约查询。
