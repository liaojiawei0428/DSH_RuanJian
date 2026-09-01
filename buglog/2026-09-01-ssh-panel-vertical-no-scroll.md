---
date: "2026-09-01T09:09:09.954Z"
symptom: "SSH 面板两栏排版不受欢迎，编辑时出现滚动条"
component: "dsh-server-ssh"
severity: "minor"
status: "fixed"
root_cause: "上一版采用左右两栏 grid + 弹窗 max-height 滚动设计，用户明确偏好纵向排列且内容一屏放下"
fix: "src/client.js：弹窗去高度限制、body 改纵向 flex、绑定/解绑移入列表行内、表单改两列网格、删死代码"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户反馈上一版 UI 的左右两栏排版不受欢迎，要求改为纵向排列且不使用滚动条。改动：1) 弹窗去掉 max-height:calc(100vh-48px) 与 overflow:hidden，宽度 720→640px，高度自适应内容（永不出滚动条）；2) .dsss-body 从 grid 两栏（1.15fr 1fr）改为 flex 纵向；3) 布局次序改为 notice → 服务器列表标题行（新增大按钮）→ 列表（行内含连接点/绑定/重连/删除）→ 提示 → 编辑表单；4) 绑定操作移入列表行内：「已绑定」行显示绿色「已绑定 · 解绑」按钮（点击 target.clear 并提示），未绑定行显示「绑定」按钮；5) 表单字段从 7 个纵向字段压缩为两列 grid（名称+主机、端口+用户名、认证+密钥/密码、远端根目录 span2），避免编辑时纵向过长；6) 清理死代码：删除 labelOf、.dsss-col、.dsss-badge 样式、@media 单栏块。产品 client.js 26.8kb→24.7kb，闸门 8/8、回归 4/4 全绿；产品验证无 max-height/overflow-y/两栏 grid 残留，绑定解绑按钮含真实 target.clear 动作（esbuild 对 U+00B7 用 \xB7 转义，中文文案仍完整）。
