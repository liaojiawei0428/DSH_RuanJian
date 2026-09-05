---
date: "2026-09-04T08:45:49.835Z"
symptom: "文字版任务无剧情对话、状态陈旧不及时、场景挂载任务无法激活领取"
component: "banmu-admin/logic view + 文字版前端"
severity: "major"
status: "fixed"
root_cause: "任务状态权威在游戏服引擎（ren_wu 事件驱动），后台 view 直读快照且不触发引擎激活路径，前端也无场景进入触发，导致状态显示陈旧、挂载任务不激活、剧情对白字段未下发。"
fix: "view 补 story_dialog + 只读状态投影；前端场景弹窗/任务页自动 scene_visit 触发引擎并静默刷新；弹窗渲染剧情对白并按状态出领取/进度/解锁标签。"
related_files:
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈：任务无剧情对话展示、领取/完成不合理、状态显示不及时。排查：quest_defs 已存 114 个任务的 story_dialog（[{speaker,text,...}]），游戏服 scene_visit 已触发 quest_engine 场景激活（_activateByScene）与推进，但（1）后台 logic.view 的 quests 查询未 SELECT story_dialog，前端拿不到对白；（2）view 直接读 players.ren_wu 快照，不执行引擎状态机语义——首条主线/日常懒初始化、空 objectives 任务"激活即 completed"、level 目标校准等只在引擎路径发生，快照显示陈旧；（3）前端从未自动触发 scene_visit，场景挂载的 locked 任务永远不激活。修复：view SELECT 补 story_dialog 并做只读状态投影（无实例→首条主线 active/日常 active、空 objectives→completed、level 目标按玩家等级校准判完成，不写库）；前端打开场景弹窗与进入任务页时静默调用 scene_visit（触发引擎激活/推进）后刷新 view；弹窗顶部渲染剧情对白、completed 才显示领取、active 显示目标进度文本、claimed 收已完成。验证：test_user_999 打开 SC-01（挂 E0101/E0106）→ scene_visit → view 中 E0101 completed 且对白 1 行 → quest_claim 成功；E0106 未解锁时领取被 400 拒绝（服务端权威）。
