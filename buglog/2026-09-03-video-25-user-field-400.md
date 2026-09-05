---
date: "2026-09-03T05:06:16.380Z"
symptom: "v3.1.0 部署后视频生成全部失败: \"生成失败 [invalid_input] 视频请求参数无效\""
component: "ai-video-script-app-server"
severity: "critical"
status: "fixed"
root_cause: "agnesVideoProvider.createTask 透传 body.user (来自 v3.0.78 BUG-149 OpenAI 兼容 user 字段), Agnes Video 2.5-flash 网关对不允许的请求字段直接返回 400 invalid_request, 而 v2.0 网关静默忽略该字段; v3.1.0 协议重构时沿用了旧透传, E2E 裸 curl 未带 user 所以漏测。"
fix: "agnesVideoProvider.ts 删除 body.user 透传段 (opts.userId 保留仅注释/审计用), videoAgentService 注释同步。v3.1.1 (versionCode 345) 8 处版本号同步 + changelog patch entry + APK 重打 + 完整 deploy.sh 部署。commit 2a01f98。"
related_files:
  - "apps/server/src/services/agnesVideoProvider.ts"
  - "apps/server/src/services/videoAgentService.ts"
---

S92 生产故障: v3.1.0 迁移 2.5-flash 部署后, 用户点击生成视频全部失败, 提示 "生成失败 [invalid_input] 视频请求参数无效, 请重试或联系客服"。排查: ① 生产日志 combined4.log 铁证 — 2026-09-03T04:47:36 createTask 请求 mode=text/seconds=12/aspectRatio=16:9, 网关返 400 {"code":"invalid_request","message":"user is not an allowed request field","data":{"param":"user"}}; ② 服务器直连实测: 带 user 字段 → 400 拒收, 去掉 user 带 seed → queued 成功; ③ 根因: agnesVideoProvider.ts 第 310-313 行 v3.0.78 (BUG-149) 引入的 OpenAI 兼容 user 字段透传 (body.user = opts.userId), v2.0 网关静默忽略但 2.5-flash 网关严格校验不允许字段直接 400。v3.1.0 重构时该字段被原样保留, 而 E2E 实测用的是裸 curl (没带 user) 所以漏测。修复 v3.1.1: 删除 body.user 透传 (seed 保留, 实测 seed 被接受); service 层 videoAgentService 的 convUserId 透传一并清理注释。部署后验证: 生产 E2E text 模式带 seed 无 user → queued→completed→出片 url HEAD 200 video/mp4 ✅; reference 模式 COS presigned URL (1.2MB 真图) → 200 queued ✅ (1x1 占位图 70 字节会被网关拒 "media URL could not be downloaded", 属预期); keyframe first_frame 参数名被网关接受 (报下载失败而非 not allowed field, 证明参数名正确)。12 维全绿 + verify 26 PASS。真正用户触发路径 (videoAgentService createTaskWithLimit 带 userId) 已完全移除 user 写入。
