---
date: "2026-09-01T09:14:55.040Z"
symptom: "纵向布局重构时删除了「当前会话已绑定」区块，用户要求恢复；列表操作按钮宽度参差"
component: "dsh-server-ssh"
severity: "minor"
status: "fixed"
root_cause: "上一轮纵向布局改造删除了原右侧绑定区块与 labelOf，未保留「当前会话已绑定」入口；行内按钮无统一宽度导致视觉不齐"
fix: "src/client.js：新增 .dsss-bound 绑定卡片区块（标题/解绑/已绑定行/绑定到行）与对齐样式（按钮 min-width、badge 徽标、labelOf 恢复）"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户要求：恢复「当前会话已绑定」区块（此前纵向布局重构时误删），保持原功能不变，同时检查列表对齐。改动：1) 弹窗顶部新增 .dsss-bound 卡片区块：标题「当前会话已绑定」+ 解绑按钮（未绑定时禁用），已绑定时显示绿点+服务器名+「本会话默认目标 · ssh_* 工具作用于此服务器」+ 绿色「已绑定」徽标；未绑定时显示提示文案；下方「绑定到：」行列出所有其他服务器快捷绑定按钮；2) 恢复 labelOf 函数（绑定区块显示服务器名用）；3) 列表对齐优化：行内操作按钮组统一 min-width:44px 消除参差；绑定区块 item 无边框无 hover（与列表 item 区分）；.dsss-badge 徽标样式补回。产品 client.js 24.7kb→28.0kb，闸门 8/8、回归 4/4 全绿；产品验证：dsss-bound/dsss-badge/dsss-bind-row 接线齐备、labelOf 恢复、align-items:center 9 处、min-width:44px 就位。
