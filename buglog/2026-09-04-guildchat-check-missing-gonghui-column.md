---
date: "2026-09-04T02:29:38.060Z"
symptom: "公会频道发送校验引用不存在的 players.gonghui 列将 500"
component: "banmu-server fuwuqi.js + game_actions.js"
severity: "major"
status: "fixed"
root_cause: "凭客户端键名推断 players 表存在 gonghui 列，实际无此列；公会权威数据在游戏服内存，不在 players 表。"
fix: "用 game_actions 导出的 isGuildMember（读 global.__guilds_map）替换不存在的 players.gonghui 查询；guild_id 列改 VARCHAR(24)。"
related_files:
  - "banmu-server/fuwuqi.js"
  - "banmu-server/game_actions.js"
  - "banmu-admin/server/src/modules/chat/chat.service.ts"
---

设计 /api/chat/send 公会频道校验时误以为 players 表有 gonghui 列，写了 SELECT gonghui FROM players，实际该列不存在（gonghui 是客户端本地键，被 SAVE_DATA_STRIP_KEYS 剥离，服务端从不落库）→ 公会频道发送将 SQL 500。公会权威数据在游戏服内存 global.__guilds_map（启动从 data/guilds.json 加载）。修复：game_actions.js 新增导出 getGuildById/isGuildMember 读内存 Map 校验成员；/chat/send 改用 gameActions.isGuildMember(rawGuildId, openid)。同时 chat_messages.guild_id 由 BIGINT 改 VARCHAR(24) 存字符串公会 id（g_10004），chatInsertRow/queryChatHistory/后台 chat.service/players.service 同步字符串传参。验证：成员发送成功 id=20、非成员 403、guild 历史按 g_10004 正确过滤。
