---
date: "2026-09-04T06:54:36.001Z"
symptom: "上传 game_actions.js 到 /www/wwwroot/banmu-server/ 报 FileNotFoundError（目录不存在）"
component: "DEPLOY · 部署脚本"
severity: "major"
status: "fixed"
root_cause: "本地仓库名 banmu-server 与宝塔项目真实路径 sparrow-logic/banmu-server 不一致，部署时误用仓库同名路径。"
fix: "部署脚本改为上传到 /www/wwwroot/sparrow-logic/banmu-server/，重启 kill 3000 pid 后 nohup node fuwuqi.js（cwd 同目录）。"
related_files:
  - "banmu-server/game_actions.js"
---

部署 game_actions.js（灾难/生长时间改造）时按仓库名上传到 /www/wwwroot/banmu-server/ 报 SFTP FileNotFoundError。通过 /proc/<pid>/cwd 与 find 定位：游戏服（fuwuqi.js + game_actions.js）真实部署在宝塔 Node 项目目录 /www/wwwroot/sparrow-logic/banmu-server/（进程 pid 40797 cwd 指向该处），后台管理端才是 /www/wwwroot/banmu-admin/server。修正部署目标后上传成功；随后 node --check 通过、重启 3000 端口进程、实测 check_stage 触发 pest 灾难（elapsed<1800 且 50% roll 命中），验证新代码生效。教训：部署前先 find 定位真实目录；改 game_actions 后必须重启游戏服进程且核对进程启动时间晚于文件 mtime。
