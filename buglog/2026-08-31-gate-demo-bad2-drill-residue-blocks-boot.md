---
date: "2026-08-31T00:00:00.000Z"
symptom: "DSH 启动失败：dsh-web.err.log 报 `cannot resolve profile bundle \"dsh-gate-demo-bad2\" from the dsh installation or C:\\Users\\Administrator\\.dsh\\profiles\\web`，3 次尝试全部失败；闸门 validate-plugins 却 8/8 全绿（gate-demo-bad2 显示 PASS）。"
component: "DSH-ops 演练现场残留（plugins/gate-demo-bad2 + web profile）"
severity: "major"
status: "fixed"
root_cause: "第二次闸门盲区演练（gate-demo-bad2，apply 同步注册为空、靠 setImmediate 异步抛错——闸门只跑同步 apply，完全看不见）把插件 link 进了 profile 的 package.json dependencies + bundles，但演练结束后未清理：从未执行 pnpm install（node_modules 无该 link → 真实启动 resolveBundleDir 即失败；即便装上也会在运行时异步崩溃）。前次演练（gate-demo-bad，见 2026-08-31-restart-gate-ran-after-kill.md）清理完整，本次演练残留未记录、未清理。"
fix: "R4 逃生：node disable-plugin.mjs dsh-gate-demo-bad2 摘除 bundles 项；备份后整体原子重写 package.json 删掉残留 dependencies link 行；删除演练目录 plugins/gate-demo-bad2（与上次演练清理口径一致）；validate-plugins 恢复 7/7 PASS；服务重启成功（HTTP 401=在听、err.log 空）。备份：C:\\Users\\Administrator\\.dsh\\backups\\20260831-134928\\package.json.profile-web.bak。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
  - "E:\\DSH\\DSH-ops\\plugins\\gate-demo-bad2"
---

排查路径：① dsh-switch.log 13:20 起：gate FAIL dsh-gate-demo-bad（复刻 restart-resume 类故障）→ 13:28 起 gate PASS dsh-gate-demo-bad2 但 3 次真实启动全败 → 13:43 err.log 定位到 resolveBundle 失败。② 对照 profile package.json：dependencies 有 link:E:/DSH/DSH-ops/plugins/gate-demo-bad2（目录名与包名 dsh-gate-demo-bad2 不一致），bundles 有该项，但 node_modules 无此 link、pnpm-lock.yaml 无此条目 → 确认依赖行是演练后手工追加、从未安装。③ plugins/gate-demo-bad2/index.js 内容是 setImmediate 异步抛错，闸门同步执行看不到 → 双盲区：闸门对未安装 link 与异步崩溃均不可见。教训：演练必须当天清理并记录（P11），本次残留直接造成 DSH 停机；建议演练结束清单核对 profile 与插件目录两处。