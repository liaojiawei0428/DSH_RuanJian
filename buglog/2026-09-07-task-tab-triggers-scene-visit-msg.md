---
date: "2026-09-07T07:23:53.166Z"
symptom: "点击任务功能标签出现「进入场景」系统消息误提示"
component: "banmu-server/game_actions.js"
severity: "major"
status: "fixed"
root_cause: "scene_visit 同时承担「静默状态同步/任务推进埋点」与「真实到访」两种语义，通知做成无条件，同场景静默同步也被通知。"
fix: "scene_visit 通知加条件场景实际变化（sceneId !== scenePrev）才写「进入场景」。"
related_files:
  - "banmu-server/game_actions.js"
---

用户反馈：点击「任务」功能标签（只是功能页非场景）却出现「进入场景」系统操作消息。根因链：logic/index.vue watch(tab) 切任务页触发 silentVisit('') → 用玩家当前 scene_current 调 scene_visit 做状态同步/任务推进埋点；上一轮「操作反馈全接入」给 scene_visit 加「进入场景」通知时做成无条件——同场景重复访问（含静默同步）也写消息。修复：通知加条件 sceneId !== scenePrev（保存原 row.scene_current 后比较），仅场景实际变化才通知。验证：同场景重复 scene_visit 无消息（任务页同步不再打扰）；切换 SC-02 产生「已到达场景：SC-02」；测试数据与场景复位为 SC-06。
