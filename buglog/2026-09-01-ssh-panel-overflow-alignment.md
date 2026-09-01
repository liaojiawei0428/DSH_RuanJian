---
date: "2026-09-01T09:24:07.220Z"
symptom: "服务器名称条目/表单控件跑出弹窗边界，绑定区块与列表条目不对齐"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "flex 子项默认 min-width:auto 导致内容不可收缩（ellipsis 失效、溢出），表单控件无定宽；绑定区块与列表条目 padding/边框不一致破坏列轴对齐"
fix: "src/client.js：列表/区块/表单全部补 min-width:0 + box-sizing，select/input 定宽 100%，绑定区块 item 与列表统一 padding 与边框"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户反馈：服务器列表条目（服务器名称处）的 UI 选择框跑出弹窗边界，且视图不对称不对齐。根因：1) flex 子项 min-width:auto 默认值——.dsss-item、.dsss-roster、.dsss-bound、.dsss-field 缺 min-width:0，容器宽度不足时条目/表单控件不收缩，ellipsis 不生效，内容溢出弹窗；2) 编辑表单 select/input 无 width:100% 与 box-sizing:border-box，grid 列内被内容撑破；3) 绑定区块 item 用 padding:6px 0 + 无边框，与列表 item（padding:7px 12px + 边框）高度和列对齐不一致。修复：.dsss-item 加 min-width:0 + box-sizing:border-box；.dsss-roster/.dsss-bound 加 min-width:0；.dsss-body > * 统一 min-width:0 防嵌套溢出；select/input width:100% + box-sizing；绑定区块 item 改用与列表一致的 padding:7px 12px + border-l1，dot/name/meta/actions 列轴完全对齐。产品 client.js 28.0kb→28.3kb，闸门 8/8、回归 4/4 全绿；产品验证 min-width:0 8 处、box-sizing 2 处、field min-width、select width:100%、绑定 item 统一 padding 均就位。
