---
date: "2026-09-07T10:05:18.444Z"
symptom: "任务奖励消息显示「获得道具「」x70」（道具名空）"
component: "banmu-server/sysmsg.js"
severity: "major"
status: "fixed"
root_cause: "exp 奖励类型（key 恒空）新增后未同步登记系统消息渲染分支，落入 item 分支以空 key 渲染。"
fix: "renderRewardText 增加 type==='exp' 分支；历史坏消息批量修正。"
related_files:
  - "banmu-server/sysmsg.js"
---

用户反馈奖励消息「获得道具「」x70」——道具名空。根因：上一轮任务等级改造给日常/主线 rewards 新增 {type:'exp', key:'', amount:N}；sysmsg.renderRewardText 未登记 exp 类型，落入 item 分支 → key 为空（exp 的 key 恒为 ''）渲染「获得道具「」x70」。d005 花园打理（元宝5+经验70）触发。修复：renderRewardText 加 exp 分支返回「获得经验+N」；并将历史坏消息 REPLACE 修正（2 条）。验证：重置 d005 后领取渲染「获得元宝x5、获得经验+70」。教训：新增 reward 类型必须同步登记发奖/渲染/校验三处。
