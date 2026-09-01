---
date: "2026-08-31T00:00:00.000Z"
symptom: "DSH 启动失败（当日第三次同型）：dsh-web.err.log 报 `profile bundle \"dsh-gate-demo-bad3\" declares no dsh.bundle in its package.json`，3 次尝试全部失败；闸门 validate-plugins 8/8 全绿（bad3 显示 PASS）。"
component: "DSH-ops 演练现场残留（plugins/gate-demo-bad3 + web profile）"
severity: "major"
status: "fixed"
root_cause: "第三次闸门盲区演练残留（bad1 已删、bad2 见 2026-08-31-gate-demo-bad2-drill-residue-blocks-boot.md）：gate-demo-bad3 于 14:16:33 创建并 link 进 profile（dependencies + bundles + 这次连 pnpm install 都跑了，node_modules link 与 lockfile 条目齐全），但 package.json 缺 `dsh.bundle` 声明 → 真实启动在 bundle 清单校验处失败；即便装上，apply 内 setImmediate 异步抛错也会在运行时崩溃。三次演练（bad1 同步错误被闸门拦截、bad2 未安装 link、bad3 缺 dsh.bundle+异步崩溃）全部未执行清理步骤。"
fix: "与 bad2 同口径：备份后 disable-plugin.mjs 摘除 bundles、原子重写 package.json 删依赖行、删除 plugins/gate-demo-bad3、pnpm install 同步 lockfile（0 残留）、手动移除 stale node_modules link、闸门恢复 7/7 PASS、服务重启成功（HTTP 401=在听、err.log 空）。备份：C:\\Users\\Administrator\\.dsh\\backups\\20260831-142319\\。根治（堵住同型复发）：validate-plugins.mjs 新增 G1 第 6 项检查——每个 active link 必须声明 `dsh.bundle.patch` 且补丁文件在盘（生产 boot loadProfile 对缺失 fail-loud），阳性测试（无 dsh.bundle 插件 → FAIL）与阴性回归（7/7 PASS、test-standard 4/4）均过；start-dsh-web.ps1 定位器补第 4 种格式（`profile bundle \"dsh-xxx\" declares no dsh.bundle`），使 G3 自动隔离能认领此类残留，语法 OK、BOM 在位。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
  - "E:\\DSH\\DSH-ops\\plugins\\gate-demo-bad3"
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
---

排查路径：① switch.log 14:16:48 起 8 插件全绿但 3 次真实启动失败，err.log 栈在 app-boot/lib/index.js:862（bundle 声明校验，比 bad2 的 resolveBundleDir 更靠后——因这次 link 真装了）。② gate-demo-bad3/index.js = apply 内 setImmediate 异步抛错，package.json 无 dsh.bundle。③ lockfile 与 node_modules 均有 bad3 条目，确认演练执行了 pnpm install。教训升级：同一闸门盲区演练连续三次残留、三次停机，清理步骤屡被跳过；bad3 的 dsh.bundle 缺失与 bad2 的未安装 link 都属于"闸门只查 DSH-ops/plugins 目录、不查 profile 侧"的盲区——建议 validate-plugins.mjs 增补 profile 侧 bundle 校验（bundles 每一项：node_modules 可解析 + package.json 有 dsh.bundle），把这两类演练残留挡在重启前。