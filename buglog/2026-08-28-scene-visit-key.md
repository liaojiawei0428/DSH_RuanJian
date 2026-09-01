---
date: "2026-08-28T02:45:23.575Z"
symptom: "任务需求标记里若出现字典新增操作（如 scene_visit）客户端显示英文 key 而非中文名；个别操作中文名与后台字典不一致（铲除作物/铲除植物、培育扩建/培育室扩建）"
component: "godot ren_wu_kuang event labels"
severity: "minor"
status: "fixed"
root_cause: "客户端标签硬编码与服务端 action_defs.json 是两套人工维护的数据源，字典扩展时只改服务端必然漂移"
fix: "ren_wu_kuang.gd 新增数据派生标签（action_defs.json → _dict_labels，硬编码降级为兜底）+ action_defs.json 拷入客户端数据包 shuju_json_shujubao/"
related_files:
  - "scripts/ui/ren_wu_kuang.gd"
  - "shuju_json_shujubao/action_defs.json"
  - "banmu-server/data/action_defs.json"
---

审查发现 scripts/ui/ren_wu_kuang.gd 的 _EVENT_LABELS 硬编码 21 条事件中文名，与服务端 data/action_defs.json 双源易漂移：字典新增操作（如 scene_visit）客户端显示英文 key；个别译文不一致（铲除作物/铲除植物、培育扩建/培育室扩建）。修复：ren_wu_kuang.gd 新增 _dict_labels 成员与 _load_action_labels()（_ready 开头调用），FileAccess 读 res://shuju_json_shujubao/action_defs.json 解析 actions[].key→name_zh；缺失/解析失败走 Log.warn 并回退硬编码；_objective_label 取值改为 _dict_labels 优先、_EVENT_LABELS 兜底、事件原名最终回退。配套 P2-5a：banmu-server/data/action_defs.json 原样拷贝到 shuju_json_shujubao/action_defs.json（客户端数据包，服务端单一数据源镜像，客户端打包即同步）。缩进自检全 Tab 无空格混入；文件内 21 条硬编码保留作离线兜底不删除。
