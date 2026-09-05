---
date: "2026-09-05T04:13:15.817Z"
symptom: "cordis_inspect_query 带 input 参数调用任何 Client Provider 方法（如 Slots.listSubTree 带 {\"root\": ...}）一律被拒：\"input\" must be an object；无 input 调用正常"
component: "harness-cordis-inspect-query"
severity: "minor"
status: "open"
root_cause: "harness 工具层把 cordis_inspect_query 的可选 input 参数（JSON 对象）在传递给 Provider 前错误序列化，Provider 收到非对象值后 zod 校验拒绝：\"input\" must be an object。"
fix: "尚未修复（open）。方向：检查 harness 工具桥对 cordis_inspect_query 可选参数 input 的类型透传（当前疑似把 JSON 对象参数字符串化后传给 zod 校验，导致 \"input\" must be an object）。修复后用 Slots.listSubTree 带 {\"root\": ...} 回归。"
related_files:
---

排查 SSH/Git 面板"配置丢失"期间发现。无参调用（如 Service.listService、Slots.listSubTree 目录查询）正常；凡带 input 的调用（Slots.listSubTree {"root": "..."}）4 次重试均报同一校验错误，工具调用层的 JSON 对象参数未以对象形态到达 Provider（疑似被字符串化）。影响：无法查询指定 root 的完整 Slot 契约与 occupants，只能依赖无参目录树（输出过长被截断）。调查时被迫改用页面 boot manifest 抓取（token→303→cookie 链）等间接手段绕过。待修：harness 侧 cordis_inspect_query 的 input 参数反序列化；修复后用任一 Provider 的带参方法回归验证。
