---
date: "2026-08-28T02:45:23.630Z"
symptom: "生产 GET /api/scenes 返回的 triggers.period 全部为 null，而数据库内 5 条 R3 时段数据完好"
component: "banmu-server fuwuqi.js"
severity: "major"
status: "fixed"
root_cause: "scene_trigger_map.period 是 MySQL JSON 列，mysql2 自动反序列化后 t.period 已是数组；代码再 JSON.parse(数组) 隐式 toString 变数字（parse([3])===3），Array.isArray 校验失败被误置 null"
fix: "fuwuqi.js /api/scenes period 解析改为双形态兼容：Array.isArray(t.period) 直接采用，字符串才 JSON.parse，重传部署复验通过"
related_files:
  - "banmu-server/fuwuqi.js"
---

部署 GET /api/scenes 后复验发现 triggers 的 period 全部为 null，但直查生产库 period 完好（5 条 R3 时段：E0106[3]/E0304[3]/E0306[3]/E0402[2]/E0406[3]）。根因：scene_trigger_map.period 列是 MySQL JSON 类型，mysql2 驱动自动反序列化为 JS 数组（t.period 已是 [3]），原代码 JSON.parse(数组) 隐式 toString 得到 "3"，parse 后是数字 3，Array.isArray 校验失败被置 null。排查路径：接口返回 null → 怀疑接口解析 → base64 传一次性 node 脚本直查生产库确认数据完好且 mysql2 返回原生数组 → 定位驱动自动反序列化行为。注意 quest_engine.js 侧同源数据经 _parseJsonField（typeof v==='object' 直接返回）天然免疫，无需改动。修复：fuwuqi.js /api/scenes 的 period 解析改兼容双形态——Array.isArray 直接用，字符串才 JSON.parse(String(...))，非数组/空数组置 null。验证：node --check 通过；重传 md5 一致；重启后接口复验 R3 时段条目 E01063/E03043/E03063/E04022/E04063 与库内完全一致。教训：mysql2 对 JSON 列的自动反序列化使「字符串才需要 parse」的假设失效，凡解析疑似 JSON 列必须先判 Array.isArray/typeof。
