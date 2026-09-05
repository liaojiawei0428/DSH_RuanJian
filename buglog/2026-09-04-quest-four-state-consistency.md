---
date: "2026-09-04T11:16:07.715Z"
symptom: "任务四态（接取/进行中/完成/领取）全链路双端不一致：剧情任务可绕过对白直接领取、投影判可领但引擎领取被拒、首条主线判定过宽"
component: "banmu-server 任务引擎 + banmu-admin 投影/前端"
severity: "major"
status: "fixed"
root_cause: "后台只读投影与游戏服权威写库判定语义未逐条对齐：投影做了引擎尚未落库的补判（level/空目标/daily），而 claim 校验读引擎已写库状态，导致\"显示可领却被拒\"；前端领取入口分散未统一 gate。"
fix: "引擎 claim 前补判追平投影；投影对齐引擎 ensure（首条主线唯一化+补偿解锁+日常跨天重置）；前端领取入口统一 dialogueFinished/dialogueLoading gate 收口。"
related_files:
  - "banmu-server/quest_engine.js"
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户要求深度检查接任务/进行中/完成/领取奖励全链路。审计脚本对比后台 view 投影与引擎 ren_wu 实际状态：888 零差异，999 的 12 处均为 locked/no_inst 良性差异，说明数据层基本一致，真正问题在交互收口与补判时序。发现五处缺陷：①任务页"可领取"行对剧情任务无条件挂领取按钮可绕过对白；②场景弹窗打开瞬间对白未加载即放行领取；③投影判 completed 的 level 型/空目标任务，引擎 claim 时 inst 仍 active 被拒"任务尚未完成"（claim 不跑 calibrate/空目标补判，而文字版不走 /api/quests 的 prepareQuestList）；④投影把所有无前置 main 一律判 active，与引擎"仅首条主线 active 其余 locked 等场景激活"不符；⑤投影缺补偿解锁与日常跨天重置。修复：引擎 claimQuest 领取前补判（dailyReset+calibrate+空objectives场景命中）追平投影；投影预计算 firstMainId 唯一化首条主线、加补偿解锁与 daily 跨天重置；前端任务页有对白改"查看剧情"（弹窗看完才领）、场景弹窗加 dialogueLoading gate、按钮文案统一"领取奖励"。端到端验证 999 四态正确、领取 H0101 ok→claimed 且 H0102 解锁 active、999/888 投影vs引擎差异归零。
