---
date: "2026-09-04T03:05:51.900Z"
symptom: "Godot 客户端世界聊天发送必 400 静默失败"
component: "banmu-server fuwuqi.js"
severity: "major"
status: "fixed"
root_cause: "客户端发 id 字段而服务端只读 yong_hu_id/openid，跨端字段契约长期不匹配。"
fix: "/world_chat/send 读取改 body.yong_hu_id || body.openid || body.id。"
related_files:
  - "banmu-server/fuwuqi.js"
---

服务端代码审查发现：Godot 客户端世界聊天 body 为 {"id": player_id}，而 /world_chat/send 只读 body.yong_hu_id || body.openid → openid 恒空 → 400 {err:'id'}，真实客户端世界消息发不出去（_on_send_completed 对非2xx静默无提示）。git 核对旧客户端也发 id、旧服务端也读 yong_hu_id/openid，是长期存在的字段不匹配缺陷，本轮聊天重构未对齐。修复：读取改 body.yong_hu_id || body.openid || body.id（一行兼容旧端）。线上实测 {id:'test_user_915'} 发送成功 seq=24。
