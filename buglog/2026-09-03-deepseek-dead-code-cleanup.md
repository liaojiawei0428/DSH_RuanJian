---
date: "2026-09-03T09:15:05.413Z"
symptom: "剧本生成链路无 DeepSeek 调用但 .env 残留 DEEPSEEK 配置 + errors.ts 残留 DEEPSEEK_API_ERROR 常量"
component: "ai-video-script-app-server"
severity: "minor"
status: "fixed"
root_cause: "v3.0.146 文本生成统一切 agnes-2.5-flash 时, .env 的 DEEPSEEK 配置项和 errors.ts 的错误码常量未被同步清理, 遗留死配置/死代码 (无任何代码读取)。"
fix: "远端 .env DEEPSEEK 三件套加 # DEEPSEEK_DEPRECATED_ 注释 (保留原文); errors.ts 删除 DEEPSEEK_API_ERROR 常量改说明注释。commit fcc52a2 + a1f1441, 完整 deploy.sh 部署 (版本 3.1.1 不变), 12 维全绿。"
related_files:
  - "apps/server/src/utils/errors.ts"
  - "apps/server/src/services/agnesPool.ts"
  - "apps/server/src/services/agnesTextProvider.ts"
---

用户询问剧本生成链路是否还有 DeepSeek 官方 API 调用。排查: ① sources grep 40 处 deepseek 命中, 全部为历史注释 ("跟 BUG-148 deepseek 1:1 镜像" 等回溯说明), 无 deepseek*.ts 文件、无 api.deepseek.com/deepseek-chat/deepseek-reasoner 端点、无 process.env.DEEPSEEK* 读取; ② 剧本链路 (novelService/scriptService/characterService/chunkService/promptTranslator) 16 处调用全走 agnesPool → agnesTextProvider (模型 agnes-2.5-flash, v3.0.146 已迁移); ③ 发现两处残留: 远端 .env 有 DEEPSEEK_API_KEYS/DEEPSEEK_API_URL/DEEPSEEK_MODEL 三件套 (无代码读取的死配置) + errors.ts ErrorCodes.DEEPSEEK_API_ERROR 常量 (无调用方)。用户选择"仅清理死配置/死代码": .env 三行加 # DEEPSEEK_DEPRECATED_ 注释 (保留原文供回滚, 更安全, 因为行为不可逆且 key 可能被脚本引用), errors.ts 删除常量改注释。部署: 版本保持 3.1.1 (死代码清理不 bump, 避免强制升级弹窗), 完整 deploy.sh 12 维全绿。验证: dist errors.js 仅注释残留, AGNES 三 key 完好, deploy.sh 6.5 步只改 APP_VERSION 不会覆盖 DEEPSEEK 注释。经验: .env 清理用注释而非删除保留回滚路径, 且 deploy.sh 版本同步段不触碰其他 env 行。
