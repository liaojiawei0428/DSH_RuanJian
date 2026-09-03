---
date: "2026-09-02T10:45:42.523Z"
symptom: "WMI Win32_Process.Create 拉起的看门狗每次都弹黑窗，用户误关后看门狗被强杀（黑匣子无退出行）"
component: "DSH-ops watchdog/watchdog-dsh.ps1+start-dsh-web.ps1+health-check.py"
severity: "critical"
status: "fixed"
root_cause: "WMI Win32_Process.Create 不接受 STARTUPINFO，创建的控制台进程无法隐藏窗口，必然弹黑窗；END-USER 会误关导致守卫生效悬空。Windows 后台子进程经 WMI 拉起时同类问题广泛存在（MS Q&A/Task Scheduler）。"
fix: "所有拉起路径弃用 WMI 直拉，改用 Start-Process -WindowStyle Hidden（STARTF_USESHOWWINDOW）；health-check 复活用 WMI 极短命中继（脱宿主 Job）→ 中继 Start-Process Hidden 拉起；watchdog-dsh.ps1 启动即用 GetConsoleWindow+ShowWindow(SW_HIDE) 自隐藏兜底。"
related_files:
---

排查终点：用 WMI 拉起看门狗（30288）90s 后必死（心跳停、无退出行=强杀），而 Start-Process Hidden 拉起（37960）稳定 156s+；监控证实 WMI 拉起的 relay 1s 内文件消失且看门狗未拉起。决定性：《WindowStyle Hidden broke after update PW7.2.7》 issue + DSH 官方 #1564 补丁（STARTF_USESHOWWINDOW + SW_HIDE）佐证正确机制。已统一 4 处拉起路径（start-dsh-web.ps1 Ensure-Watchdog / watchdog-dsh.ps1 拉起启动链 / health-check.py 复活 / restart-resume WMI 中继内部保留脱 Job）。注意健康检查复活必须经 WMI 中继脱离宿主 Job（Job kill-on-close 连带），不能直接 Start-Process。
