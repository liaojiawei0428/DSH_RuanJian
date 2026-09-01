---
date: "2026-08-31T07:11:34.041Z"
symptom: "演练插件 bad4 闸门 8/8 全绿、端口曾就绪，启动器判成功退出后服务静默死亡，G3 兜底从未触发"
component: "start-dsh-web.ps1"
severity: "critical"
status: "fixed"
root_cause: "setImmediate 类异步运行期崩溃发生在端口绑定之后：启动器按\"端口就绪\"判成功退出，G3（3 次失败才触发）的前提\"尝试失败\"根本不成立，坏插件逃过全部兜底，服务静默死亡。演练残留则由保留区命名堵死进 bundles 的路径。"
fix: "start-dsh-web.ps1 就绪后 2 秒存活复核（崩溃计入失败，G3 可触发）；validate-plugins.mjs G1 第 8 项演练保留区拒绝（DSH_DRILL=1 显式旁路）；新增 watchdog-dsh.ps1 运行期看门狗（30s×2 去抖→G3 同款定位器→自动隔离→WMI 拉起完整启动链，1 小时 3 次防循环护栏），启动器成功路径 Ensure-Watchdog 挂接"
related_files:
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
---

第四轮 G3 演练（14:31 gate-demo-bad4）：new-plugin.mjs 脚手架起步保证 manifest 完整（dsh.bundle 全齐），仅注入 setImmediate 异步抛错。闸门八项全绿（同步执行结构性看不见异步缺陷），S3 完整安装，-Restart 后启动器日志显示成功退出——但服务随即死亡且无任何兜底触发。发现：现有全部防线（G3 三次失败触发、端口轮询）都以"boot 失败/端口不来"为前提，而 bad4 的崩溃发生在端口绑定之后，启动器"端口在听=成功"的判据误判。用户修复两层：① 启动器就绪后存活复核（睡 2 秒复查监听仍在，崩溃尝试计入失败→三次后 G3 照常定位隔离）；② 闸门 G1 第 8 项演练保留区（dsh-gate-demo-* 名字直接拒绝，我随后补 DSH_DRILL=1 显式旁路保证演练仍可进行，启动链自动路径永不设该变量）。我随后补 G5 运行期看门狗（watchdog-dsh.ps1）覆盖存活复核窗口之后的任意延迟崩溃。看门狗上岗即遭 pwsh 路径写死事故（见 service-silent-death-watchdog-pwsh-path 记录），两事故合并后 G5 全链路在岗验证通过（服务 13612、看门狗 3840、watchdog.log 正常）。回归：闸门 7/7、test-standard 4/4、DSH_DRILL 冒烟无异常。
