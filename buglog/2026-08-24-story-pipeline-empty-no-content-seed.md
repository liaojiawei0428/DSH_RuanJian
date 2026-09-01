---
date: "2026-08-24T03:50:22.671Z"
symptom: "游戏内剧情无变化且后台任务列表无新任务、场景管理为空——链路部署完成但玩家视角零变化"
component: "banmu-server-data"
severity: "major"
status: "fixed"
root_cause: "开发范围只含\"引擎+后台+客户端\"三层管道，未含内容种子化步骤：规划中的 H0101-H0118 剧情任务从未写成数据库记录，场景表建后未导入数据，客户端新逻辑因数据为空永不触发"
fix: "data/quest_defs.json 追加 H0101-H0118+E0101-E0106 共 24 条；seed_story_quests_stage1.js/seed_story_scenes_stage1.js 参数化 upsert 入库并 bump config_versions.quest；quest_engine.js 补 prereq 补偿解锁与空 objectives 校准；ju_qing_xi_tong.gd 拉档后默认 set_scene(SC-04)"
related_files:
  - "banmu-server/data/quest_defs.json"
  - "banmu-server/data/seed_story_quests_stage1.js"
  - "banmu-server/data/seed_story_scenes_stage1.js"
  - "banmu-server/quest_engine.js"
  - "autoload/ju_qing_xi_tong.gd"
---

用户运行游戏反馈三现象：游戏内剧情无变化、后台无新任务、场景管理空。排查（生产 SQL COUNT）证实非代码缺陷：阶段2/3 只交付了管道（编辑 UI+客户端对话框+触发判定），生产 quest_defs 的 line/trigger/story_choices 使用数为 0、H 系列 0 条、scenes/scene_trigger_map 0 行。修复：24 条阶段1剧情任务经 quest_defs.json 单一数据源+参数化种子脚本入库；quest_engine 补补偿解锁与空目标校准；6 场景+6 触发映射入库；客户端拉档后默认上报 SC-04。教训：每轮交付前必须用生产库 COUNT 校验关键表非空，否则用户视角等于零交付。验证：单测 quest_engine 15 断言+game_actions 26 项全过；生产 H/E 24 条在架、scenes=6、map=6、config-version=8。
