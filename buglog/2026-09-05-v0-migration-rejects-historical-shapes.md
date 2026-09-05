---
date: "2026-09-05T03:49:22.281Z"
symptom: "升级 0.1.3-alpha.1 后点开历史会话无法加载历史数据；v0 会话日志 open(read) 时抛 SessionFormatUnsupportedError（\"assistant/chunk N chunk replayState has unexpected member \\\"kind\\\"\" 或 \"subagent/descriptor N uses unsupported descriptor version 2\"），49 个会话中 11 个被拒。"
component: "dsh-session-format-v0-to-v1"
severity: "critical"
status: "fixed"
root_cause: "官方 0.1.3-alpha.1 引入 released 会话格式迁移链 v0→v1→v2 时，v0→v1 迁移器的 payload 校验按\"当前认知形状\"冻结，漏掉了 released v0 早期真实写入的两种历史形状：(1) finish chunk 的 replayState 曾是扁平 pre-envelope 形状（顶层 kind:'pi-ai', version:1, api, provider, model, responseId, stopReason, blocks），官方运行时读取侧（llm-pi-ai readReplayState→degrade）已兼容该形状，官方 fixture（released-v0-real-shapes.jsonl）却未采样到它，迁移侧 replayEnvelopeValue 的 exactRecord(['response'],['blocks']) 对顶层 kind 抛 SessionFormatError；(2) subagent/descriptor 的 version 字段在加入可选成员 agentReasoningEffort 时从 2 升到 3，迁移源侧（validation.ts）对 version!==3 一刀切抛 SessionFormatUnsupportedError，而 v1 target 侧对非 3 版本是跳过深校验透传。任何含这两种形状的 v0 日志在打开时被拒绝整个加载。"
fix: "packages/session/session-format-v0-to-v1 三处修改：payload-validation.ts 的 replayEnvelopeValue 新增扁平 pre-envelope 形状准入（flatPreEnvelopeReplayValue，成员集合 kind/version/api/provider/model/stopReason 必需 + responseModel/responseId/blocks 可选，未知 kind 拒绝）；subagentDescriptorValue 的 version 字面量从 [3] 放宽为 [2,3]；validation.ts 中 descriptor 的 version!==3 入口条件改为 version!==2&&version!==3。lossless 透传，不转换不重写。重新 pnpm run build 后 49/49 会话全部 open+read 成功。"
related_files:
  - "packages/session/session-format-v0-to-v1/src/payload-validation.ts"
  - "packages/session/session-format-v0-to-v1/src/validation.ts"
  - "packages/session/session-format-v0-to-v1/tests/validation.spec.ts"
  - ".agents/notes/implemented/bug-fix/2026-09-05-flat-v0-replay-state-migration-compat.md"
dsh_commit: "d347e703908d"
---

调查：用户报告 09-05 更新 0.1.3-alpha.1 后所有会话历史无法加载。体检/服务/投影缓存均正常；用服务端同款 JsonlSessionPersistence 对磁盘会话逐一 open+read 复现。磁盘统计：46 个 v0 会话（另有若干已迁移 v2）。逐帧解码（注意 Node zlib zstd 流式解码在多帧拼接日志上只解第一帧，必须按 0x28 B5 2F FD 帧魔数逐帧解码）后确认两类被拒形状：(1) finish chunk 的 replayState 扁平 pre-envelope 形状（顶层 kind:'pi-ai'/version:1/api/provider/model/responseId/stopReason/blocks，4 个会话，其中一个会话新旧形状并存）；(2) subagent/descriptor version 2（agentReasoningEffort 加入前的版本，7 个 LuYin_RuanJian 子代理会话）。两处均在 v0→v1 迁移器 SessionFormatUnsupportedError 拒绝整份日志。修复：payload-validation.ts 的 replayEnvelopeValue 识别顶层 kind 路由到 flatPreEnvelopeReplayValue（固定 released 成员集合并校验基本类型）；subagentDescriptorValue 接受 version [2,3]；validation.ts 的 descriptor 入口条件放宽为非 2/3 才走"v0 拒/v1 跳过"分支。均 lossless 透传，v1→v2 装配 deepEqual 与运行时降级路径（llm-pi-ai readReplayState/degrade）保持自洽。验证：v0→v1 包 102+ 用例、v1→v2 与持久化包 419 用例全过；修复后全量 49/49 会话 open+read 成功（此前 42/49）。附带产出：双语 Agent Note 2026-09-05-flat-v0-replay-state-migration-compat；服务需重启加载新构建。
