---
date: "2026-09-02T10:45:52.950Z"
symptom: "新拉起看门狗首 30s 被 health-check 误判卡死并 taskkill 误杀"
component: "DSH-ops watchdog/watchdog-dsh.ps1+health-check.py"
severity: "major"
status: "fixed"
root_cause: "看门狗首轮 30s 才写心跳 + health-check 无刚启动宽限，心跳过期被误判为进程卡死。"
fix: "watchdog-dsh.ps1 启动循环前先写一次心跳；health-check 解析进程 CreationDate，进程出生<STALE_SECONDS 时心跳过期视为刚启动宽限不误杀。"
related_files:
---

看门狗主循环 Start-Sleep 30s 后才写心跳，新实例启动首 30s 心跳无更新；health-check 用"进程在+心跳过期>75s"判卡死，会把刚启动的看门狗误判为卡死并 taskkill（9448 启动 12s 即被杀）。修复：看门狗启动立即只写一次心跳；health-check 增加"进程出生<75s"刚启动宽限不判卡死。
