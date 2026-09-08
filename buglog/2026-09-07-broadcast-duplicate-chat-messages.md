---
date: "2026-09-07T06:02:09.649Z"
symptom: "发布一次系统公告，chat_messages 出现两条相同记录、系统频道重复显示"
component: "banmu-admin/server/src/modules/chat/chat.service.ts"
severity: "major"
status: "fixed"
root_cause: "broadcastSystem 自己 INSERT chat_messages 后又转发游戏服（游戏服内部再 INSERT），同一条公告两个写点无去重。"
fix: "broadcastSystem 改为纯转发游戏服 /api/gm/broadcast（权威单写点），返回游戏服 id。"
related_files:
  - "banmu-admin/server/src/modules/chat/chat.service.ts"
---

部署好友申请制+系统消息中心时自测发现：发一次系统公告，后台 broadcastSystem 先自己 INSERT chat_messages（id=32），又 gmCall 游戏服 /api/gm/broadcast，游戏服 chatInsertRow 再写一条（id=33），聊天管理页系统频道重复显示同一公告。根因：转发型接口本端和目标端都有落库写点且无去重。修复：broadcastSystem 去掉自写 INSERT，只转发游戏服（游戏服统一写 chat_messages + system_messages 中心 + WS 广播），返回游戏服 id。验证：发布验证公告后 chat_messages 仅 1 条、system_messages 1 条，响应 id 一致（34/34），测试公告已清理。
