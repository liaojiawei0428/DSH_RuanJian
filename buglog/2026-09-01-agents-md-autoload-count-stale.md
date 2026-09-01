---
date: "2026-09-01T09:35:40.913Z"
symptom: "AGENTS.md 声明 Autoload 17 个/15 个 .gd,实际 18 条,与 project.godot 不符"
component: "banmufanghua-docs"
severity: "minor"
status: "fixed"
root_cause: "台账数字手工维护无自动校验,QuestManager/JuQingXiTong 新增后未回写标题与目录清单"
fix: "AGENTS.md §4/§5 数字与目录清单同步修正并提交"
related_files:
  - "AGENTS.md"
  - "project.godot"
---

规范自检发现 §4 写"autoload 15 个 .gd"、§5 标题"17个",而 project.godot [autoload] 实际 18 条(autoload/ 下 16 个 .gd + addons 2 个 tt/MCPRuntimeProbe),因后期新增 QuestManager/JuQingXiTong 未同步数字;§4 目录清单还缺 banmu-admin/data/剧情设计 三个既有目录。修正:§5 标题 18 个,§4 16 个 .gd,补三行目录。重新核对 project.godot 18 条 = §5 18 行,目录全部存在。教训:新增 Autoload 时标题数字无自动校验,易二次漂移。
