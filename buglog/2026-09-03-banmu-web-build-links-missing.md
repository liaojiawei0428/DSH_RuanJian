---
date: "2026-09-03T08:49:21.722Z"
symptom: "banmu-admin/web `npm run build` 报 Cannot find module node_modules\\vue-tsc\\bin\\vue-tsc.js (MODULE_NOT_FOUND)"
component: "banmu-admin-web-env"
severity: "minor"
status: "workaround"
root_cause: "node_modules 是 pnpm 布局（.pnpm store 完整、.bin 包装器存在），但顶层依赖符号链接缺失（vue-tsc/vue/vite/element-plus 等目录不存在），npm 的 .bin 包装器解析 ..\\vue-tsc\\bin\\vue-tsc.js 时 MODULE_NOT_FOUND。"
fix: "未改动 node_modules（避免越界）。验证改用 .pnpm store 内 vue-tsc/vite 二进制直调；建议后续 `pnpm install` 重建顶层链接。"
related_files:
  - "banmu-admin/web/node_modules/.bin/vue-tsc.cmd"
  - "banmu-admin/web/package.json"
---

重构 3 个后台页面后需验证构建。运行 `npm run build`（vue-tsc --noEmit && vite build）失败：`Error: Cannot find module 'web\node_modules\vue-tsc\bin\vue-tsc.js'`。排查发现 node_modules 为 pnpm 布局（存在 .pnpm store 与 .bin 包装器），但顶层符号链接缺失：node_modules/vue-tsc、vue、vite、element-plus、@element-plus/icons-vue 实体目录均不存在（npm 的 .bin 包装器按 `..\vue-tsc\bin\vue-tsc.js` 解析即失败）。同时项目根有未跟踪的 pnpm-lock.yaml / pnpm-workspace.yaml，判断项目处于 npm→pnpm 迁移中途、顶层链接未生成或已被清理。绕过：从 .pnpm store 直接调用真实二进制验证——`node node_modules\.pnpm\vue-tsc@2.2.12_typescript@5.9.3\node_modules\vue-tsc\bin\vue-tsc.js --noEmit`（exit 0，全项目类型检查零错误）与 `node node_modules\.pnpm\vite@5.4.21\node_modules\vite\bin\vite.js build`（exit 0，6.55s 打包成功），确认三个重构页面编译与类型全部通过。修复建议：在 web 目录执行 `pnpm install`（store 内版本与 package.json 范围全部匹配：vue@3.5.42/vite@5.4.21/vue-tsc@2.2.12/typescript@5.9.3/icons-vue@2.3.2/element-plus@2.14.5），重建顶层链接即可恢复 npm/pnpm run build。
