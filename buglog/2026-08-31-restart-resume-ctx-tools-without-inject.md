---
date: "2026-08-31T03:51:23.964Z"
symptom: "安装 dsh-restart-resume 后服务启动失败：闸门全绿但 3 次启动尝试全部\"未就绪\"被杀，dsh-web.err.log 为空"
component: "dsh-restart-resume"
severity: "critical"
status: "fixed"
root_cause: "apply 内访问 ctx.tools 但 inject 只声明 ['sessionController']：该 Cordis 版本对未声明注入的服务属性访问直接抛错，插件树加载失败，服务无法监听端口。validate 闸门的 stub 环境不执行注入检查，因此闸门全绿无法发现此问题。"
fix: "inject 补上 'tools'（与 'sessionController' 并列，均声明等待就绪），同步修正头部 P3 注释；start-dsh-web.ps1 就绪等待由固定 15 秒睡眠改为 0.5 秒间隔轮询、上限 30 秒。"
related_files:
---

排查过程：安装 dsh-restart-resume 后经 personal_hub_reapply + start-dsh-web.ps1 -Restart 重启，validate-plugins 闸门 7 个插件全绿，但服务 3 次尝试均在 15 秒内未监听 3080 被杀，dsh-web.err.log 0 字节。根因有二：(1) 主因——apply 内 ctx.effect(() => ctx.tools.register(...)) 访问 ctx.tools，而 inject 只声明 ['sessionController']；该 Cordis 版本对未声明注入的服务属性访问直接抛 "cannot get property 'tools' without inject"，插件树加载失败；validate 闸门的 stub 环境不执行注入检查，故闸门绿但运行时挂。(2) 并发隐患——start-dsh-web.ps1 启动就绪检测为固定 Start-Sleep 15 秒后单次查端口，pnpm install 后首次冷启动实测 16 秒+（用户手动重启 11:45:39→11:45:55 压线成功），慢启动会被误杀；已改为每 0.5 秒轮询、最长 30 秒。教训：闸门 stub 无法替代运行时注入检查；新插件首次安装后务必实际重启验证。
