---
date: "2026-08-31T05:21:05.385Z"
symptom: "带着坏插件执行 -Restart 时，闸门虽会拦截，但旧服务已被先杀掉——结果从\"安全中止\"变成服务停机，需人工恢复"
component: "DSH-ops/start-dsh-web.ps1"
severity: "major"
status: "fixed"
root_cause: "start-dsh-web.ps1 中 link 插件预检闸门位于 -Restart 强制停止旧服务之后：闸门红时旧进程已死、新进程不会启动，防线位置错误使其只防了空转重试、没防停机。"
fix: "闸门块前移：从启动循环之前挪到 -Restart 强制停止动作之前，任何启动路径（正常启动与重启）都先过闸门，红则 exit 1 且未对运行中服务做任何变更。"
related_files:
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
---

发现过程：用户要求实测"坏插件被闸门拦截"效果时审查 start-dsh-web.ps1 启动链发现：link 插件预检闸门原位于 68-74 行，而 -Restart 模式的强制停止旧服务在 36-56 行——即闸门红时旧服务已被杀、新服务不启动，结果是停机而非安全中止（"old server untouched"只在闸门被手动先跑时成立）。修复：闸门块前移至单实例检查之后、-Restart 停止动作之前，闸门红 = 直接中止、旧服务零影响。验证（真实故障注入演练）：造坏插件 dsh-gate-demo-bad（apply 访问 ctx.tools 未声明 inject，复刻 8-31 restart-resume 事故类）link 进 profile → 手动闸门 FAIL 报 cannot get property 'tools' without inject、exit 1，7 健康插件全 PASS → 真实执行 start-dsh-web.ps1 -Restart：闸门拦截、"启动中止: link 插件未通过预检"、exit 1、服务 pid 17700 保持不变（零影响）→ 摘除坏插件还原 profile → 闸门全绿。附注：L23 的 powershell.exe 字样是单实例 WMI 过滤器枚举新旧两种 shell 进程名，属检测目标非执行方式，P5 不适用。演练现场已完全清理（plugins/gate-demo-bad 已删，profile 已还原，backups/ 留有清单备份）。
