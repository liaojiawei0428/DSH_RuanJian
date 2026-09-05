---
date: "2026-09-03T08:51:54.093Z"
symptom: "pnpm exec 命令在 banmu-admin/web 自动重装依赖：npm 安装的顶层包被移到 node_modules/.ignored，依赖版本集体漂移（element-plus 2.9.1→2.14.5），install 以 ERR_PNPM_IGNORED_BUILDS 失败。"
component: "banmu-admin-web-env"
severity: "major"
status: "fixed"
root_cause: "web 工程包管理器为 npm（仅 package-lock.json 被 git 跟踪），误用 pnpm exec 触发其自动 install，将 npm 布局包迁至 .ignored 并以新版本重装，且忽略 esbuild 等构建脚本导致 install 报错退出。"
fix: "删除 node_modules（含 .ignored）后 npm ci 按 package-lock.json 精确重装；后续验证直接调用 node_modules/.bin/vue-tsc.cmd，不用 pnpm。"
related_files:
  - "banmu-admin/web/package-lock.json"
  - "banmu-admin/web/node_modules"
---

在 F:\QiTa\banmu\banmufanghua\banmu-admin\web 执行 `pnpm exec vue-tsc --noEmit` 验证重构页面时，pnpm 检测到 node_modules 由其他包管理器（npm）安装，自动触发 install：先把 package.json 顶层 10 个包（vue/element-plus/vite/vue-tsc 等）移到 node_modules/.ignored，再从 pnpm store 硬链接新版本（element-plus 2.9.1→2.14.5、vue 3.4→3.5 等），并以 [ERR_PNPM_IGNORED_BUILDS]（esbuild/vue-demi 构建脚本被忽略）退出码 1 失败。排查：git ls-files 确认只跟踪 package-lock.json（pnpm-lock.yaml、pnpm-workspace.yaml 为未跟踪遗留），故项目正式包管理器是 npm。恢复：Remove-Item node_modules 后 `npm ci --no-audit --no-fund`（59s，exit 0），验证 element-plus 2.14.3 / vue 3.5.40 按 lock 精确安装、无 .pnpm/.ignored 残留，vue-tsc --noEmit 复测 exit 0。教训：该 web 工程验证类型/构建一律用 npm 或直接调 node_modules/.bin（勿用 pnpm）；临时 Test-Path 检查须注意工作目录（曾在项目根误测 web 的 node_modules 路径导致 False 误判）。
