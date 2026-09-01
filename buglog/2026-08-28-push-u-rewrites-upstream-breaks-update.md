---
date: "2026-08-28T03:37:45.880Z"
symptom: "自动更新每轮显示\"git pull 完成 OK\"但版本不变、重启后仍旧版，版本胶囊持续报有新版本，无限循环"
component: "update-dsh.ps1 / 主仓库 git upstream 配置"
severity: "major"
status: "fixed"
root_cause: "git push -u personal master 的 --set-upstream 把 branch.master.remote 从 origin 改写为 personal；update-dsh.ps1 第 154 行 git pull --ff-only 不带 refspec，遵循分支 upstream，实际拉取个人仓库（Already up to date）→ 退出码 0 假成功 → HEAD 不动 → 构建重启仍是旧版 → 版本胶囊（对比官方 origin/master）再次报新版，形成循环"
fix: "git branch --set-upstream-to=origin/master master 恢复 upstream；已验证 branch.master.remote=origin"
related_files:
  - "E:\\DSH\\DSH-ops\\update-dsh.ps1"
---

用户报"更新程序正常拉取但重启后仍旧版本，插件一直显示有新版本，无限重复拉取"。dsh-update.log 显示每轮"发现更新: 本地 137997cb10e8 -> 远端 cd5ef8148158 → git pull 完成 OK → 构建 → 重启"但下一轮本地仍是 137997cb10e8。git reflog 证明循环期间 HEAD 从未移动。教训：对作为更新主体的仓库添加第二个 remote 时不得用 -u；update-dsh.ps1 可加固——pull 后校验 rev-parse HEAD 是否等于远端，不等则 fail-loud。
