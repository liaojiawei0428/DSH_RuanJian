---
date: "2026-09-08T03:39:27.952Z"
symptom: "request_restart 重启窗口内看门狗误判服务死亡，从 err.log 陈旧痕迹误定位并自动隔离健康插件（10:32 摘 dsh-github-push、11:33 摘 dsh-server-ssh），SSH/GitHub 面板被移出 profile bundles"
component: "DSH-ops 看门狗 G5（watchdog-dsh.ps1）+ dsh-restart-resume"
severity: "major"
status: "fixed"
root_cause: "看门狗 G5 无重启窗口豁免：request_restart/启动链正常停服时端口短暂无监听被误判为服务死亡，随后 Get-BrokenPluginName 从 err.log 尾部正则匹配旧错误行（含健康插件路径痕迹）误定位肇事插件并自动移出 bundles；err.log 中 10:31 更新窗口留下的陈旧错误（pi-ai 0.85 已修问题的痕迹）成为 10:32 和 11:33 两次误隔离的匹配源。"
fix: "watchdog-dsh.ps1 两处修改（均含注释与 BOM）：死亡确认后标记文件豁免 + Get-BrokenPluginName fallback 错误特征过滤；语法复验与逻辑探针验证通过。"
related_files:
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
---

修复已实施并验证：1) watchdog-dsh.ps1 死亡确认后新增"主动重启窗口豁免"——检查 ${DSH_HOME}/restart-resume.json（DSH_HOME 优先、USERPROFILE/.dsh 兜底，与 restart-resume 插件路径一致），标记存在且 <30 分钟（与插件 MARKER_MAX_AGE_MS 一致）则跳过 Get-BrokenPluginName 隔离、直接拉起启动链；过期标记自动删除不豁免。2) Get-BrokenPluginName 的 plugins[\\/] fallback 加固：仅当行同时含错误特征（Error|error|at |throw|failed|FAILED|Cannot|Unhandled）才提取插件名，防普通日志路径行误抓。验证：pwsh 语法解析 OK（补 UTF-8 BOM 后复验）；独立探针模拟两场景——无标记走正常定位、新鲜标记跳过隔离（$broken 为空），均符合预期。副作用：隔离仍可用于真实死亡（err.log 有真错误 + 无重启标记）。注意：当前在岗看门狗(pid 14948)仍是旧逻辑，需下次启动链上岗（任何重启/拉起）时加载新代码；重启窗口豁免依赖 restart-resume 插件先写标记（request_restart 流程不变）。
