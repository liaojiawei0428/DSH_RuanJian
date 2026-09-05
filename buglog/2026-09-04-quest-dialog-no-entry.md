---
date: "2026-09-04T09:43:21.763Z"
symptom: "任务状态正确但剧情对话始终不显示"
component: "banmu-admin/web 文字版前端"
severity: "major"
status: "fixed"
root_cause: "前端场景弹窗任务列表只认 scene_trigger_map 挂载（H 主线 trigger.scene 未合并），且任务页无剧情查看入口，story_dialog 虽有下发却无展示路径。"
fix: "sceneQuests 合并 trigger.scene 关联 + 任务页「查看剧情」按钮与弹窗 + 修 el-dialog 插入位置破坏 v-else-if 链。"
related_files:
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈"任务状态正确，但还是没有剧情对话显示"。排查：view 早已下发 story_dialog（999 的 H0101 对白 4 行、E 类 1 行均验证在数据里），但前端展示缺两处：(1) 场景弹窗的任务列表 sceneQuests 仅按 scene_trigger_map 挂载过滤——H 主线链只配了 quest_defs.trigger.scene（未挂 scene_trigger_map），打开对应对白场景弹窗时剧情任务根本不在列表里，sceneDialogLines 自然为空；(2) 任务页行从未提供剧情查看入口（只显示描述/进度/领取按钮）。修复：sceneQuests 合并 trigger.scene==当前场景的任务；任务页 questDoing/questReady 行新增「查看剧情」按钮（story_dialog 非空时）→ 剧情对白弹窗（speaker:text 逐条 + completed 时内联领取按钮）；抽取 storyLinesOf 复用于场景弹窗与剧情弹窗。另修一处模板缺陷：新增 el-dialog 误插到 template v-if 与 el-empty v-else-if 链之间导致 vite 构建失败（v-else-if has no adjacent v-if），移入根 div 末尾后构建通过。验证：构建成功部署，SC-15 场景 active/completed 剧情任务含对白、H0101 查看剧情数据完整、H0204 因前置未领保持 locked 不误显示。
