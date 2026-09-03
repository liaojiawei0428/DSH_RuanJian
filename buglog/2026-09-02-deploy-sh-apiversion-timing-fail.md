---
date: "2026-09-02T15:29:37.255Z"
symptom: "v3.0.146 部署时 deploy.sh 报 \"✗ /api/version 返 FAIL 但 package.json 是 3.0.146\" 并 exit 1，实际服务正常已启动"
component: "deploy.sh (shipin-APP 远端部署脚本)"
severity: "major"
status: "workaround"
root_cause: "deploy.sh [7/9] 在 systemctl restart 后仅 sleep 3 即单次 curl /api/version，冷启动未就绪时拿到空响应 → DEPLOYED_VER=FAIL 误判为版本号不同步而 exit 1，中断了后续步骤。"
fix: "本次人工补齐中断步骤完成部署；后续应修改 deploy.sh [7/9]：重启后循环探测 (curl -sm 5 /api/version 至多 15s)，首次失败不立即 exit，区分\"服务未就绪\"与\"版本号真不一致\"（比对 package.json 版本前先等就绪）。"
related_files:
  - "/www/wwwroot/shipin-APP/deploy.sh"
  - "/etc/systemd/system/shipin-app.service"
---

v3.0.146 部署时 deploy.sh 在 [7/9] 重启 systemd 后 sleep 3 即 curl /api/version，Node 服务冷启动 + MySQL 连接耗时超过 3 秒，curl 拿到空响应 → DEPLOYED_VER=FAIL → 脚本按"8 处版本号同步失败"exit 1 中断，导致后续 PID 文件同步、site.db run_user/is_power_on 同步、12 维验证全部未自动执行。人工排查确认服务实际正常（/api/version 返回 3.0.146、changelog 正确），手动补齐了 [7/9] 之后的步骤（PID 文件、site.db 同步、12 维验证）。本质是部署脚本的时序假设过弱：生产机器冷启动 node 未必 3 秒内可服务。已在手册/部署经验中确认：重启后应轮询 /api/version 直到返回或超时(10-15s)再判定，不能单次 3 秒 curl 失败即判定失败。
