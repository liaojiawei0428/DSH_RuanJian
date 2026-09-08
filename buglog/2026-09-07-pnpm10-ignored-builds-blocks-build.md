---
date: "2026-09-07T01:47:15.049Z"
symptom: "pnpm build 报 ERR_PNPM_IGNORED_BUILDS（esbuild/vue-demi）后 exit 1，构建从未执行。"
component: "banmu-admin-web 构建流程"
severity: "major"
status: "workaround"
root_cause: "pnpm 10 默认不运行依赖 postinstall（allowed-builds 策略），存在 ignored builds 时 install 直接报错退出，而 pnpm build 前会自动触发 install 检查。"
fix: "banmu-admin/web 构建命令改用 npm run build（跳过 pnpm 的 install 与 ignored-builds 拦截）。"
related_files:
  - "banmu-admin/web/package.json"
---

在 banmu-admin/web 跑 pnpm build：pnpm 每次先自动 install，因 esbuild@0.21.5 与 vue-demi@0.14.10 的 postinstall 被 pnpm10 默认 allowed-builds 策略屏蔽，install 阶段直接报 ERR_PNPM_IGNORED_BUILDS 并 exit 1，vue-tsc/vite 从未执行。pnpm rebuild 无效（每个命令前 deps-status-check 都重走 install）；pnpm approve-builds 为交互式无法脚本化。已确认 esbuild 平台二进制经 optionalDependencies(@esbuild/win32-x64) 已就位、vue-demi 经 package exports 自动选 vue3 入口，二者 postinstall 非必需。修复方式：改用 npm run build（scripts 为 vue-tsc --noEmit && vite build，不经过 pnpm install）。验证：vue-tsc 类型检查通过、vite 构建 11.6s、dist 54 文件部署上线公网验证正常。pnpm 生成的 pnpm-lock.yaml / pnpm-workspace.yaml 未提交（工程为 npm 管理）。
