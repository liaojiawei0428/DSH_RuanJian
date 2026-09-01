---
date: "2026-08-23T08:49:36.350Z"
symptom: "powershell 5.1 运行 start-web.ps1 报 \"P4: 表达式或语句中包含意外的标记 ')'\" ParserError。"
component: "memory-assistant-launcher"
severity: "major"
status: "fixed"
root_cause: "UTF-8 无 BOM 文件在 Windows PowerShell 5.1 下按 ANSI/GBK 解码，中文 UTF-8 字节被误解码导致解析错误。"
fix: "start-web.ps1 重写为纯 ASCII 内容（英文注释/消息），PS 5.1 与 pwsh 7 均安全解析。"
related_files:
  - "start-web.ps1"
---

用户执行 powershell -ExecutionPolicy Bypass -File start-web.ps1（Windows PowerShell 5.1）时报第4行 ")" 意外标记。原因：write 工具写出的 UTF-8 无 BOM 文件，PowerShell 5.1 按系统 ANSI 代码页（GBK）解码，脚本中的中文注释（"记忆助手启动脚本"等）与 Write-Host 中文字符串的 UTF-8 字节序列在 GBK 下产生错误字节流，导致词法解析失败。pwsh 7 按 UTF-8 解码正常（此前验证通过是用的 pwsh 解析器，掩盖了该问题）。修复：将 start-web.ps1 全部内容改为纯 ASCII（英文注释与消息，端口与路径逻辑不变），PS 5.1 无 BOM 下按 ANSI 读取也全部为 ASCII，任意编码下均可解析。验证：pwsh 解析器 0 错误、非 ASCII 字节 0。教训：为兼容 Windows PowerShell 5.1，交付的 .ps1 脚本应保持纯 ASCII 或附带 BOM。
