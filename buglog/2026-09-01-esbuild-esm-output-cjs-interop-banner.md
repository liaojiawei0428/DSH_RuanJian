---
date: "2026-09-01T05:56:32.019Z"
symptom: "闸门加载 dsh-server-ssh 产品 index.js 报 \"Dynamic require of \\\"net\\\" is not supported\"，alias 修复后变 \"Dynamic require of \\\"node:net\\\"\"，再变 \"__dirname is not defined in ES module scope\"——启动必崩，闸门拦截。"
component: "dsh-server-ssh/build"
severity: "major"
status: "fixed"
root_cause: "ssh2 1.17.0 是 CommonJS 包：部分 require（net/tls/crypto 等）留在函数体内，esbuild 打包成 ESM 时无法静态提升为 import，只能保留运行时 __require 调用，而 ESM 作用域没有 require；同时 ssh2 源码顶层使用 CJS 隐式全局 __dirname（定位可选原生模块路径），ESM 输出中该标识符未定义。"
fix: "build.mjs host 构建加三重兜底：(1) alias 把 node:module builtinModules 全表映射到 node: 前缀，静态 require 走唯一 node:* external；(2) banner 注入 var require = createRequire(import.meta.url)，让 esbuild 的 __require shim（typeof require !== 'undefined' 分支）解析到真实 CJS require，任何函数体内动态 require 都可执行；(3) 同 banner 注入 __filename/__dirname（fileURLToPath(import.meta.url) / new URL(\".\", import.meta.url)），满足 ssh2 顶层的 CJS 隐式全局。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\build.mjs"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\transport.js"
---

闸门 validate-plugins.mjs（本轮新装 dsh-server-ssh 后首次全量加载）按序暴露三层失败：先是 Dynamic require of "net"，加 alias 后变 Dynamic require of "node:net"（证明 alias 生效但 require 仍在函数体），再加 banner require 后变 __dirname is not defined，最后 banner 三件套全绿。根因不是 esbuild 配置错误而是 CJS→ESM 边界的固有语义：动态 require 与 CJS 隐式全局在 ESM 中无对应物。build.mjs 的 host 构建选项最终为 external:['node:*'] + alias: BUILTIN_ALIAS + banner(createRequire/fileURLToPath)。修复经 node build.mjs + node validate-plugins.mjs 验证：all 8 active linked plugin(s) safe to load。同批还修复了 src/transport.js L17 的 import { readFile, readFileSync } from 'node:fs/promises'（readFileSync 是同步 API，属 node:fs）——单独症状为 The requested module 'node:fs/promises' does not provide an export named 'readFileSync'，与 CJS 互操作无关但同属闸门首次拦截。
