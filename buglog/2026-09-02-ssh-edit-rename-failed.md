---
date: "2026-09-02T01:58:10.226Z"
symptom: "ssh_edit 修改远端文件一律失败 \"rename failed: Failure\"，文件不变"
component: "ssh-tool"
severity: "major"
status: "workaround"
root_cause: "ssh_edit 工具实现对已存在文件的原子替换失败：临时文件写入后 rename 阶段报 \"rename failed: Failure\"；同环境同目录下 ssh_write 正常，排出远端权限/磁盘因素，判定为工具自身 temp/rename 实现缺陷。"
fix: "绕过：使用 ssh_bash 内嵌 python3 脚本（open().read()→str.replace(count==1 断言)→write）完成远端文本替换；新文件用 ssh_write。ssh_edit 修复需改工具实现（检查其 rename 源文件路径与 CRLF 归一化逻辑）。"
related_files:
---

部署公会管理功能时需在远端(腾讯云 119.91.155.46)修改 /www/wwwroot/sparrow-logic/banmu-server/game_actions.js 与 fuwuqi.js。三次 ssh_edit 调用（含小替换）均返回 "Error: rename failed: Failure"，且文件未发生任何改动。已排除环境因素：远程文件权限 666、目录可写（touch/mv 测试通过）、磁盘 54% 充足。同时 ssh_write 同会话同目录小文件写入完全正常（sibling temp + rename 成功）。结论为 ssh_edit 工具自身的实现缺陷（可能其 CRLF 归一化或临时文件命名/rename 逻辑损坏），而非远端环境。已绕过：改用 ssh_bash + 远端 python3 读改写替换（锚点 count 断言 + node --check 验证），与 ssh_write 新建文件，全部成功；文件最终与本地逐字符一致（结构 md5 完全匹配）。
