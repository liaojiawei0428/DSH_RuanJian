---
date: "2026-09-02T15:29:57.730Z"
symptom: "About 页文案 \"2.5-flash 文本 · 图像 · 视频\" 暗示图像/视频也是 2.5-flash"
component: "apps/web/src/pages/AboutPage.tsx"
severity: "minor"
status: "fixed"
root_cause: "迁移初版文案把 2.5-flash 写在了图像/视频前，易被误读为图像/视频模型也是 2.5-flash。"
fix: "文案改为 \"Agnes AI（文本 2.5-flash · 图像/视频）\"，明确 2.5-flash 仅限定文本模型；已在 web/mobile 三处同步，随 v3.0.146 部署公网。"
related_files:
  - "apps/web/src/pages/AboutPage.tsx"
  - "apps/mobile/src/screens/AboutScreen.tsx"
  - "apps/mobile/src/screens/PrivacyPolicyScreen.tsx"
---

backfill 上一会话 (2026-09-02T12:45Z 前) 遗留的 fix-shaped activity：v3.0.146 Agnes 迁移时先在 AboutPage.tsx 写入 "2.5-flash 文本 · 图像 · 视频"，该文案会误导读者图像/视频模型也是 agnes-2.5-flash。实际本项目图像走 agnes-image-2.1-flash、视频走 agnes-video 系列，仅文本统一为 agnes-2.5-flash。自检发现后立即修正为 "Agnes AI（文本 2.5-flash · 图像/视频）"，并在移动端 AboutScreen/PrivacyPolicyScreen 同步移除 DeepSeek 提及。此为文本错误非代码逻辑 bug，随 v3.0.146 一并部署。
