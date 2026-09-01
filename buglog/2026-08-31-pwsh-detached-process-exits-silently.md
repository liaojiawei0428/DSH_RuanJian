---
date: "2026-08-31T04:30:37.732Z"
symptom: "request_restart 声称重启已排队但服务从未重启：spawn 出的 pwsh 进程无影无踪，重启脚本一行日志未写"
component: "dsh-restart-resume"
severity: "critical"
status: "fixed"
root_cause: "PowerShell 7.6 在 Windows DETACHED_PROCESS（无控制台）模式下启动即正常退出（exit 0）；Node child_process spawn 的 detached: true 在 Windows 上正是使用 CREATE_NEW_PROCESS_GROUP|DETACHED_PROCESS 标志，导致 pwsh 还没执行脚本第一行就退出了。"
fix: "launchRestart 的 spawn 选项移除 detached: true（保留 windowsHide: true 与 stdio: 'ignore'），并在代码注释中记录该行为；重启由孤儿 pwsh 完成，无需 detached。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
---

发现过程：request_restart 工具返回"重启已排队"（spawn 成功拿到 pid）但服务从未重启、start-dsh-web.ps1 一行日志都没写、系统内无 pwsh 残骸。对照组实验（python 执行器内 spawn 同一 pwsh）：DETACHED_PROCESS 模式 spawn 'pwsh -Command Start-Sleep 30' 3 秒后进程消失且 poll()=0（干净退出，非被杀）；非 detached 与 CREATE_NO_WINDOW 模式同样命令均存活。排除项：WindowsApps stub（PATH 首项即 E:\GongJu\7）、Job Object 强杀（退出码为 0 而非终止码）、沙盒 ACL（非 detached 存活证明链路无碍）。结论：pwsh 7.6.4 启动器在 DETACHED_PROCESS（无控制台）下启动即静默退出，Node 的 detached:true 正是使用该标志。修复：spawn 选项去掉 detached，保留 windowsHide；宿主被重启脚本终止后孤儿进程继续运行（Windows 父死不连带子），detached 语义本就非必需。验证：刷新标记 requestedAt 后手动重启，新进程 3 秒就绪、consumeMarker 读标记、sessionController.prompt 注入原会话、模型自动接续——全自动闭环首次真实打通。附带发现：Cordis LoggerService 无 exporter 挂载时静默丢弃所有 ctx.logger 输出（not-found error 日志不可见），插件关键动作不宜仅依赖 ctx.logger。
