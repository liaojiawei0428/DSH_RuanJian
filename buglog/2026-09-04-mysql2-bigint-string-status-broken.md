---
date: "2026-09-04T03:05:52.381Z"
symptom: "聊天时间显示 NaN、永久禁言被误判未禁言"
component: "banmu-admin-server chat.service"
severity: "major"
status: "fixed"
root_cause: "mysql2 BIGINT 列以字符串返回，严格相等/日期构造失效。"
fix: "chat.service 返回前 Number() 化 id/ts/until，前端 timeOf/until 比较也 Number() 兜底。"
related_files:
  - "banmu-admin/server/src/modules/chat/chat.service.ts"
  - "banmu-admin/web/src/views/chat/index.vue"
---

后台 web 审查+实测发现：mysql2 的 BIGINT 列（id/ts/until）以字符串返回 → ①聊天管理页 timeOf 对字符串时间 new Date('1788...') Invalid Date → 时间列 NaN:NaN:NaN；②reloadPunish 的 r.until === 0 严格相等对字符串 "0" 恒 false → 永久禁言/封号被误判为"未禁言"。修复双保险：服务端 listMessages/listPunishments 返回前统一 Number() 转换（id/ts/until），guild_id 等字符串列保持 string；前端 timeOf 与 until 比较全部 Number() 兜底。线上验证 typeof id==='number'、until===0 && typeof until==='number' 通过，永久禁言状态显示正常。
