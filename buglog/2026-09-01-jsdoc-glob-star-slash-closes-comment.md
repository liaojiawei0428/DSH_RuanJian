---
date: "2026-09-01T05:39:47.943Z"
symptom: "sftp-io.js 被 node --check 拒绝：JSDoc 内 glob 示例触发块注释提前闭合，SyntaxError"
component: "dsh-server-ssh"
severity: "minor"
status: "fixed"
root_cause: "JSDoc 行内 glob 示例 `src/**/*.js` 的字符序列 `**/` 含 `*/`，使块注释在该处提前闭合，剩余文本按裸代码解析。"
fix: "JSDoc 示例改写为不含 `*/` 序列的文字描述（\"a recursive `src` glob\"）。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\sftp-io.js"
---

node --check 冒烟八模块时发现。V8 在块注释内遇到 `*/` 即终止注释，`src/**/` 处的 `*`+`/` 相邻构成该序列。教训：JSDoc 内写递归 glob 示例时 `x/**/*.y` 必含 `*/`；注释内一律文字描述或改写示例。修复后 node --check 八模块全绿。
