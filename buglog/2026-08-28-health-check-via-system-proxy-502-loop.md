---
date: "2026-08-28T03:37:38.452Z"
symptom: "服务已监听 3080 且直连 HTTP 200，update-dsh.ps1 每轮仍报\"服务 120 秒内未就绪\"并打印回滚提示"
component: "update-dsh.ps1"
severity: "major"
status: "fixed"
root_cause: "健康检查 Invoke-WebRequest 未带 -NoProxy，遵循系统代理（127.0.0.1:7688）；代理对回环地址 127.0.0.1:3080 返回 502，就绪判定永远为假，120 秒超时后误报\"服务未就绪\""
fix: "健康检查 Invoke-WebRequest 加 -NoProxy 绕过系统代理；D2 三检查（语法 OK、edit 剥 BOM 后按 D5 用 UTF8Encoding($true) 补回、powershell.exe 引用 0）+ node test-standard.mjs 4/4 通过"
related_files:
  - "E:\\DSH\\DSH-ops\\update-dsh.ps1"
---

dsh-update.log 每轮"重启 DSH 服务..."后约 120 秒报"错误: 服务 120 秒内未就绪"并打印回滚提示，但服务实际已就绪（node 监听 3080，直连探测 HTTP 200）。复现：本机系统代理 http://127.0.0.1:7688（Clash 类）对 http://127.0.0.1:3080 返回 502 Bad Gateway；Invoke-WebRequest 不带 -NoProxy 时遵循系统代理，健康检查（update-dsh.ps1 原第 258 行）永远拿不到 2xx/4xx，120 秒超时误判。与 upstream 假成功叠加，形成"拉取假成功 + 健康检查假失败"的双假循环。遗留观察：start-dsh-web.ps1 以端口监听判定就绪不受影响；若代理未来拦截 git 流量，fetch 段已有明确报错分支。
