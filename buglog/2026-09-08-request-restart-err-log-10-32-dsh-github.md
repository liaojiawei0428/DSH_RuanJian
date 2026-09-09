---
date: "2026-09-08T03:37:27.552Z"
symptom: "request_restart 重启窗口内看门狗误判服务死亡，从 err.log 陈旧痕迹误定位并自动隔离健康插件（10:32 摘 dsh-github-push、11:33 摘 dsh-server-ssh），SSH/GitHub 面板被移出 profile bundles"
component: "DSH-ops 看门狗 G5（watchdog-dsh.ps1）+ dsh-restart-resume"
severity: "major"
status: "open"
root_cause: "看门狗 G5 无重启窗口豁免：request_restart/启动链正常停服时端口短暂无监听被误判为服务死亡（连续 2 次 30s 探活落空），随后 Get-BrokenPluginName 从 err.log 尾部正则匹配旧错误行（含健康插件路径痕迹）误定位肇事插件并自动移出 bundles；err.log 中 10:31 更新窗口留下的陈旧错误（pi-ai 0.85 已修问题的痕迹）成为 10:32 和 11:33 两次误隔离的匹配源。"
fix: "等待与 watchdog-dsh.ps1 修复一起实施（重启标记豁免 + err.log 时间过滤）。当前已先手动把 dsh-server-ssh/dsh-github-push 原子写回 profile bundles（validate-plugins 10/10 PASS），重启窗口内看门狗仍可能再摘——需修复 watchhound 逻辑后彻底解决。"
related_files:
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
  - "E:\\DSH\\DSH-ops\\disable-plugin.mjs"
---

时间线：09-08 10:31 自动更新到 0.1.3-alpha.2（pi-ai 0.85.1 升级）后服务不稳定，err.log 曾留有 pi-ai 相关错误痕迹；10:32:56 看门狗判定服务死亡，从 err.log 定位"肇事插件 dsh-github-push"并移出 bundles；11:33:03（request_restart 手动重启窗口）服务再次"死亡"（实际是重启停服），看门狗又从 err.log 定位"dsh-server-ssh"并移出 bundles。两次误隔离的对象都是健康插件（与真正根因 pi-ai 模型下架无关）。机制：watchdog-dsh.ps1 每 30s 探活，无监听 2 次判定死亡 → Get-BrokenPluginName 从 dsh-web.err.log 尾部 80 行正则匹配 `plugins[\\/](dsh-xxx)[\\/]` 或 `failed to import/apply loader entry ... (dsh-xxx)` 定位肇事者——无重启窗口豁免；request_restart 正常停服窗口被误判死亡；err.log 中陈旧（已修复问题的）记录仍可命中匹配导致误定位。后果：两个健康插件被反复摘出 profile bundles（本次审查恢复后又将被摘），SSH 面板/GitHub 推送不可用且用户不知情。修复方向已定：a) 看门狗探活前检查"重启标记"（restart-resume 经 WMI 独立执行者启动 start-dsh-web.ps1 -Restart 前写标记，看门狗检测到标记跳过隔离直接让位），或 b) request_restart 停服前清空 err.log 消除误定位源，或 c) Get-BrokenPluginName 改为只匹配"本次启动后新增"的错误行（按时间戳过滤）。推荐 a+b 组合，低级风险。
