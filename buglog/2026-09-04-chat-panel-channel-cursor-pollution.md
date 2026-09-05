---
date: "2026-09-04T03:05:52.549Z"
symptom: "私聊/公会停留期间世界消息丢失且世界消息误入当前频道"
component: "godot client world_chat_panel.gd"
severity: "major"
status: "fixed"
root_cause: "多频道共享单一 _last_seq 游标且 WS/poll 无频道守卫。"
fix: "世界专用游标 _world_last_seq + poll/WS 频道守卫 + 切回世界续用游标。"
related_files:
  - "scripts/ui/chat/world_chat_panel.gd"
---

客户端 GDScript 审查发现频道串扰双缺陷：①WS message 分支无频道守卫——私聊/公会频道停留时收到世界 WS 广播会渲染进当前列表且 _last_seq 被世界 id 覆盖；②_do_poll 备轮询不区分频道，since=_last_seq 会被私聊/公会历史加载污染（其 DB id 全局自增远大于世界 id）→ 世界新消息在停留期间全部丢失，切回世界靠 history 50 条兜底，超 50 条会漏。修复：新增 _world_last_seq 世界专用游标（切频道不重置）；WS message 分支 system→横幅、仅 _channel==CHANNEL_WORLD 渲染并推进 _last_seq、任何频道都推进 _world_last_seq；_do_poll 开头 if _channel != CHANNEL_WORLD return 且 since 用 _world_last_seq；_on_poll_completed 同步推进；切回世界 _last_seq = _world_last_seq 不硬设 -1；hb 报文 seq 改发 _world_last_seq。python 静态检查通过。
