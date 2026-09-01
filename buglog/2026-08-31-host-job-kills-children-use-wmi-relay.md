---
date: "2026-08-31T04:57:49.263Z"
symptom: "重启执行者 pwsh 杀掉宿主后自身也被连带杀死：switch.log 停在\"强制停止当前服务\"后戛然而止，重启中断，服务停机直到人工干预"
component: "dsh-restart-resume"
severity: "critical"
status: "fixed"
root_cause: "宿主 DSH node 进程持有 Windows Job Object（KILL_ON_JOB_CLOSE 语义），request_restart 直接 spawn 的 pwsh 作为宿主子进程自动加入该 Job；脚本 Stop-Process 杀死宿主的瞬间 Job 句柄关闭，内核连带终止 Job 内全部进程，包括正在跑重启脚本的 pwsh。"
fix: "launchRestart 两级链改造：spawn 短命中继 pwsh -Command \"Invoke-CimMethod Win32_Process.Create CommandLine='<actor>'\"，relay exit code = WMI ReturnValue，加 15 秒超时；执行者脱离宿主 Job 完成杀宿主+拉起新服务。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
---

发现过程：修复 detached 退出问题后（见 pwsh-detached-process-exits-silently），第二次真跑仍失败——switch.log 在 12:37:48"强制停止当前服务 (pid 27484)"后戛然而止：spawn 的 pwsh 成功杀掉宿主后，自己也被连带杀死，无后续日志。推论：宿主 node 进程持有 Job Object（KILL_ON_JOB_CLOSE 类限制），非 detached 子进程自动入 Job，宿主死亡 → Job 句柄关闭 → 内核连带终止全部成员。修复：launchRestart 改为两级链——spawn 短命中继 pwsh（宿主子进程，只活到 WMI 调用返回）→ Invoke-CimMethod Win32_Process.Create 启动重启执行者（父进程为 WmiPrvSE，不在宿主 Job 内，宿主死亡波及不到）→ 执行者跑 start-dsh-web.ps1 -Restart。验证：python 同构 relay 探针（spawn-probe.ps1）确认执行者 session 1、存活、单实例模拟检查通过；随后 python relay 真跑 start-dsh-web.ps1 -Restart 完整成功：强制停止宿主 → 拉起新服务（12:56:11，3 秒就绪）→ 消费标记 → 自动续聊，第四次全自动闭环打通。遗留：12:48 首次 WMI 版失败（执行者无日志无残骸秒死）确切现场未能捕获，疑与当时手动重启 job pwsh 残留（满足单实例检查字样匹配：含 start-dsh-web.ps1+File 且无 Command）或 relay 引号嵌套边界有关；重放均成功且已消除可疑残留，判定为环境性偶发，需后续观察。注意：WMI Create 的 CommandLine 需双引号包 exe 路径（PS 单引号串内字面双引号）；relay 以 exit $r.ReturnValue 传递 WMI 结果码（0=成功）到中继 exit code 供工具判定。
