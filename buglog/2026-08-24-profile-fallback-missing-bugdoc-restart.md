---
date: "2026-08-24T08:15:23.432Z"
symptom: "`dsh web` 启动即抛 Error: failed to import loader entry ma-bugdoc (@memory-assistant/dsh-ma-bugdoc): Cannot find package ... imported from .dsh-home/profiles/web/,进程退出码 1"
component: "apps/cli profile module fallback"
severity: "critical"
status: "fixed"
root_cause: "healProfilesModuleFallback 从 apps/cli/package.json(INSTALL_ANCHOR)做依赖闭包 BFS 来维护 .dsh-home/profiles/node_modules 扁平符号链接;新增的 @memory-assistant/dsh-ma-bugdoc(ma-bundle patch 插入)与 @memory-assistant/dsh-ma-restart(agent preset 引用)未声明进 apps/cli 的 dependencies,闭包不含它们,Loader 在 profile 目录解析裸插件名时 ERR_MODULE_NOT_FOUND,fail-loud 终止启动。"
fix: "apps/cli/package.json 的 dependencies 补上 \"@memory-assistant/dsh-ma-bugdoc\": \"workspace:^\" 与 \"@memory-assistant/dsh-ma-restart\": \"workspace:^\",pnpm install 重建链接;下次启动 healProfilesModuleFallback 自动补齐 profiles/node_modules 符号链接。"
related_files:
  - "apps/cli/package.json"
  - "packages/boot/app-boot/src/profile.ts"
  - "packages/ma/bundle/cordis.patch.yml"
---

排查路径:bug_search 无历史记录 → 读 .dsh-home/profiles/web/{package.json,cordis.yml} 确认树由 patch 组成 → 读 packages/boot/app-boot/src/profile.ts 理解 healProfilesModuleFallback 以 INSTALL_ANCHOR(apps/cli/package.json)为起点做依赖闭包 BFS 并维护 $DSH_HOME/profiles/node_modules 扁平链接 → 列目录发现 @memory-assistant 下 12 个链接缺 dsh-ma-bugdoc 与 dsh-ma-restart → 对照 apps/cli/package.json dependencies 确认恰好漏声明这两个包(bugdoc 由 ma-bundle/cordis.patch.yml 第 27-28 行插入,restart 由 apps/cli/config/agent-presets/memory-assistant/agent.cordis.yml 第 229 行引用)→ 补依赖 + pnpm install → 后台启动 node --import tsx/esm apps/cli/src/bin.ts web --no-open --port 3100,输出 "dsh web: http://127.0.0.1:3100",5 秒后 HTTP 探测返回 200。两包的 lib/ 产物此前已构建,无需重新 build。教训:向 bundle patch 或 agent preset 新增裸插件名时,必须同步把该插件包加入 apps/cli 的 dependencies,否则 profile 启动闭包不含它。
