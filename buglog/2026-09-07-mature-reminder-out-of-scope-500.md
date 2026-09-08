---
date: "2026-09-07T06:46:29.475Z"
symptom: "check_stage 接口 500 server_error（成熟提醒块引用块外变量）"
component: "banmu-server/game_actions.js"
severity: "major"
status: "fixed"
root_cause: "代码块插入位置超出变量作用域（baseSeed/growthSec 在 if(reached) 块内定义），块外引用抛 ReferenceError。"
fix: "成熟提醒块移至 if(reached) 内、elapsed<growthSec 灾害分支之后；_matureNotified 去重键 uid:slot，种植/收获/铲除/灾害恢复时清除。"
related_files:
  - "banmu-server/game_actions.js"
---

自测操作反馈系统消息（type=action）时，check_stage 连续返回 server_error；游戏服日志显示「游戏操作异常-原因-baseSeed is not defined」。根因：成熟提醒代码块（引用 baseSeed/elapsed/growthSec，它们定义在 if(reached) 块内）被插入到 reached 块外（三重闭合之后）。首次修正又误放进「elapsed < growthSec」未成熟子分支内（成熟提醒永不触发），第二次调整到 reached 块内、灾害分支外才正确。修复后：手动将 zuo_wu_sheng_zhang 置为 1 小时前触发 check_stage → 「成熟提醒」消息出现；二次 check_stage 去重生效；收获正常。教训：向多层嵌套 if 插引用块内变量的代码先核对大括号作用域；server_error 先看 game_stdout.txt stack。
