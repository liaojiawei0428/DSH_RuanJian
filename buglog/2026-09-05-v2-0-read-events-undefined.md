---
date: "2026-09-05T05:08:09.001Z"
symptom: "升级后深度审查探针显示迁移会话\"v2 读 0 事件\"且\"结构校验全通过\"，两者互相矛盾——最终定位为探针把 read() 的数组返回值当对象解构（.events 恒 undefined）"
component: "dsh-session-persistence-jsonl（验证探针陷阱）"
severity: "minor"
status: "fixed"
root_cause: "诊断探针误用 SessionHandle.read() 的返回类型（数组被当 {events} 对象解构），导致事件计数恒为 0、结构校验空转，产生\"迁移后会话读不出/为空\"的假阴性观感与\"全部通过\"的假阳性结论；产品读取链路（lib decodeStoredLog → readZstdPrefix）实际完全正常。"
fix: "修正验证探针：直接遍历 read() 返回的事件数组（而非 .events 包装），并用正确 API 全量重验 49/49 会话（结构校验真实通过）；确认 v0→v2 事件数剧减为流式 chunk 合并的设计行为（类型分布 1:1 证明无内容丢失）。"
related_files:
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-persistence-jsonl\\src\\storage.ts"
dsh_commit: "d347e703908d"
---

升级后深度审查会话数据完整性时发现：早期探针调用 `await handle.read()` 后取 `read.events` 计算事件数——但 SessionHandle.read() 直接返回事件数组（readonly SessionEvent[]），没有 .events 字段（.events 恒 undefined → 数组长度 0 显示 / 结构校验循环空转全通过）。这使此前多轮"49/49 会话 open+read 全通过 / 事件结构合法"结论为假阳性（空数组下校验不执行）。修正（read() 直接遍历返回数组）后全量重验：49/49 会话读成功、seq 连续、sourceEventSeqs 合法、事件都有 type，真实通过。同一误用也使"v2 读 0 事件"的疑点被错误放大——实际 v2 事件数远小于 v0（40536→4199）是 v1→v2 迁移的设计性基数变化（assistant/chunk 6971 + reasoning-chunks 25811 + text-chunks 3563 被合并进 assistant/message 的 data.stream），类型分布验证显示所有非流语义事件 1:1 保留、assistant/message 内容/usage/source/stream 完整，无内容丢失。本记录为文档化探针契约：JsonlSessionPersistence.open(id,'read').read() 返回事件数组而非包装对象，属验证方法陷阱而非产品缺陷（lib 自身 API 契约正确）。
