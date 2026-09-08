---
date: "2026-09-07T10:27:44.583Z"
symptom: "早期剧情任务「渡口旧信」要求 28 级才能接取"
component: "banmu-server/content_update.js"
severity: "major"
status: "fixed"
root_cause: "等级分配按 quest_id 前缀把 E01-E04 全配到 28-30 级区间，忽略 E 系列发现任务按阶段分布（E01 属阶段1 场景 SC-01）。"
fix: "fix_e_level.js：E 系列按前缀阶段区间重配等级；全量复查 main 任务等级分布。"
related_files:
  - "banmu-server/fix_e_level.js"
  - "banmu-server/content_update.js"
---

用户反馈早期剧情任务「[发现]渡口旧信」需 28 级才能接取。排查：该任务 E0101 触发场景 SC-01 青梧渡口（开局场景），却被等级分配逻辑按前缀 E01 归入 [28,30] 区间。根因：content_update.js 的 LEVEL_RANGES 把 E 系列（E01-E04）当作结局末期任务统一给 28-30 级，但 E 系列实为各阶段「发现/回忆收集」支线（E0101 渡口旧信属阶段1）。修复：新增 fix_e_level.js，按前缀对应剧情阶段重配 E 系列等级（E01 1-10、E02 8-20、E03 15-27、E04 20-30，前缀内按 order 线性细分），24 任务更新 23 变更（E0101 28→1）；并全量复查 main 119 个任务（H01 1-10/H02 8-20/H03 15-27/H04 20-30/E 对齐阶段，最高 30）。验证：E0101 在 6 级玩家可正常领取。教训：按前缀分区设限前须核对前缀与剧情阶段对应；早期场景任务不得配高等级。
