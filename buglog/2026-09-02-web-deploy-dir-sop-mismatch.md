---
date: "2026-09-02T15:29:45.784Z"
symptom: "v3.0.146 web 部署后公网 /assets/index-BlnZ4D8Y.js 返回 404（首页 200），新 bundle 未生效"
component: "web 部署 SOP (apps/web/scripts/deploy.sh + 部署手册)"
severity: "major"
status: "workaround"
root_cause: "SOP/脚本中的 WEB_DIR 配置 (/www/wwwroot/web-app) 与实际生产 nginx vhost root (/www/wwwroot/ab.maque.uno/dist) 不一致，web-app 是 7 月遗留目录，按 SOP 部署导致新 bundle 404。"
fix: "web 部署目标一律为 /www/wwwroot/ab.maque.uno/（tar 结构 dist/ + package.json，与 nginx root /www/wwwroot/ab.maque.uno/dist 对齐），禁止用 /www/wwwroot/web-app；部署后必须验证公网新 bundle HTTP 200 + 首页引用的 JS hash 与本地 dist 一致。"
related_files:
  - "F:\\QiTa\\banmu\\APP\\ai-video-script-app\\apps\\web\\scripts\\deploy.sh"
  - "/www/server/panel/vhost/nginx/ab.maque.uno.conf"
---

v3.0.146 部署 web 时按旧 SOP 的 WEB_DIR=/www/wwwroot/web-app 解压 web-dist.tgz，随后公网验证发现新 bundle /assets/index-BlnZ4D8Y.js 404。排查真实 nginx vhost (/www/server/panel/vhost/nginx/ab.maque.uno.conf) root=/www/wwwroot/ab.maque.uno/dist（SPA fallback location / 内 try_files），而 /www/wwwroot/web-app 是 2026-07-01 的历史残留目录（仅有 assets/ + 511B index.html，无 dist/）。已修正为解压到 /www/wwwroot/ab.maque.uno/（tar 内含 dist/ + package.json，nginx root 直接指 dist/），备份旧 dist 为 dist.bak.s<ts>，chown www 后 nginx reload，公网 bundle 200 且 <home> 引用的 hash 与 dist 内一致。修复后清理了误放到 web-app 的 dist/package.json，保留其历史 assets/index.html。
