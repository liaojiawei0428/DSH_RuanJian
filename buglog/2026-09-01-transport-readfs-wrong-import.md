---
date: "2026-09-01T05:56:53.606Z"
symptom: "闸门加载 dsh-server-ssh 报 \"The requested module 'node:fs/promises' does not provide an export named 'readFileSync'\"，插件无法加载。"
component: "dsh-server-ssh/src"
severity: "major"
status: "fixed"
root_cause: "transport.js 把同步 API readFileSync 混入 node:fs/promises 的 named import 列表；node:fs/promises 不导出该名字，ESM 加载器在模块解析阶段抛 SyntaxError（named export 不存在）。"
fix: "src/transport.js 导入拆分为两行：import { readFile } from 'node:fs/promises'；import { existsSync, readFileSync } from 'node:fs'。重建后闸门该症状消失。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\transport.js"
---

发现路径：链接安装 dsh-server-ssh 后第一次跑 validate-plugins.mjs 全量加载，闸门报 The requested module 'node:fs/promises' does not provide an export named 'readFileSync'。源检查：src/transport.js L17 为 import { readFile, readFileSync } from 'node:fs/promises'，L273 TOFU 层用 readFileSync 读 known_hosts——编写时把同步 API 误并入 promises 导入。esbuild 打包不校验 named import 是否真实存在（external 模块的导入按原样保留），错误延迟到运行时加载才暴露，node --check 也查不出（语法合法）。修复后闸门通过。教训：named import 的来源模块要逐一核对 API 类别（同步 / promises / 回调式）。
