---
date: "2026-09-07T01:47:15.209Z"
symptom: "执行 ssh/scp 报命令不存在，dist 无法按原流程部署。"
component: "部署工具链"
severity: "major"
status: "workaround"
root_cause: "本机 Windows 未安装任何 SSH 客户端，PATH 中无 ssh/scp，既有部署命令无法执行。"
fix: "新增 paramiko 部署脚本 banmu-admin/deploy/deploy_dist_local.py（备份+清空+SFTP 上传+验证），作为本机标准部署通道。"
related_files:
  - "banmu-admin/deploy/deploy_dist_local.py"
---

部署聊天板块 dist 时发现 pwsh 中 ssh/scp 均报 "not recognized as a name of a cmdlet"；检查 C:\Windows\System32\OpenSSH\ssh.exe、Program Files\Git\usr\bin\ssh.exe、chocolatey 等常见位置均不存在，where.exe 全查无果，即本机未安装任何 SSH 客户端（OpenSSH/Git/PuTTY）。DSH 的 ssh_* 工具报 Not connected（需 GUI 连接对话框）。解决：编写 banmu-admin/deploy/deploy_dist_local.py，用已安装的 paramiko 5.0.0 完成连接（密钥 F:\QiTa\banmu\SSH_key_fixed）、部署前 tar 备份远端 dist 至 /tmp/dist-backup-*.tgz、清空后 SFTP 递归上传、远端 find 计数与读 index.html 校验新 chunk。验证：54 文件上传成功，公网 https://yx.maque.uno index 200、逻辑页 chunk 200 且含 chat-board 新代码特征。教训：本机部署通道统一走该 paramiko 脚本；SSH 密钥用 Windows 绝对路径。
