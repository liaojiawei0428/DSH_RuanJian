---
date: "2026-09-07T04:01:00.725Z"
symptom: "部署重启后 admin 仍跑旧代码，新端点全部 404 Cannot POST"
component: "banmu-admin/deploy/deploy_chat_nick_1_server.py"
severity: "major"
status: "fixed"
root_cause: "远程 exec_command 的 bash -c 命令行包含被匹配字符串，pgrep -f 命中调用 shell 自身（pid 更小），kill 无效，旧 node 进程未杀、新实例端口占用静默退出。"
fix: "deploy_chat_nick_restart.py/deploy_chat_nick_start.py：ps -C node + grep 'dist/main\\.js$' 精确定位，杀后先确认端口关闭再拉起，校验新进程 etimes。"
related_files:
  - "banmu-admin/deploy/deploy_chat_nick_1_server.py"
  - "banmu-admin/deploy/deploy_chat_nick_restart.py"
  - "banmu-admin/deploy/deploy_chat_nick_start.py"
---

部署聊天昵称操作（新端点 player-action/report/reports/handle）时，paramiko 脚本上传 server dist 后重启 admin：自测所有新端点 404 "Cannot POST"。排查：ss -tlnp 显示 3002 仍由 etimes=5689s 的旧进程 64172 监听；新 setsid nohup 实例因端口占用失败。根因是 `pgrep -f "node dist/main.js" | head -1` 的 -f 全命令行匹配到了 exec_command 的 bash -c 自身（命令行内含该字符串、pid 更小被 head -1 选中），kill 杀了个 No such process，真进程没被杀。修复：改用 `ps -C node -o pid=,args= | grep "dist/main\.js$"` 精确锚定命令行结尾，并先确认端口关闭再拉起、校验新 pid 的 etimes。修复后新 pid 52428 监听 3002，全端点自测通过。
