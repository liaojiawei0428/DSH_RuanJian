---
date: "2026-09-04T09:51:24.018Z"
symptom: "剧情对白一次性全部列出，无逐句点击推进，接取/领取时序不符合游戏剧情逻辑"
component: "banmu-admin/web 文字版前端"
severity: "minor"
status: "fixed"
root_cause: "对白数据齐备但 UI 用 v-for 平铺且动作随时可用，缺\"进入→对话推进→接取\"的串行叙事交互。"
fix: "场景弹窗与任务剧情弹窗改为叙事式逐句推进（dialogueIdx/storyIdx 点击推进），看完才显示接取/领取动作。"
related_files:
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈：剧情对话逻辑应该是"点击场景→有任务则弹出对话→逐句点击推进→最后接取/完成任务"，当前一次性列表平铺不符合游戏剧情展示逻辑。根因：BUG-139 的展示入口把对白用 v-for 全部列出、动作按钮随时可点，缺少时序交互。解决：场景弹窗改为演出区——打开场景自动弹出首句（dialogueIdx 从 0），点击演出区逐句推进（末句前显示"点击继续 N/M"），全部看完出现动作区（completed「接取任务」/ claimed 已完成 / active 进行中，内存状态；bottom 保留事务列表与再次到访）；任务页「查看剧情」弹窗同步逐句（storyIdx）后接取。验证：构建通过部署；SC-01 演出任务 H0101 completed 对白 4 句逐句推进后出现接取按钮；E0101 已接取、H0204 前置未领保持 locked。
