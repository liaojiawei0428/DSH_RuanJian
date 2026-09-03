---
date: "2026-09-02T16:16:11.315Z"
symptom: "小说分析角色细节提取阶段无流式滚动输出：前端只见进度百分比，最后一次性蹦出完整角色 Markdown（web/mobile 均如此），主分析阶段却正常逐字滚动"
component: "shipin-APP apps/server characterService"
severity: "major"
status: "fixed"
root_cause: "v4.1.0 之前 LLM 输出 JSON 格式时，characterService 为防原始 JSON 污染前端，故意在流式期间只推送百分比进度不推文本 chunk；v4.1.0 改为 Markdown 自由文本后该\"吞文本\"行为未随格式演进移除，导致前端角色提取阶段看不到逐字滚动（主分析阶段 novelService.streamAnalysis 一直逐字推送作对照）。"
fix: "characterService.ts extractDescriptions 流式回调（205 行 chatCompletionStream 的 onChunk）中，fullContent += chunk 后立即广播 broadcastLlmUpdate({phase:'character_extracting', step:'output', content: chunk, tokens: fullContent.length, stream:true})，保留原进度推送；同步修 mobile TaskProgressScreen.tsx 两处（phaseLabel 补 character_extracting 分支 = web 326 行 1:1；ANALYSIS_STEPS 补第 6 步）。"
related_files:
---

调查链路：用户报"小说分析过程中角色提取阶段没有正确进行流式滚动输出"。对比 novelService.streamAnalysis（主分析阶段每个 chunk 都 broadcastLlmUpdate(phase:'analyzing',stream:true) 逐字推送）与 characterService.extractDescriptions：LLM 流式调用（agnesPool.chatCompletionStream, 205 行）的回调里注释"v3.0.XXX: 流式调用 LLM，期间只推送进度（不推送原始 JSON token）"，即 chunk 只累加 fullContent + 每 2 秒推一条 chunkProgress，流式全部结束后才对每个角色一次性 broadcastLlmUpdate(phase:'character_extracting', step:'output', content=整块Markdown, stream:true)——前端看到的是进度条 + 最后整块蹦出，无逐字滚动。根因是该策略是 v4.1.0 之前 LLM 输出 JSON 格式时防 reasoning/JSON 污染前端而设，v4.1.0 已改 Markdown 12 分区自由文本（parseMarkdownCharacters），流式文本完全可以直接推前端但旧行为保留。前端验证：web TaskProgressPage 对 data.stream 有 50ms flush + appendCharacterText + 自动滚动 + LIVE 徽标（244-263/457-464/678-694 行），mobile TaskProgressScreen 100ms flush + setStreamText（122-131/173-179 行）——前端渲染能力齐备，纯服务端断流。修复：characterService.ts 流式回调里同步加 broadcastLlmUpdate({phase:'character_extracting', step:'output', content: chunk, tokens: fullContent.length, stream:true})；另修 mobile TaskProgressScreen chunk_progress label 缺 character_extracting 分支 + ANALYSIS_STEPS 缺第 6 步。验证：tsc 0 错、dist 编译产物确认含新推送、verify-deploy.sh PASS 26/FAIL 0、公网 /api/version 1:1。附发现 mobile tsc 17 个 pre-existing 错（全在未改动文件，0 新错）。
