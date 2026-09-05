---
date: "2026-09-04T08:58:24.341Z"
symptom: "文字版任务页所有进行中任务都显示\"可领取奖励\""
component: "banmu-admin/logic view 投影"
severity: "critical"
status: "fixed"
root_cause: "JSON 列返回字符串时 Array.isArray 为 false，投影把 objectives 当空数组，将全部 active 任务投影为 completed。"
fix: "投影改用 parseArr(q.objectives)；前端 objProgressText 先 JSON.parse 字符串目标数组。"
related_files:
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-admin/web/src/views/logic/index.vue"
---

上一轮 BUG-136 修复引入的回归：用户在文字版任务页看到"所有任务都显示可领取奖励"。根因：getView 的 questRows 投影用 `Array.isArray(q.objectives)` 判断目标数组——MySQL JSON 列的裸查询在某些返回路径下是 JSON 字符串（未自动 parse），`Array.isArray('[...]')` 恒 false → objs 空 → 投影分支 `status==='active' && !objs.length → completed`，把所有进行中（active）任务全判成"可领取"。修复：后端投影改用既有 parseArr（兼容字符串/数组两种形态）；前端 objProgressText 增加 parseObjArr 同样解析字符串（进度文本才不丢）。验证：test_user_999 修复后 active 5 保持"进行中"（d001 每日播种进度 0 显示）；test_user_888 回归 claimed 31/locked 87/completed 1 正常。教训：MySQL JSON 列经 ds.query 返回形态不稳定（对象数组或字符串），凡 JSON 列一律先兼容解析再判断。
