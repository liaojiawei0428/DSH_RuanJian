---
date: "2026-09-01T00:00:00.000Z"
symptom: "DSH 启动 3 次全灭（09/01 上午起）：err.log 报 `failed to import loader entry dsh-remote-ssh (dsh-remote-ssh): The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'installSettingsSection'`；看门狗误判肇事者为 cordis:include、隔离被拒（非 link 依赖）、重启预算耗尽后放弃自动恢复。"
component: "dsh-remote-ssh（第三方 github 插件）安装缺陷 + watchdog 定位器外层误抓"
severity: "major"
status: "fixed"
root_cause: "profile 装入第三方插件 dsh-remote-ssh（github:NaNQiQ/deepseek-harness-remote-ssh）：其依赖链 dsh-bash-local@0.1.0-rc.8 运行期 import `installSettingsSection` from '@deepseek-ai/dsh-settings'，而该包以 transitivePeerDependencies 被 pnpm 排除——registry 上 @deepseek-ai/dsh-settings 无任何满足 ^0.1.0-rc.8 的版本（最新仅 0.0.1-rc.x），peer 无法解析 → 安装不完整 → boot 崩溃。此类失败在自研 link 插件闸门（G1/G2）覆盖范围之外。另：watchdog 定位器第一模式先匹配到外层 `failed to apply loader entry include (cordis:include)`，把 include 包装条目误当肇事插件，disable-plugin 拒绝（非 link: 依赖，护栏正确），预算 3 次耗尽转人工。"
fix: "① 备份后（backups\\20260901-124732）从 profile dependencies+bundles 移除 dsh-remote-ssh，pnpm install 清理 7 个残留包，lockfile 0 引用，闸门 7/7，服务恢复。② 定位器（start-dsh-web.ps1 与 watchdog-dsh.ps1 两处）新增第一优先模式 `failed to import loader entry \\S+ \\(([^)]+)\\)`（最内层 entry），验证对 remote-ssh 错误逐字命中 dsh-remote-ssh；两脚本语法 OK。后续此类失败若再发生，日志将直指真凶。"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\profiles\\web\\package.json"
  - "E:\\DSH\\DSH-ops\\start-dsh-web.ps1"
  - "E:\\DSH\\DSH-ops\\watchdog-dsh.ps1"
---

排查路径：① watchdog.log 12:42:53 显示定位 cordis:include → disable 拒绝 → 预算耗尽退出；用户 12:44/15:25 手启仍崩。② err.log 关键行 `failed to import loader entry dsh-remote-ssh (dsh-remote-ssh): ...does not provide an export named 'installSettingsSection'` + 栈指向 profile node_modules/@deepseek-ai/dsh-bash-local。③ 读 profile package.json：dsh-remote-ssh 是 github: 依赖（非 link），bundles 含之；lockfile snapshots 显示 dsh-bash-local 快照只有 schemastery，dsh-settings 列于 transitivePeerDependencies（- 前缀）未安装；pnpm view 证实 registry 无 0.1.0-rc.x 版本。④ 结论：第三方插件的 peer 依赖不可解析，属安装即残缺，闸门管不到（非 link）、看门狗救不了（disable 护栏拒绝非 link）。教训：第三方 github/npm 插件的 peer 依赖链必须安装前验证（pnpm view 各 peer 版本存在性）；watchdog 定位器应取最内层 entry。