---
date: "2026-09-03T04:35:08.365Z"
symptom: "视频生成仍走 agnes-video-v2.0 旧协议, 需整体迁移到官方最新 agnes-video-2.5-flash"
component: "ai-video-script-app-server"
severity: "major"
status: "fixed"
root_cause: "Agnes 视频 API 从 v2.0 升级到 2.5-flash, 协议不兼容: body 参数集全变 (seconds 4-12 字符串 / aspect_ratio / mode 三态, 不要 num_frames/frame_rate), 媒体只收公网 URL 拒 base64/data-uri, 查询必须带 model_name, 时长上限 12 秒 (15 秒被网关拒绝)。"
fix: "重构 agnesVideoProvider.ts (2.5-flash body + model_name + 媒体 COS presigned), videoAgentService.ts (4 模式→2.5 三模式映射 + resolveVideoAspect 6 画幅 + 删 numFramesForDuration), billingService.ts ([4,8,12]), 三端前端同步 (时长档位/比例/默认值/文案), 8 处版本号 3.0.148→3.1.0 (versionCode 344)。v3.1.0 部署 commit a3e2b98。"
related_files:
  - "apps/server/src/services/agnesVideoProvider.ts"
  - "apps/server/src/services/videoAgentService.ts"
  - "apps/server/src/services/billingService.ts"
  - "apps/web/src/components/AgentChatPanel.tsx"
  - "apps/mobile/src/screens/VideoAgentScreen.tsx"
---

S91 v3.1.0: 用户要求接入官方最新 agnes-video-2.5 系列, 拍板用免费的 agnes-video-2.5-flash 并彻底重构视频生成功能。实测发现 3 个与 v2.0 协议的差异并逐一适配: ① body 参数完全不同 (v2.0 用 num_frames/frame_rate/width/height, 2.5 用 seconds 字符串 4-12/size=720P/aspect_ratio/mode text|keyframe|reference, 15 秒被网关拒绝); ② 媒体必须公网 http(s) URL — 纯 base64 和 data: 前缀均被拒 ("media must be a public http(s) URL or valid base64 data."), 而 COS 桶是私有的 (裸 URL 403), 因此本地参考图/视频抽帧全部走 COS 上传 + getPresignedUrl(key,7200); ③ 查询接口所有模式需带 model_name 参数 (keyframe/reference 必须)。限流仍 2/min 与 v2.0 一致 (复用 getAgnesVideoLimiter)。完成响应 URL 在顶层 url 字段, queryStatus 改动极小。验证: 三端 tsc 0 错; 完整 deploy.sh 12 维全绿; verify-deploy.sh --strict 26 PASS/0 FAIL; 生产 E2E 用生产 key 直连 apihub.agnes-ai.cn 创建 4s text 任务 queued→in_progress→completed ~40s, 完成 URL 顶层 url 字段 HEAD 200 + video/mp4。UI 4 模式保留 (text2vid/i2v/multi/keyframes), 服务端映射为 2.5 三模式 (text/keyframe/reference)。计费矩阵 [4,8,12] 秒: 普通 4s 免费/8s+12s ¥0.1; VIP 4s+8s 免费/12s ¥0.1。
