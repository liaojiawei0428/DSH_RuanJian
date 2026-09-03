---
date: "2026-09-02T10:45:52.904Z"
symptom: "health-check 复活后把中继进程误判为看门狗，看门狗在岗状态判断错乱"
component: "DSH-ops watchdog/health-check.py"
severity: "major"
status: "fixed"
root_cause: "正则 'watchdog-dsh' 未转义点号且未排除中继，把命令行含 watchdog-dsh.ps1 字样的 wd-relay 进程也计入看门狗进程集合。"
fix: "ps 查询改为精确匹配 watchdog-dsh\\.ps1（含点号转义）+ 排除 -Command 与 wd-relay，避免中继被误判为看门狗。"
related_files:
---

health-check 用 'watchdog-dsh'（无点号转义）匹配进程命令行，会把 wd-relay.ps1 中继（命令行内含 watchdog-dsh.ps1 字符串）也当作看门狗进程，导致对"看门狗在岗"状态误判、复活逻辑错乱。修复：精确匹配 'watchdog-dsh\\.ps1' 且排除 '-Command' 与 'wd-relay'。
