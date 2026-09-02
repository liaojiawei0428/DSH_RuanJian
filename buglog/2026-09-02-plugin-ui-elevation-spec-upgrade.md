---
date: "2026-09-02T01:18:26.559Z"
symptom: "两插件弹窗/输入框/圆点与官方 alpha.4 新 elevation 风格不一致"
component: "dsh-plugin-ui"
severity: "minor"
status: "fixed"
root_cause: "官方 alpha.4 引入 elevation/superellipse 新样式规范，自研插件仍用旧 1px border + lv3 阴影组合，视觉偏离官方新风格"
fix: "dsh-server-ssh/client.js、dsh-github-push/client.js：modal 改 elevation-prominent、中性边框 0.5px、dot 加 corner-shape:round、input focus 改 brand 色"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\client.js"
---

官方 DSH 升级到 0.1.2-alpha.4 后引入新的 elevation 风格规范（commit 7020c7e122/3ce5604a71）：浮层/弹窗改用 border:0 + box-shadow:var(--dsw-elevation-prominent)（0.5px 发丝描边在阴影内 + 双层柔光，取代旧 1px border + --dsw-shadow-lv3）；中性 solid border 全部 0.5px；正圆 dot 需配对 corner-shape:round（corner-shape.css 全局注入 superellipse(1.5)，50% 圆不配对会被压扁）；input 边框 0.5px border-l4 + focus 只改 border-color 为 brand（取消 2px ring）。自研插件 dsh-server-ssh 与 dsh-github-push 原用旧组合，视觉与官方新浮层偏差。修复：两插件 client.js 同步升级——modal border:0+elevation-prominent（保留 lv3 作为旧版本 fallback）、capsule/item dot 加 corner-shape:round、bound/卡片/边框 1px→0.5px、badge/bound 按钮 0.5px、input/select 0.5px border-l4+focus brand 色、outline 按钮 0.5px border-l3；capsule 1px 与 item transparent 占位边框按官方保留。验证：两产品 bundle 14 项检查全 PASS（elevation-prominent 注入、dot round、input/outline 0.5px、无 lv3 直用、无旧 focus ring）；闸门 9/9、回归 4/4 全绿。
