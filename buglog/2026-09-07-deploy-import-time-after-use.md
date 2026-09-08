---
date: "2026-09-07T06:02:09.753Z"
symptom: "部署脚本重启段 NameError，游戏服 kill 后未拉起"
component: "banmu-admin/deploy/deploy_sysmsg_1_game.py"
severity: "minor"
status: "fixed"
root_cause: "import time 语句手误放在第一个 time.sleep(2) 之后，Python 执行到 sleep 时 time 尚未导入。"
fix: "import time 移到脚本顶部；异常后用 ssh_bash 立即拉起游戏服并校验端口。"
related_files:
  - "banmu-admin/deploy/deploy_sysmsg_1_game.py"
---

部署游戏服时，deploy_sysmsg_1_game.py 在 kill 旧进程后执行 time.sleep(2) 处抛 NameError: name 'time' is not defined——import time 被误写在文件中部（第一个 time.sleep 之后）。游戏服进程已被 kill 但未拉起，处于宕机状态。修复：import time 移到文件顶部；用 ssh_bash 补拉游戏服（nohup node fuwuqi.js）并校验 3000 端口，新实例 pid 29481 正常监听。教训：部署脚本所有 import 集中在顶部；kill 进程后脚本异常必须立即检查服务是否还在运行。
