---
date: "2026-09-08T01:38:04.620Z"
symptom: "推送插件报 git add -A 失败 (exit 128), 无法推送"
component: "dsh-github-push"
severity: "major"
status: "fixed"
root_cause: "Windows 保留设备名文件 CON 使 git 枚举目录时 stat 失败 fatal exit 128; 且插件绑定路径指向父目录 Freebuff 个人仓库而非真正的项目仓库子目录"
fix: "\\\\?\\ 前缀删 CON 保留名文件 + 父/子仓库 .gitignore 排除工具缓存 + 删除含凭据脚本 + 插件绑定 localPath 改到真正的项目仓库子目录"
related_files:
  - "C:\\Users\\Administrator\\.dsh\\github-push\\state.json"
  - "F:\\QiTa\\banmu\\APP\\.gitignore"
  - "F:\\QiTa\\banmu\\APP\\ai-video-script-app\\.gitignore"
dsh_commit: "5d34247"
---

用户报告自研推送插件 git add -A 失败 exit 128. 复现: 在插件绑定目录 F:\QiTa\banmu\APP 复刻插件环境 (git -C F:\QiTa\banmu\APP add -A + GIT_CONFIG_GLOBAL=NUL) → exit 128, stderr = "fatal: unable to stat 'CON': No such file or directory". 根因分两层: (1) 直接诱因: 该目录存在 Windows 保留设备名文件 'CON' (22177 字节, 内容是某 subagent 请求 JSON 的误写入产物), git-for-windows 枚举目录时 stat('CON') 失败 → fatal exit 128; (2) 深层根因: 插件绑定「APP视频平台」(id bmtk6bosbsmcv38ht) 的 localPath 指向 F:\QiTa\banmu\APP 父目录, 而真正的项目仓库在子目录 F:\QiTa\banmu\APP\ai-video-script-app — 父目录是 "Freebuff Desktop" 的个人 git 仓库 (无 remote, 含 .zcode/.freebuff/.workbuddy 工具缓存, 其中 .zcode/credentials.json + certs/zcode-network-ca.key + .freebuff/desktop.db 等敏感文件). 修复: 1) 用 \\?\ 前缀删除 CON + $null + nul' + console.log('Err 等 6 个重定向误产物文件 (Windows 保留名/垃圾文件); 2) 父目录补 .gitignore 排除 .zcode/.freebuff/.workbuddy + Windows 保留名清单, 防敏感文件被 add 卷入库 (验证 add 后不再出现这些目录); 3) 删除父目录两个含真实凭据的脚本 test_video_sizes.py (内嵌 admin JWT, role=admin, 有效期至 2027-07-21) 与 migrate-faststart.js (内嵌 COS SecretId/SecretKey AKID...); 4) 用户确认后把插件绑定 localPath 从 F:\QiTa\banmu\APP 改为 F:\QiTa\banmu\APP\ai-video-script-app (直接原子改写 state.json, 先备份 .bak-bindfix); 5) 子仓库 .gitignore 追加 .workbuddy/.zcode/.freebuff 忽略 (commit 5d34247). 验证: 新绑定路径复刻插件流程 rev-parse/status/add -A 全 exit 0. 遗留: 插件进程启动时 store.load() 一次, 改 state.json 后需重启 DSH 服务让内存 store 读到新路径; 推送到远端会带上前 20 个 ahead commit (含上轮全清 commit), 未执行 push (等用户).
