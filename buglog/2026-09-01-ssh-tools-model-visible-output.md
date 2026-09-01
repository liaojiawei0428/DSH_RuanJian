---
date: "2026-09-01T07:13:48.082Z"
symptom: "模型收到 ssh_* 工具结果仅一行摘要（bash exit 0），无法读取远端输出自动汇报"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "工具模型可见文本完全由 output.render 决定，而 7 个 render 都只输出单行摘要；stdout 等完整数据仅存在于 UI 卡片（value），从未进入模型上下文"
fix: "src/tools.js 重写 5 个 data 型工具 render：capText 截断 + 实际内容嵌入模型可见文本（MODEL_TEXT_CAP=4000、MODEL_ENTRY_CAP=30）"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\tools.js"
---

用户反馈：模型收到 ssh_* 工具结果只有一行摘要（如 `[腾讯云服务器] bash exit 0`），无法读取远端输出进行自动汇报，完整输出只在 GUI 卡片对用户可见。核对 Deepseek_DSH packages/core/tools/src/index.ts L1783-1795 与 L283-285：工具成功的模型可见 content 完全由 tool.output.render(args, value) 的 ContentBlock 决定，value（含 stdout）只进 UI 卡片。改法：src/tools.js 新增 MODEL_TEXT_CAP=4000 与 MODEL_ENTRY_CAP=30 及 capText helper；ssh_read/ssh_list/ssh_glob/ssh_grep/ssh_bash 五个 data 型工具的 render 重写为携带截断后的实际内容（bash 含 stdout+stderr 分段、list/glob 逐条列名与大小、read/grep 嵌入内容文本），截断处带「truncated by model cap; full output on the tool card」标记；ssh_write/ssh_edit 结果无内容语义保持单行。value 侧数据不变（UI 卡片仍完整）。产品 index.js 775.6kb，闸门 8/8 全绿，MODEL_TEXT_CAP 常量/截断提示/stderr 段/条目提示在产品中均验证存在。esbuild 中文仍以大写 \uXXXX 转义。需服务重启后由模型实测读取远端输出。
