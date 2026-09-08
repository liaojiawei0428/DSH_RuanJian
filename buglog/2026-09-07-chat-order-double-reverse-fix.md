---
date: "2026-09-07T03:16:11.138Z"
symptom: "聊天板块最新消息显示在顶部、旧消息在底部"
component: "banmu-admin-web"
severity: "major"
status: "fixed"
root_cause: "后端 listMessages DESC 查询后已 reverse 成升序（接口契约），前端 refreshChat 又 reverse 一次导致双重反转"
fix: "index.vue refreshChat 移除 [...rows].reverse()，改为 chatMsgs.value[ch] = rows.slice()"
related_files:
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈聊天框最新消息在顶部、旧消息在底部。排查过程：①先后端 chat.service.listMessages SQL 为 ORDER BY id DESC，前端 refreshChat 有 [...rows].reverse()，推演应正序；②paramiko 实测线上接口 /api/admin/chat/messages?channel=world 返回 id [13,24,25,...,30] 为升序——发现后端 L98-101 在 DESC 查询后执行 rows.reverse()，接口实际对外契约是升序（聊天管理页 chat/index.vue L175 直接消费正序验证此契约）；③本地/线上 dist 对比确认前端产物与源码一致。根因=双重反转：后端已转升序，上一轮聊天常驻板块交付时前端又按「接口 DESC」的旧假设 reverse 一次，变成逆序。修复：index.vue refreshChat 去掉 .reverse()，直接 rows.slice()；后端零改动。验证：npm run build 通过、上传 54 文件后线上逻辑页 chunk index-Duna9iLN.js grep reverse( 计数 0，接口实测升序契约不变。
