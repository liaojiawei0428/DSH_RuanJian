---
date: "2026-08-31T08:03:52.853Z"
symptom: "$env:DSH_DRILL='1' 后经 WMI Win32_Process.Create 拉起 start-dsh-web.ps1 -Restart，启动器闸门仍按无演练模式 FAIL（15:49:58 restart aborted）"
component: "watchdog-dsh.ps1 / start-dsh-web.ps1"
severity: "minor"
status: "fixed"
root_cause: "WMI Win32_Process.Create 的子进程不继承调用者的会话环境变量，其环境继承自 WmiPrvSE 服务进程"
fix: "环境变量改走命令行前置：cmd /c \"set DSH_DRILL=1&& pwsh -File ... -Restart\"——cmd 设置的环境传给其 pwsh 子进程。重跑后闸门 WARN 可见、8/8 放行，场景 C 全链路闭环。"
related_files:
---

G5 终测演练场景 C 中发现。用 Invoke-CimMethod WMI Create 拉起 start-dsh-web.ps1 -Restart 前设置了 $env:DSH_DRILL='1'，但启动器闸门仍以无演练模式 FAIL（drill-reserve name → restart aborted, old server untouched）。排查确认：Win32_Process.Create 产出的进程环境继承自 WmiPrvSE 服务进程而非调用者 pwsh。附带正面收获：闸门在停机动作之前正确中止，运行中的健康服务（29376）零影响。修复方案已在演练中验证生效。同根因推论：看门狗→启动器的 WMI 恢复链天然不带会话变量，保证自动恢复链干净（这是优点，无需改）。
