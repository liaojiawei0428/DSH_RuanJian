---
date: "2026-09-04T03:05:52.216Z"
symptom: "后台公会聊天记录 500 或恒空"
component: "banmu-admin-server chat/players service"
severity: "major"
status: "fixed"
root_cause: "后台误以为 players 表有 gonghui 列（实为客户端本地键），公会权威数据在游戏服内存。"
fix: "新增游戏服 GM /api/gm/player-guild 通道，后台公会对聊天改经该通道取 guild_id。"
related_files:
  - "banmu-server/fuwuqi.js"
  - "banmu-admin/server/src/modules/chat/chat.service.ts"
  - "banmu-admin/server/src/modules/players/players.service.ts"
---

后台 server 审查发现两处引用 players 表不存在的 gonghui 列：①chat.service.listMessages 的 guild+openid 分支 SELECT gonghui → Unknown column 500（聊天管理公会 Tab+openid 过滤触发，3s 轮询演变错误弹窗轰炸）；②players.service.getChatHistory guild 分支 asObject(row.gonghui) 恒 undefined → 好友档案公会聊天记录永远空（静默）。根因：后台不持有 openid→公会映射——gonghui 是客户端本地键，公会权威数据在游戏服内存 global.__guilds_map（BUG-117 只修了游戏服侧）。修复：游戏服新增 GM GET /api/gm/player-guild?openid=（x-gm-token 校验，遍历 __guilds_map），后台两 service 各加 fetchGameGuild（5s 超时）经该通道取 guild_id 再查表；guild_id 全链路 string。线上实测公会+openid 过滤返回 2 条 g_10004 消息且过滤正确。
