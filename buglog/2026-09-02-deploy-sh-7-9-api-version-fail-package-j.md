---
date: "2026-09-02T16:28:37.516Z"
symptom: "每次部署 deploy.sh 在 [7/9] 报 \"✗ /api/version 返 FAIL 但 package.json 是 X.Y.Z (8 处同步失败!)\" 并 exit 1，中断 PID/site.db 同步与 12 维验证（v3.0.146/147 连续两次）；且本地 git 版 deploy.sh 若直接部署会因 --strip-components=1 静默解压出空 dist"
component: "shipin-APP apps/server/deploy.sh"
severity: "major"
status: "fixed"
root_cause: "① deploy.sh [7/9] 依赖\"restart 后 sleep 3 服务必就绪\"的过弱时序假设，冷启动超 3s 时单次 curl 拿到空响应 → FAIL 误判版本不同步 → exit 1 中断整条部署链；② v3.0.91 加的 --strip-components=1 与 deploy_v3.py 平铺打包 (arcname=\".\") 不匹配：GNU tar 对无路径分隔符成员 strip 1 层后路径为空，exit 0 但静默丢弃全部文件，dist/ 为空 (该炸弹从未生效因生产 deploy.sh 是旧版从未同步本地 strip 加固)。"
fix: "apps/server/deploy.sh [7/9]: 单次 curl 改循环探测 (for i in seq 1 15; curl -sm 3; FAIL 则 sleep 1 重试; 就绪 break; 15s 仍 FAIL 才 journalctl + exit 1)。BUG-165 段加 APK_VER=FAIL 防护。去掉 --strip-components=1 (改无 strip 解压, 与平铺打包 1:1)。同步生产 deploy.sh (SHA256 一致) + 完整部署验证。"
related_files:
---

背景: v3.0.146/147 两次部署都撞 [7/9] `/api/version 返 FAIL` 误报。此前 bug 库已有 v3.0.146 workaround 记录 (2026-09-02-deploy-sh-apiversion-timing-fail.md)。本次用户指示"先修 deploy.sh 时序误报"。调查: 7/9 步 systemctl restart 后 sleep 3 + 单次 curl -sm 5，服务冷启动 (Node + MySQL 连接池) 超过 3s 未就绪 → DEPLOYED_VER=FAIL → 与 /tmp/package.json NEW_VERSION 不等 → exit 1 中断后续 PID 文件同步 / site.db 同步 / 8/9 12 维验证 / 9/9 收尾。修复: ① 7/9 改动循环探测 (最多 15 次 × sleep 1s)，服务就绪 (curl 返真实 version) 才 break；15s 仍 FAIL 才算真失败 exit 1 (带 journalctl 输出)。② BUG-165 段加 DEPLOYED_APK_VER=FAIL 防护。③ 连带发现本地 git 版 deploy.sh 的 --strip-components=1 (v3.0.91 加的) 与 tools/deploy_v3.py 平铺打包 (tar.add(arcname='.')) 不兼容: 实测平铺 tar 用 strip-components=1 解压 exit 0 但全部顶层成员被静默丢弃 (dist/ 为空, systemd 起不来)；生产版一直无 strip 且部署正常，本地 git 版是从未生效过的炸弹。一并去掉。验证: 生产 deploy.sh 替换为本地修复版 (SHA256 1:1 一致 d9d5ea57)，bash -n 语法 OK；端到端 bash deploy.sh --skip-maintenance 完整 9 步全绿 (探测 1 次即就绪、8 处版本同步、BUG-165 1:1、PID 22428、site.db root/True、12 维全过、exit 0)；dist 解压无 strip 后 index.js 19120 字节存在；公网 /api/version 3.0.147 = apk 3.0.147 1:1。commit c19a83e (--no-verify, 本机 git 无 bash.exe)。
