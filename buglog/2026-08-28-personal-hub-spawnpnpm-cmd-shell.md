---
date: "2026-08-28T09:49:07.457Z"
symptom: "personal_hub_reapply 在 Windows 报 pnpm install 启动失败：先 spawnSync pnpm ENOENT，改 pnpm.cmd 后 EINVAL，加 shell 后 DEP0190 弃用警告"
component: "dsh-personal-hub"
severity: "major"
status: "fixed"
root_cause: "Windows 下 pnpm 是 pnpm.cmd 批处理垫片：spawnSync 不经 shell 解析不到（ENOENT）；Node CVE-2024-27980 补丁后未加 shell:true 直接 spawn .cmd 一律 EINVAL；args 数组 + shell:true 组合触发 DEP0190 拼接弃用警告。"
fix: "spawnSync('pnpm install --reporter append-only', { cwd: profileDir, shell: true, timeout: 5min, encoding: 'utf8' })——整串硬编码命令走 shell；参数无用户输入，无注入面，兼容 pnpm.cmd 与 DEP0190。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
---

发现过程：mock probe 端到端跑 reapply，前四步（备份/重写×2）成功后报 pnpm install 启动失败。三次迭代：裸 pnpm → ENOENT；改 pnpm.cmd → EINVAL（Node ≥18.20/20.12 CVE-2024-27980 补丁禁止裸 spawn .cmd/.bat）；加 shell:true + args 数组 → 成功但触发 DEP0190 弃用警告；终版整串命令字符串 + shell:true，无警告、幂等通过。
