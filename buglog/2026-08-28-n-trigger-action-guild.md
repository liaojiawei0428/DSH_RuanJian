---
date: "2026-08-28T02:45:23.523Z"
symptom: "配置「公会捐献×N」等公会类任务或 trigger.action=guild_* 的任务永远无法完成/激活，且后台「玩家操作」流水查不到任何公会操作记录"
component: "banmu-server game_actions guild handlers"
severity: "major"
status: "fixed"
root_cause: "handleGuildAction 各 case 成功路径只有公会数据持久化，未调 mergeQuestProgress 上报任务事件，任务引擎永远收不到 guild_* 事件"
fix: "game_actions.js 五个公会 case 成功路径各插入一行 mergeQuestProgress 埋点（捐献/购买带 item_id，其余计数），部署完成"
related_files:
  - "banmu-server/game_actions.js"
  - "banmu-server/data/action_defs.json"
---

审查发现 action_defs.json 22 个操作码中 5 个公会操作（guild_donate/guild_help_respond/guild_garden_water/guild_garden_harvest/guild_shop_buy）在 game_actions.js handleGuildAction 无任何 mergeQuestProgress 调用：任务引擎收不到事件，配了公会任务的永远不完成；且 guild 类操作未写 player_action_log（log=true 的 guild_donate 也无流水）。修复：在 5 个 case 成功返回前插入 await mergeQuestProgress(pool, uid, row, events, null)——guild_donate 传 {item_id, delta: amount}（带物品与数量），guild_shop_buy 传 {item_id, delta:1}，其余三个传简单计数 1；mergeQuestProgress 内部自带 try/catch 不阻断公会主流程。事件经 maybeProgressQuests 的 _appendActionLogs 按 action_defs.log 决定是否落 player_action_log（guild_donate log=true 自动补齐流水）。验证：node --check 通过；LOCAL_MODE 引擎回归 7 项断言全过。注：guild_help_respond 分支历史上未调 persistGuild 落库（既有行为，g 对象内存态靠后续操作持久化），不在本次范围。
