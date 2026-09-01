---
date: "2026-08-31T00:00:00.000Z"
symptom: "DSH 启动失败（当日第四次同型）：gate-demo-bad4 演练插件（setImmediate 异步抛错）在 profile 中，启动器第 3 次尝试先绑上端口报\"启动成功\"、随后进程崩溃静默死亡——用户看到的是服务不可用，而启动器与 G3 兜底都未触发。"
component: "DSH-ops 演练现场残留（plugins/dsh-gate-demo-bad4 + web profile）+ start-dsh-web.ps1 就绪判定竞态"
severity: "major"
status: "fixed"
root_cause: "第四次闸门盲区演练残留：bad4 是结构完全合规的插件（dsh.bundle/exports/patch 全齐，闸门 8/8 全绿——含新增的 dsh.bundle 检查），唯一缺陷是 index.js:29 `setImmediate(() => { throw ... })` 异步运行期崩溃。闸门同步执行永远看不见此类错误；且崩溃发生在端口绑定之后——启动器的\"就绪 = 端口在听\"判定成立即退出，G3 兜底（3 次启动失败才触发）根本没机会运行，服务随后死亡无人接管。"
fix: "清理（备份 backups\\20260831-143834\\）：disable-plugin.mjs 摘 bundles、原子重写删依赖行、删插件目录、pnpm install 同步 lockfile、服务恢复。根治两层：① validate-plugins.mjs 新增 G1 第 8 项——演练保留区名称检查（dsh-gate-demo-*/gate-demo-* 直接拒绝），演练残留再也进不了 bundles；② start-dsh-web.ps1 就绪判定加 2 秒存活复核——端口曾就绪但进程随即崩溃的尝试计入失败，3 次后 G3 定位器经 err.log 的 plugins/dsh-xxx/ 路径自动隔离并重试，恢复全自动。验证：保留区阳性测试 FAIL ✓、真实 profile 闸门 7/7 ✓、test-standard 4/4 ✓、ps1 语法 OK + BOM 在位 ✓、服务启动后稳定在听 ✓。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
---

排查路径：① switch.log 14:31:08 起：闸门 8/8 全绿（bad4 PASS——结构合规、dsh.bundle 齐全）→ 尝试 1、2 在监听前崩溃 → 尝试 3 于 14:32:12 \"启动成功\"，但 err.log（14:32:11）即 bad4 的 setImmediate 崩溃栈——端口绑定与崩溃几乎同时发生，启动器轮询先命中端口即退出 0。② 当前无监听、无 bad4 进程，服务确实死亡。③ bad4 目录为脚手架形态（package.json 声明齐全），唯一判据是命名 gate-demo-bad4。教训：运行期异步崩溃是闸门结构性盲区（同步执行），必须由启动链就绪复核 + 兜底定位接管；演练插件命名保留区把残留风险在闸门处清零。第四次同型事故后，保留区命名（G4）+ 保留区闸门拒绝（G1 第 8 项）+ 就绪存活复核（G3）三层闭环。