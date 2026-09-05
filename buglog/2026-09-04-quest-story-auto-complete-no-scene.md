---
date: "2026-09-04T09:24:46.688Z"
symptom: "任务页满屏\"可领取奖励\"，未到场景的剧情任务（医馆夜话）也能领，主线链跳序"
component: "banmu-server/quest_engine"
severity: "major"
status: "fixed"
root_cause: "任务引擎对空 objectives 剧情任务\"解锁即完成\"（不要求到场景），且场景激活不校验前置链，配合 H 链新配 trigger.scene 后出现全链跳序可领。"
fix: "剧情任务(trigger.scene 配置)的 completed 需当前场景命中；_activateByScene 加前置链校验；内容补配 101 个剧情任务 trigger.scene；后台投影同步场景判定并删无条件完成分支；清理跳序数据。"
related_files:
  - "banmu-server/quest_engine.js"
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈：任务页满屏"可领取奖励"（如医馆夜话，还没到场景看剧情就能领）。根因两点：(1) quest_engine 的 maybeProgressQuests/prepareQuestList 对空 objectives 的剧情任务一律"激活即 completed"（不看 trigger.scene 是否命中、不看是否真到过场景），锁钥解锁链一推，后续剧情任务全部可直接领；(2) _activateByScene 场景激活路径一/二激活任务时不校验 prereq，给 H 链补配 trigger.scene 后，到任意场景会把该场景挂载的未解锁前置任务全部激活（H0109 等在医馆直接 completed，跳过 H 链前置）。修复：(a) 引擎两处完成判定改为——配置 trigger.scene 的剧情任务必须当前场景命中（_needSceneToComplete/_sceneTriggerHit，ctx.scene_id 或 row.scene_current）才置 completed，否则保持 active，前端任务页显示"前往{场景}接取"；(b) _activateByScene 激活前校验前置链（prereq 必须 claimed）；(c) 内容：为 106 个空 objectives 主线任务按标题关键词+手动映射配置 trigger.scene（101 个已配，医馆夜话→SC-15 青梧医馆等）；(d) 后台 view 只读投影同步场景命中判定（读 player.scene_current）且删除无条件"空 objectives→completed"；(e) 数据清理 12 个跳序 completed/active 实例。验证：999 在 SG-15 时 H0109/H0204 保持 locked（前置未领）；H0101（无前置）到 SC-01 后 completed 且对白 4 行下发；E0104（无前置）在医馆 completed；任务页不再满屏"可领取"（888：claimed 34/active 2/locked 83，completed 0）。
