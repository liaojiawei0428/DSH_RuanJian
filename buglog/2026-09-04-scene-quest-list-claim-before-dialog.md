---
date: "2026-09-04T10:30:17.742Z"
symptom: "场景弹窗对话未看完时\"此处事务\"仍显示领取奖励且可直接点击领取"
component: "banmu-admin/web 文字版前端"
severity: "minor"
status: "fixed"
root_cause: "叙事时序只收口演出区动作，底部任务列表按钮未接入同一\"对话完结\"状态。"
fix: "dialogueFinished 统一 gate：底部事务列表 completed 行对话未看完只显示\"看完剧情后可领取\"，看完才出领取按钮。"
related_files:
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈：场景弹窗"此处事务"列表对话还没看完就显示"领取奖励"、可直接点击领取。根因：BUG-140 的叙事时序只收口了演出区动作（dialogueIdx），底部"此处事务"列表的 completed 任务无条件渲染领取按钮。解决：新增 dialogueFinished computed（无对白场景不受限；有对白场景须 dialogueIdx 逐句走完才 true），"此处事务" completed 行在对话未看完时显示"看完剧情后可领取" warning 标签，看完才出现领取按钮；演出区与列表统一由该 gate 控制。验证：web 构建通过并部署（54 文件）。
