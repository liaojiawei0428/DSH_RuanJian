---
date: "2026-09-01T08:47:47.060Z"
symptom: "SSH 面板 UI 与 DSH 原生胶囊/弹窗风格割裂（方按钮、直角弹窗、错误 token），布局为冗长单列"
component: "dsh-server-ssh"
severity: "minor"
status: "fixed"
root_cause: "旧实现使用未定义 token（--dsw-alias-bg-surface/fg-secondary/bg-hover 等官方从未定义，只有 fallback 生效）且几何参数与 ui-primitives 的 Modal/Button/HeaderAction 规范不一致"
fix: "src/client.js 全面重写样式表（官方 design-platform token + Modal/Button/HeaderAction 几何）与布局（两栏 modal、官网胶囊、绑定状态点）"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户要求插件 UI 与 DSH 其他胶囊统一、弹窗布局更合理。核对官方设计平台（packages/client/ui-theme/src/styles/design-platform.css、ui-primitives 的 Modal/Button/HeaderAction、session-log-export 的 HeaderAction.tsx）后发现旧实现用了错误的 token（--dsw-alias-bg-surface/fg-secondary 等未定义，官方注释明确点名 undefined）与几何（h26 r6 方按钮、r10 弹窗、0.45 黑遮罩）。重写：1) 胶囊按钮对齐官方 capsule（h32、r18、border-l2、label-primary、hover interactive-bg-hover、font-family）+ 绑定状态绿点（胶囊打开即轮询 state，与面板共享 5s 轮询）；2) 弹窗对齐官方 Modal（r24、bg-layer-2、border-inverted、shadow-lv3、遮罩 bg-mask-1+blur(2px)、标题 16px/500、28x28 r8 关闭钮）；3) 布局改两栏（左：服务器列表带连接点/已绑定徽标/行内重连删除，右：会话绑定+编辑表单），移动端 640px 下折叠单栏；4) 按钮类全面切换为官方 Button 三元组（primary-fill/ghost/outline+danger，tiny 变体 r11）。产品 client.js 21.0kb→26.8kb，闸门 8/8、回归 4/4 全绿；旧 token（fg-secondary/bg-surface）与旧类（dsss-min/dsss-sec/dsss-grid/dsss-row）在产品中零残留。零 workspace import 约束下无法直接 import ui-primitives，故以同 geometry/token 的 <style> 表复刻。
