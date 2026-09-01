---
date: "2026-09-01T09:35:40.817Z"
symptom: "git 工作区删除 changjing_export_stub/changjing_placeholder.png,若提交则抖音导出包纹理全部缺失"
component: "banmufanghua-changjing_export_stub"
severity: "major"
status: "fixed"
root_cause: "删除时未检索代码引用:占位图是导出插件的运行依赖(替换纹理目标且 uid 需与 .import 一致),§9 勿提交清单被误执行成\"文件可删\""
fix: "git checkout HEAD -- changjing_export_stub/ 恢复占位图+import;AGENTS.md §9 勿提交清单理解澄清(文件须保留工作区)"
related_files:
  - "changjing_export_stub/changjing_placeholder.png"
  - "addons/changjing_export_stub/changjing_export_plugin.gd"
  - "AGENTS.md"
---

项目健康检查 git status 审计发现工作区 D changjing_export_stub/changjing_placeholder.png。addons/changjing_export_stub/changjing_export_plugin.gd 的 STUB_PATH/STUB_UID(uid://s2s4do258wmm) 硬编码引用该占位图,EditorExportPlugin 导出时会把全部 changjing 纹理 ext_resource 替换为它。排查了 git 历史(该文件最后一次在 4-14 备份提交),并核实无生成脚本、无其他复制来源,认定是误删。恢复:git checkout HEAD -- changjing_export_stub/,恢复后 .import 内 uid 与插件 STUB_UID 一致,git status 无该目录变更。其余被删资产(RenLei_Tu/UI_MianBan/tudi_zichan 部分图、modol/ 整体)经 uid 引用核查均无断裂——属重命名(uid 延续)或资产重组,正常提交删除。
