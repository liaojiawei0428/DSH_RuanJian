---
date: "2026-09-01T02:05:49.795Z"
symptom: "看门狗无声死亡第 2 例：pid 26636 上岗约 1 分钟消失（前例 2568 约 2 分钟），事件日志与自身日志均无痕迹，运行期保护悬空"
component: "watchdog-dsh.ps1"
severity: "major"
status: "workaround"
root_cause: "未明——WMI 拉起、无 Job 连带证据、无 WER 记录、无自身退出日志，四种已知退出路径均不留痕；定性为未知强杀或进程级崩溃，转防御性方案"
fix: "watchdog-dsh.ps1 加心跳文件 + try/finally 黑匣子；health-check.py 加心跳判定与自动 WMI 复活闭环；node 路径改定位链。复活验证：health-check 首跑自动拉起 pid 32212，终验心跳正常"
related_files:
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
  - "E:\\DSH\\DSH-ops\\health-check.py"
---

health-check.py 首跑即逮到复发：26636（17:30:11 由启动器 Ensure-Watchdog 经 WMI 拉起）约 1 分钟内无声消失，与 2568（15:58:44 拉起、16:00 前后消失）同款。排查排除了启动器 Job 连带（Ensure-Watchdog 是纯 WMI Create，父 WmiPrvSE；反例 22880 同款 WMI 拉起却活 88 分钟）、事件日志（Application/System 均无 WER 或错误记录）、看门狗自身退出路径（单实例退出/让位退出都会写日志，日志无痕迹）。死因未明 → 不再消耗排查成本，转为免疫闭环：① watchdog-dsh.ps1 主循环加心跳文件（每 30s 覆盖写 watchdog.heartbeat，区分「死了」与「卡死」并量化时长）；② try/finally 黑匣子（正常退出/终止性错误留「看门狗进程退出」行，被强杀不留——死亡现场判据）；③ health-check.py 看门狗检查升级：心跳新鲜度判定 + 不在岗自动 WMI 复活 + 2s 复查 + 死亡现场判读，模型查状态即自愈；④ 顺带修掉 107 行写死 C:\Program Files\nodejs\node.exe 的既有隐患（改 Get-Command 定位链）。D2 三查绿；全量 health-check 终验全绿（新看门狗 32212 心跳正常）。观察点：若黑匣子再次捕获无声死亡（日志启动行后无退出且心跳过期），死因转「外部强杀」，下一步查系统级进程猎手。关联前例：2026-08-31-watchdog-died-unprotected-window.md。
