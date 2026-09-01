---
date: "2026-09-01T04:51:32.295Z"
symptom: "安装第三方插件 dsh-remote-ssh（github:NaNQiQ/deepseek-harness-remote-ssh）后 DSH boot 全灭，GUI 报插件无法安装，服务反复崩溃无法启动"
component: "plugins-install"
severity: "critical"
status: "fixed"
root_cause: "插件依赖 @deepseek-ai/dsh-bash-local@^0.1.0-rc.8，其非 optional peer 依赖 @deepseek-ai/dsh-settings@^0.1.0-rc.8 在公开 npm registry 上不存在（最新仅 0.0.1-rc.x，官方内部包未发布该版本线），pnpm 装不上，运行期 import 崩溃传导至插件加载失败 → boot 全灭。安装时 pnpm 的 peer WARN 未被当作阻断信号。"
fix: "备份后完整移除 dsh-remote-ssh：profile package.json 移除 dependencies 条目与 dsh.profile.bundles 条目（整体原子重写），清理 node_modules/dsh-remote-ssh 与 pnpm-lock.yaml 残留，闸门全绿后经 request_restart 标准重启链恢复服务。备份留存 ~/.dsh/backups/20260901-124944。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
  - "E:\\DSH\\DSH-ops\\PLUGIN-STANDARD.md"
---

调查过程：用户要求搜索网上 DSH 服务器插件，选定 NaNQiQ/deepseek-harness-remote-ssh（★2，MIT）。安装前已做源码审查（package.json 无危险脚本、主入口无恶意行为、宿主能力走 optional peerDependencies），但遗漏了传递依赖的 peer 可满足性检查：插件普通依赖 @deepseek-ai/dsh-bash-local@^0.1.0-rc.8，而该包声明非 optional peer @deepseek-ai/dsh-settings@^0.1.0-rc.8——DSH 官方 0.1.0-rc.8 系列包未发布到公开 npm（registry 上 @deepseek-ai/dsh-settings 最新仅 0.0.1-rc.x），pnpm 安装时给出 WARN「Issues with peer dependencies found」（当时误判为 optional peer 无碍），运行期 dsh-bash-local import 不到 dsh-settings 即崩，插件 apply 失败导致 boot 全灭、GUI 报插件无法安装。防线缺口分析：G1 闸门只校验 dsh.profile.bundles 内 link 插件，github/npm 安装的非 link 插件不在其范围；G3 定位器四种格式均不匹配 node_modules 内 github 包的报错路径；G5 看门狗的 disable-plugin.mjs 正确地拒绝摘除非 link 依赖（设计如此）——三层防线均不覆盖「第三方插件不可满足 peer」。恢复步骤：备份 profile package.json + pnpm-lock.yaml 到 ~/.dsh/backups/20260901-124944（D4）；原子移除四处残留（dependencies、bundles、node_modules、lockfile）；闸门全绿；request_restart 标准重启链；重启后体检确认服务就绪、err.log 无残留报错、7 自研插件工具在位。预防建议：今后安装任何 npm/github 来源的 DSH 插件前，先 pnpm why 或检查其依赖树的 peer 声明是否在本机 npm registry 可满足；DSH 内部包（@deepseek-ai/*）版本依赖的插件在公开 registry 生态天然不可装，需等上游改用已发布版本或提供 vendored 依赖。本机 DSH 版本 0.1.2-alpha.3（源码部署）。
