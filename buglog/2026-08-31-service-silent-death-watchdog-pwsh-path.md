---
date: "2026-08-31T00:00:00.000Z"
symptom: "DSH 服务静默死亡（非插件原因）：PID 21444 于 14:40:54 正常启动，14:51:02 启动器仍确认\"已在运行\"，随后进程消失——无 err.log 输出、无崩溃事件、无重启标记、dsh-switch.log 在 14:51:02 后零写入；启动器/闸门/演练保留区全部未触发（当时无演练插件残留，闸门 7/7）。"
component: "G5 看门狗（watchdog-dsh.ps1 / start-dsh-web.ps1 Ensure-Watchdog）"
severity: "major"
status: "fixed"
root_cause: "① 进程被仓库外动作静默终止（Stop-Process/taskkill 类，err.log 无输出、事件日志无崩溃记录、无 restart-resume 标记——证据指向并发会话的演练/测试动作，具体执行者无法从日志还原）。② 本应在 60 秒内自动拉起的 G5 看门狗形同虚设：Ensure-Watchdog 与 watchdog-dsh.ps1 的 WMI 拉起命令把 pwsh 写死为 C:\\Program Files\\PowerShell\\7\\pwsh.exe，本机 pwsh 实际在 E:\\GongJu\\7\\pwsh.exe——WMI Create 恒 ReturnValue 9（Path Not Found），看门狗从未上岗（watchdog.log 不存在），服务死后无人接管。14:51:02 启动器输出\"打开浏览器失败 (ReturnValue 9)\"正是同一路径缺陷的另一表现（该消息来自并发会话的临时版启动器，仓库内脚本无此文案）。"
fix: "① start-dsh-web.ps1 与 watchdog-dsh.ps1 各增 Resolve-PwshPath（DSH_PWSH_PATH → PATH → Program Files 两处默认位，与 dsh-restart-resume 定位链一致），WMI CommandLine 改用解析结果。② 验证：重启后\"运行期看门狗已在岗 (pid 3840)\"，watchdog.log 记录\"每 30s 查询 3080\"，进程 3840 存活于正确 pwsh 路径；服务 13612 在听（HTTP 401）、err.log 空。今后服务任意原因死亡 → 看门狗 60 秒内定位+隔离+WMI 拉起，自动恢复闭环。两脚本语法 OK、UTF-8 BOM 在位。"
related_files:
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
---

排查路径：① err.log 0 字节 + 无 Event 1000 崩溃记录 + 无 restart-resume 标记 + switch.log 静默 → 非异常崩溃、非重启链动作，属外部静默终止。② PowerShell 操作日志 14:51:02 无启动记录——该次启动器调用来自仓库外副本（输出含仓库内不存在的\"打开浏览器失败 (ReturnValue 9)\"文案）。③ DSH-ops 最近改动时间线：14:49:28 validate-plugins.mjs、14:50:38 start-dsh-web.ps1 + watchdog-dsh.ps1（并发会话叠加 G5 看门狗，且 validate-plugins 增 DSH_DRILL=1 演练旁路）——确认另一会话在并发演练/修改。④ watchdog.log 不存在 + Program Files 无 pwsh → 看门狗拉不起来，直接证据。教训：① 看门狗必须验证\"真的上岗\"（log 首行）才算部署成功；② 跨会话并发改动工具链时，路径写死类缺陷难以及时暴露——统一用解析链；③ 服务静默死亡无日志可查时，先查并发会话活动与看门狗在岗状态，再查插件。