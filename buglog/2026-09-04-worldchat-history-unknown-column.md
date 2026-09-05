---
date: "2026-09-04T02:29:33.950Z"
symptom: "/world_chat/history 与 poll 返回 server_error 500"
component: "banmu-server fuwuqi.js"
severity: "major"
status: "fixed"
root_cause: "内存对象字段名（channel_type）与 DB 列名（channel）混淆，SELECT 引用不存在列。"
fix: "poll/history 的 SELECT 列名 channel_type 改为 channel，返回映射保持 channel_type 兼容字段。"
related_files:
  - "banmu-server/fuwuqi.js"
---

聊天中枢改造把 /world_chat/poll 与 /world_chat/history 改为读 chat_messages 表后，首次验收 GET /api/world_chat/history 返回 {"ok":false,"error":"server_error"}，而 send 落库正常（表里有数据）。根因：改造时 SELECT 沿用旧内存对象字段名 channel_type，但表列名是 channel（varchar），MySQL 抛 Unknown column。修复：两处 SELECT 列名改 channel，API 返回映射 channel_type: r.channel||'world' 保持旧客户端协议字段。修正后 history 正常返回 seq/ts/openid/nickname/text/channel_type。
