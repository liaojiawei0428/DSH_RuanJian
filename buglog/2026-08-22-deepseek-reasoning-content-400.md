---
date: "2026-08-22T09:53:55.083Z"
symptom: "DeepSeek 思维链模型多轮对话报 400 \"The reasoning_content in the thinking mode must be passed back to the API\""
component: "r1_client.py + speech_cli.py"
severity: "major"
status: "fixed"
root_cause: "DeepSeek 思维链模型要求多轮对话中 assistant 消息必须原样回传 reasoning_content 字段；项目在流式累积、工具循环回填、会话历史持久化/重建 4 处丢弃了该字段，导致下一轮请求 400。"
fix: "r1_client.py：新增 self._last_reasoning 累积（__init__ + _stream_once 重置/追加），工具循环与收尾轮 assistant 消息带 reasoning_content；会话历史重建透传该字段。speech_cli.py：_session_append 增参 reasoning_text 并持久化，_load_session_state 加载保留。"
related_files:
---

用户运行项目时收到 DeepSeek API 400 错误："The reasoning_content in the thinking mode must be passed back to the API"。调查发现：DeepSeek 思维链模型（deepseek-reasoner 等）要求多轮对话中 assistant 消息必须携带 reasoning_content 字段原样回传，否则拒绝。项目代码有 4 处丢失该字段：①r1_client.py 会话历史重建只取 role/content；②工具循环 assistant 消息回填无 reasoning_content；③收尾轮回填同样缺失；④_stream_once 只把 reasoning yield 给 UI 展示、未累积保存；⑤speech_cli._session_append 持久化会话历史时不存 reasoning_content，导致重启后历史消息里根本没有该字段。修复：r1_client.py 新增 self._last_reasoning 属性（__init__ 初始化 + _stream_once 每轮重置、流式追加 delta.reasoning_content），工具循环与收尾轮 assistant 消息带 "reasoning_content"；会话历史重建透传；speech_cli._session_append 增加 reasoning_text 参数并持久化到 session_state.json，_load_session_state 加载时保留。验证：编写 verify_reasoning_fix.py 5 项 mock 测试全部通过（流式累积/工具消息回填/历史透传/session 持久化/加载保留），py_compile 通过。遗留注意：旧的 session_state.json 历史轮次无 reasoning_content 字段，需几轮新对话后自然补全。
