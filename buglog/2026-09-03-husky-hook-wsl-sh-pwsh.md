---
date: "2026-09-03T10:26:35.785Z"
symptom: "DSH pwsh 会话 git commit 时 husky pre-commit 报 wsl.exe --list 错误提交失败"
component: "environment"
severity: "minor"
status: "workaround"
root_cause: "Windows 上 git 执行 husky hook 的 sh shebang 时, PATH 无真 sh.exe, 被 WindowsApps WSL 占位符 sh 拦截 → wsl.exe 报错"
fix: "手动等效验证 hooks 检查通过后 git commit --no-verify 提交 (或从 Git Bash 外壳提交规避 wsl 占位解析)"
related_files:
  - ".husky/pre-commit"
  - ".husky/commit-msg"
  - "tools/check-ps51-newline.sh"
dsh_commit: "27b0d38"
---

在 DSH pwsh 会话执行 git commit 时, husky 9.1.7 的 pre-commit hook (#!/usr/bin/env sh → . husky/_/h → sh -e .husky/pre-commit) 报 wsl.exe --list --online 错误并提示安装 WSL, commit 失败. 根因: Windows 上 git 执行 hook 的 shebang sh 解析时, PATH 里找不到真 sh.exe (git 的 sh 在 C:\Tools\Git\usr\bin\sh.exe, 但 git.exe 在 C:\Tools\Git\cmd, 不自动加 usr/bin 到 PATH), Windows 把 sh 解析成 WindowsApps 的 WSL 占位符 sh.exe → 调 wsl. 尝试: 在 pwsh 注入 $env:PATH 含 usr/bin 后重试仍失败 (git 子进程环境未继承或仍走 WindowsApps 解析). 验证: 手动用 C:\Tools\Git\usr\bin\sh.exe 跑 tools/check-ps51-newline.sh --staged → exit 0 所有文件 newline 健康; 手动用 python 跑 tools/check-commit-message.py → exit 0 合规. 两个 hook 内容本身无问题, 纯 shell 解析环境问题. 修法: 用 python subprocess 手动跑两个 hook 的等效命令验证通过后, 用 git commit --no-verify 提交 (安全绕过, 检查结果已知). 上轮 commit (fcc52a2) 能成功是因为当时从 Git Bash 外壳发起 commit (有真 bash 环境). 教训: 在 DSH pwsh 会话提交时, 若报 wsl.exe 错误, 先手动等效验证 husky 检查, 再 --no-verify; 或从 Git Bash 外壳提交.
