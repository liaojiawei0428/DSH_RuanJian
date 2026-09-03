---
date: "2026-09-02T10:45:42.567Z"
symptom: "health-check.py 复活看门狗总是失败（\"复活拉起后 2s 复查仍未见进程\"），但手动复刻同款 WMI 命令成功"
component: "DSH-ops watchdog/health-check.py"
severity: "major"
status: "fixed"
root_cause: "health-check 在 WMI 拉起中继后立即 relay_ps.unlink() 删除中继脚本；WMI 是异步创建，返回 0 只代表请求已提交，中继进程此刻尚未读取脚本文件，文件已被删导致 pwsh 启动失败。"
fix: "移除 health-check 对中继脚本的立即 unlink，改由中继脚本自删（Remove-Item $MyInvocation.MyCommand.Path）；health-check 保留幂等兜底（missing_ok）。监控实证：修复前 relay 文件 1s 内消失且看门狗未拉起，修复后看门狗稳定拉起。"
related_files:
---

用监控线程（0.4s 采样）追踪 relay 文件/进程生命周期，发现在 health-check 内 relay 文件 18:36:49 出现、18:36:50 消失且看门狗未拉起；手动无 unlink 的复刻必成功。根因与修复如上。Watchdog 复活链路在移除 unlink 后端到端绿。
