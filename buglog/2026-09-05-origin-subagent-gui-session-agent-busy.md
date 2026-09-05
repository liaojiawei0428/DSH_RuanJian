---
date: "2026-09-05T03:54:50.615Z"
symptom: "点开子代理会话（origin=subagent 的列表条目）时 GUI 报错崩溃，服务端抛 session/agent-busy；与迁移器故障无关，迁移修复后仍存在"
component: "Deepseek_DSH session navigation（GUI 会话打开链）"
severity: "major"
status: "open"
root_cause: "排查会话记录的现场诊断：父会话目录投影未刷新时，子代理会话列表条目的 navigationAddress 为 undefined，GUI 以 kind:'session' 地址兜底打开，服务端 validateAddress 对该地址组合固定抛 session/agent-busy；根因细节（地址生成时序）未查明，待复现。"
fix: "尚未修复（open）。待定修复方向二选一：列表端在 navigationAddress 缺失时禁止/兜底子会话打开入口，或服务端 validateAddress 放行该地址组合并回以可理解的错误。前置调查：复现父目录投影未刷新的时序，确认 navigationAddress 的生成来源（packages/api/session-controller/src/history.ts 附近）。"
related_files:
dsh_commit: "d347e703908d"
---

来自 2026-09-05-0-1-3-alpha-1-gui-session-follow-session.md 的同日排查（该记录的迁移器部分已由 v0-migration-rejects-historical-shapes 修复关闭，本条拆出其尾部遗留）。与本修复正交：迁移器修复后子会话通过 session/follow 直开（带正确地址）已可读；此条只影响列表点开导航路径。未修原因：导航地址的生成与消费分属列表端与服务端，需先复现父目录投影刷新时序、确认 navigationAddress 的生成来源（packages/api/session-controller/src/history.ts 附近），再决定修法方向。
