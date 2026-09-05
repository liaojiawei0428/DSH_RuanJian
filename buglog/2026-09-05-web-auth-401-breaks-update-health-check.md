---
date: "2026-09-05T01:51:53.440Z"
symptom: "升级 install/build/重启全部成功、服务实际已就绪，update-dsh.ps1 仍报\"错误: 服务 120 秒内未就绪\"并打印回滚提示，版本台账不写入（09/03 与 09/05 两轮均中招）"
component: "update-dsh.ps1"
severity: "major"
status: "fixed"
root_cause: "官方 3e24087bfa \"fix(web): authenticate the browser Host API\"（0.1.2-rc.1 起）使根路径对未认证探测返回 401；pwsh 7 的 Invoke-WebRequest 默认对非 2xx 抛异常，健康检查 catch 吞掉后继续轮询，120 秒必然超时误判\"未就绪\"。"
fix: "update-dsh.ps1 健康检查探测改为 Invoke-WebRequest ... -NoProxy -SkipHttpErrorCheck，任何 <500 响应判就绪；并补记两行版本台账。"
related_files:
  - "E:\\DSH\\DSH-ops\\update-dsh.ps1"
  - "E:\\DSH\\DSH-ops\\version-history.md"
dsh_commit: "d347e70390"
---

09/05 升级 0.1.3-alpha.1 时 install/build/闸门/重启全部成功（dsh-switch.log 09:46:49 "DSH 服务启动成功 pid 39708"），但 dsh-update.log 09:48:57 仍报"服务 120 秒内未就绪"并打印回滚提示，版本台账未写。回溯：09/03 升级 0.1.2-rc.1 同样在重启后报此错误（当时已按 buglog 2026-08-28-health-check-via-system-proxy-502-loop 修过代理 502 问题加 -NoProxy，仍失败）。实测直连探测 http://127.0.0.1:3080 返回 401 "dsh web authentication required"——官方提交 3e24087bfa（2026-08-25，0.1.2-rc.1 起包含）给 web 加了认证门，根路径对未认证请求返回 401。PowerShell 7 的 Invoke-WebRequest 对非 2xx 抛异常，脚本 if ($resp.StatusCode -lt 500) 分支永远执行不到，健康检查循环必然耗尽 120 秒。修复：探测加 -SkipHttpErrorCheck（pwsh 7.2+），收到任何 <500 的 HTTP 响应即判就绪；实测 401 → healthy=True。D2 三检查通过（语法 OK、BOM 补回、无 powershell.exe），test-standard 4/4，台账补记 0.1.2-rc.1 与 0.1.3-alpha.1 两行。
