---
date: "2026-09-03T10:23:29.761Z"
symptom: "verify-deploy.sh 维度 30 grep 目标含不存在的 classifyAgnesVideoError 函数, 与源码不符"
component: "scripts/verify-deploy.sh"
severity: "minor"
status: "fixed"
root_cause: "清理 DeepSeek 字样时把 verify-deploy 维度 30 的 grep 目标从已删的 DeepseekError 符号改成 Agnes 三兄弟函数, 但 agnesVideoProvider 从未定义 classifyAgnesVideoError (video 错误处理路径不同), 造成 grep 目标与源码不符"
fix: "verify-deploy.sh L638 V30_AGNES_ERRORS 的 grep pattern 删掉 'classifyAgnesVideoError' 项 (该函数不存在), 保留实际存在的 classifyAgnesTextError|classifyAgnesImageError"
related_files:
  - "scripts/verify-deploy.sh"
  - "apps/server/src/services/agnesTextProvider.ts"
  - "apps/server/src/services/agnesImageProvider.ts"
dsh_commit: "a1f1441"
---

全仓库 DeepSeek 字样清理时, verify-deploy.sh 维度 30 原 grep 目标 'classifyDeepseekError\|DeepseekError' 因 src 已无该符号恒 0 命中 → 改为 'classifyAgnesTextError\|classifyAgnesImageError\|classifyAgnesVideoError'. 但实测 dist 编译产物中 classifyAgnesVideoError 0 命中, 查源码 apps/server/src/services/ 仅存在 classifyAgnesTextError (agnesTextProvider.ts:62) + classifyAgnesImageError (agnesImageProvider.ts:43), 不存在 video 版 classify 函数 (agnesVideoProvider 走的是不同错误处理). grep 目标含不存在函数 → 维度 30 的 V30_AGNES_ERRORS 恒为 2 (只匹配 text+image 两文件) 而非 3. 修法: grep 目标改为实际存在的两个函数. 已用 python 模拟 grep 语义验证: V30_AGNES_ERRORS=2, V30_AGNES_API=5, V30_TOTAL>=4 通过. 已同步到远端 /www/wwwroot/shipin-APP/scripts/verify-deploy.sh (远端维度 30 因 server 无 monorepo 根而 skipped, 不影响 26 PASS 结果).
