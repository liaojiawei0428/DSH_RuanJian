---
date: "2026-08-28T08:13:51.790Z"
symptom: "更新官方新版时 pnpm run build 稳定失败，tsdown 报 7×MISSING_EXPORT（apiRemoteSubagentOwnershipError 等符号不存在），构建中止、新版无法上线"
component: "update-dsh.ps1 / 主仓库构建"
severity: "major"
status: "fixed"
root_cause: "升级跨\"官方删除包\"的提交时，git pull 不清理已删包（host/apiproxy）的旧构建产物；孤儿 lib/types/api-proxy.js（8/21 残留，内含用户未提交改动编译出的、官方源码已不存在的符号）被 tsdown 扫描到，报 7×MISSING_EXPORT 使 build:lib 失败"
fix: "pnpm run clean 后重建成功；update-dsh.ps1 构建失败分支自动 clean+重试一次"
related_files:
  - "E:\\DSH\\DSH-ops\\update-dsh.ps1"
  - "E:\\DSH\\Deepseek_DSH\\scripts\\build.ts"
---

13:43 的更新轮 pull/install 成功但 13:47 "pnpm run build 失败"，后台重跑稳定复现：tsdown 打包 dsh-root 报 7×[MISSING_EXPORT]，如 "apiRemoteSubagentOwnershipError is not exported by ../../api/remotes/src/index.ts"，报错文件全是 packages/host/apiproxy/lib/types/api-proxy.js。排查：grep 当前源码无该符号；该文件 mtime 2026-08-21（上次 rc.2 构建残留）；git ls-files 无 api-proxy（官方最新已删 host/apiproxy 包）；符号存在于快照提交 137997cb10（用户当时未提交的开发中代码，已保底个人仓库）。根因：git pull 只更新源码不清理已删包的旧 lib 产物，tsc 增量编译留下孤儿文件，tsdown 扫描 lib/types 撞上孤儿 import 的已消失符号。官方 CI 全绿（全新 checkout）而本地挂。修复：pnpm run clean 后重建 exit=0（lib/web 产物全部刷新）。加固：update-dsh.ps1 构建失败时自动 clean+重试一次（平时零开销，失败自愈），D2 三检查 + test-standard 4/4 通过。教训：跨官方删除包的提交升级，先 clean 再 build 最稳。
