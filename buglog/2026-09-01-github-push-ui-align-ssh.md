---
date: "2026-09-01T16:24:28.668Z"
symptom: "GitHub 推送面板与 SSH 面板视觉不一致（宽度/条目对齐/边框风格差异）"
component: "dsh-github-push"
severity: "minor"
status: "fixed"
root_cause: "GitHub 插件初版 UI 与 SSH 插件的几何参数存在偏差（modal 680 宽、item flex-start+9px padding+常显边框、缺 ghost active/bound/hint）"
fix: "src/client.js：modal 宽统一 640px、item 对齐/边框/padding 按 SSH 同款、补 ghost active/bound 按钮、push 卡与 hint 行结构对齐"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\client.js"
---

用户要求 GitHub 推送插件 UI 与 SSH 插件布局设计一致。逐项对照 dsh-server-ssh/src/client.js 后修正：1) modal 宽 680→640px（与 SSH 完全一致）；2) 列表条目 .dshgp-item 改 align-items:center（原 flex-start）+ padding 9px→7px 12px + 默认边框 transparent（hover/sel 才显色，与 SSH 同款，避免未选中条目常显边框）；3) dot 去掉 margin-top:8px（垂直居中与单行名称对齐）；4) 补 .dshgp-btn.ghost:active 态与 .bound 绿色按钮变体（SSH 同款）；5) 推送确认条改 .dshgp-push-title 结构（dot warn + 名称 grow 居中，与 SSH trust band 卡片语言一致）；6) 列表下方补 .dshgp-hint-row 提示行（SSH .dsss-hint 同风格，空列表/有列表各一文案）。产品 client.js 24.6kb→25.9kb；闸门 9/9、回归 4/4 全绿；产品验证 10 项对齐参数全 PASS（modal 640、align center、transparent 边框、dot 无 margin、ghost active、bound 按钮、push-title、hint 行、无 680/9px 残留）。
