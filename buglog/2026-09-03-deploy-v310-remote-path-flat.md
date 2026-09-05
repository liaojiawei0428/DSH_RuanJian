---
date: "2026-09-03T04:35:12.186Z"
symptom: "deploy_v310.py 首轮部署时远端报 \"apps/server/deploy.sh: No such file or directory\", deploy.sh 未执行"
component: "ai-video-script-app-ops"
severity: "minor"
status: "fixed"
root_cause: "把本地 monorepo 相对路径 (apps/server/deploy.sh) 误当成远端路径; 生产 /www/wwwroot/shipin-APP 是 flat 解压结构, deploy.sh 就在顶层。"
fix: "deploy_v310.py 已修正 (第 4 步改用 `bash deploy.sh` 不带 apps/server/ 前缀), 且实际部署走 paramiko 直连重跑远端 deploy.sh 完成。"
related_files:
  - "apps/server/deploy_v310.py"
---

v3.1.0 部署时新写的 deploy_v310.py (paramiko 版) 第 4 步以 `cd /www/wwwroot/shipin-APP && bash apps/server/deploy.sh` 调用远端脚本, 报 `bash: apps/server/deploy.sh: No such file or directory`。原因: 生产目录是 flat 结构 (dist/ + deploy.sh 平铺在 /www/wwwroot/shipin-APP/), 不是 monorepo 结构, 没有 apps/server/ 子目录。修复: 重新用 paramiko exec_command 直跑 `cd /www/wwwroot/shipin-APP && bash deploy.sh --skip-maintenance`, 12 维全绿。教训: 生产 flat 结构下 deploy.sh 在 /www/wwwroot/shipin-APP/deploy.sh, 历史 deploy_v373.py 用的也是 `bash deploy.sh`; 本机 grep 到的是本地 monorepo 路径 apps/server/deploy.sh, 不能直接照搬到远端路径。
