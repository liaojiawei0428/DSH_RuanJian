---
date: "2026-09-04T03:05:52.060Z"
symptom: "未登录者可伪造系统公告横幅并污染 system 频道"
component: "banmu-server fuwuqi.js"
severity: "critical"
status: "fixed"
root_cause: "channel_type 无白名单，客户端可伪造 system 频道消息。"
fix: "channel_type 固定 'world'，删除客户端可控赋值。"
related_files:
  - "banmu-server/fuwuqi.js"
---

服务端审查发现：/world_chat/send 的 channel_type 无白名单（任意非空字符串 slice 后直接落库并进 WS 广播队列）——传 channel_type='system' 时消息以 system 落库、WS 广播后新客户端显示为系统红字公告横幅、后台 system Tab 出现伪造记录，完全绕过 GM 令牌（伪造 system 只需普通 HTTP POST）。修复：channel_type 固定取 'world'（服务器不可由客户端控制），system 只走 GM /api/gm/broadcast，private/guild 走 /api/chat/send。线上实测伪造 system 发送成功但落库 channel='world'（表级确认），system 频道无伪造记录。
