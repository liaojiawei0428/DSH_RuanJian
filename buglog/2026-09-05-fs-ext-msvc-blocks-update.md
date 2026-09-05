---
date: "2026-09-05T01:51:42.198Z"
symptom: "update-dsh.ps1 每轮升级在\"安装依赖 (pnpm install --frozen-lockfile)\"阶段失败，日志\"构建阶段失败: pnpm install 失败\"，官方 0.1.3-alpha.1 无法上线"
component: "update-dsh.ps1 / 主仓库依赖（fs-ext 原生模块）"
severity: "major"
status: "fixed"
root_cause: "官方提交 c58097a826（session JSONL 跨进程写锁）新增原生依赖 fs-ext@2.1.1，其 install 脚本 node-gyp configure build 需要 MSVC C++ 工具链，而本机从未安装 Visual Studio / Build Tools，node-gyp 报 \"Could not find any Visual Studio installation\"，pnpm install 整体失败，升级中止（旧服务不受影响）。"
fix: "winget 安装 VS 2022 Build Tools（仅 C++ 工作负载）后重跑 update-dsh.ps1，全链成功升级到 0.1.3-alpha.1。"
related_files:
  - "E:\\DSH\\DSH-ops\\update-dsh.ps1"
  - "E:\\DSH\\Deepseek_DSH\\pnpm-workspace.yaml"
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-persistence-jsonl\\package.json"
dsh_commit: "d347e70390"
---

用户报"无法更新拉取官方仓库"。排查：git fetch/pull 完全正常（HEAD 已到 d347e70390，upstream=origin/master 正确），真正卡点在 update-dsh.ps1 第 4 步 pnpm install --frozen-lockfile。手动复现：pnpm 输出 node-gyp "Could not find any Visual Studio installation"，fs-ext@2.1.1 install 脚本为 `node-gyp configure build`，npm 包内无预编译产物（build 目录为空）。核实本机 Program Files 下无任何 Visual Studio/vswhere——从未安装 C++ 工具链。官方 pnpm-workspace.yaml allowBuilds 明确 fs-ext: true 并要求现场编译，无绕过设计。修复：winget 静默安装 Microsoft.VisualStudio.2022.BuildTools（--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended，MSVC 14.44.35207），vswhere 验证可发现后，经 WMI 独立启动 update-dsh.ps1 完成升级：install 22 秒 OK、build 3 分钟 OK、9 插件闸门 PASS、服务重启上线 0.1.3-alpha.1。验证：node apps/cli/lib/bin.js --version = 0.1.3-alpha.1，health-check.py 全绿。教训：官方新增原生依赖后，Windows 机器升级前置条件多了 MSVC 工具链；DEPLOY.md 环境要求应补充。
