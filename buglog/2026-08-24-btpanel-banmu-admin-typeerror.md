---
date: "2026-08-24T02:09:54.869Z"
symptom: "宝塔面板对 banmu_admin Node 项目记录异常报 TypeError，无法用面板启动/重启 admin 进程（服务器重启后需手动拉起）"
component: "banmu-admin 部署/宝塔面板"
severity: "minor"
status: "workaround"
root_cause: "宝塔 nodejs-service.py 对 banmu_admin 的项目记录数据异常（具体面板内部根因未深挖），导致 add/modify/restart 子命令抛 TypeError；deploy.sh 第[5/5]步依赖该脚本注册并重启服务，因此自动部署的服务管理环节失效，只能 nohup 手动拉起。"
fix: "临时以 nohup 手动拉起进程保持服务（当前状态）；根治待办二选一：①在宝塔面板重建/修复 banmu_admin 的 Node 项目记录后面板托管重启；②改用 systemd unit 托管（推荐）。尚未执行根治。"
related_files:
---

发现于 2026-08-23 会话：admin 进程此前为手动 nohup 启动，宝塔面板 Node 项目管理器对 banmu_admin 记录操作抛 TypeError，无法通过面板重启。进程本身稳定运行（node dist/main.js 监听 3002），仅面板托管失效；风险是服务器重启后 admin 不会自启。用户决定记入进度表待办。本条为 harness 检测到未记录的修复形活动后的补录；根因未深挖（面板内部脚本问题），以绕过为主。
