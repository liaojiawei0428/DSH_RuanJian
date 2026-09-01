---
date: "2026-08-31T05:57:53.918Z"
symptom: "link 已写入 profile 但未 pnpm install 时启动必败：resolveBundleDir 报 cannot resolve profile bundle，闸门却 8/8 全绿放行，兜底定位器也认不出肇事插件，服务停机待人工恢复"
component: "DSH-ops/validate-plugins.mjs"
severity: "critical"
status: "fixed"
root_cause: "三层叠加：演练操作未走完 S3 第 3 步（pnpm install）；闸门只读 link.dir 不验 install 状态（盲区）；兜底定位器缺 resolve 失败格式且失败时不给 err.log 原文。"
fix: "validate-plugins.mjs 增加半安装检查（node_modules/<name> 存在性，条件化为 profile 已 install 场景）；start-dsh-web.ps1 定位器补 cannot resolve profile bundle 模式、失败时输出 err.log 尾部原文。"
related_files:
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
---

发现过程：gate-demo-bad2 兜底演练（造 setImmediate 异步崩溃插件，闸门同步执行看不见，实测兜底）因我的操作失误升级为真实事故——把 link 写进 profile（dependencies+bundles）后没走 S3 第 3 步 pnpm install 就发起重启：真实服务经 node_modules 解析 bundle，无 symlink → resolveBundleDir 报 cannot resolve profile bundle → 3 次尝试全灭停机，用户手动清理（删目录、摘 link）并恢复服务（pid 14732）。事故暴露两个工具链缺陷：缺陷 1——闸门直接读 link.dir 校验文件，完全不验 install 状态，半安装插件照样 8/8 全绿放行（闸门盲区 #3）；缺陷 2——启动兜底定位器只认识 loader entry 与异常栈路径两种格式，不认识 resolve 失败格式，且定位失败时不输出 err.log 原文，人工排查无线索。修复：闸门对每个 active link 增查 profile node_modules/<name> 存在（仅在 profile 已有 node_modules 目录时启用，避免临时测试 profile 误报；中途一笔误写成 else continue 把无 node_modules 场景下全部插件静默跳过导致 test-standard 1→3 项失败，已改回条件包裹并回归），FAIL 文案直接给出修复命令；兜底定位器补第三模式 cannot resolve profile bundle.*?(dsh-[\w-]+)，定位失败时输出 err.log 最后 5 行原文。验证：半安装阳性（移走 dsh-tool-python symlink → FAIL 带修复指引，还原 → 全绿）；test-standard 4/4；闸门 7/7。教训已并入 PLUGIN-STANDARD 演练纪律：演练必须完整走 S3（含 pnpm install）。遗留：自动隔离兜底路径本身（3 崩→定位→禁用→重试）尚未实测成功一次。
