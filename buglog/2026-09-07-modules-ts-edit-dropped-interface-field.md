---
date: "2026-09-07T04:00:51.892Z"
symptom: "modules.ts 中 ChatPunishment 接口丢失 ts 字段致类型破损（编译前发现）"
component: "edit-tool/banmu-admin-web-types"
severity: "minor"
status: "fixed"
root_cause: "edit 替换块未完整携带原接口全部字段，属编辑遗漏。"
fix: "同一轮内二次 edit 还原 ts: number 字段，读回验证完整。"
related_files:
  - "banmu-admin/web/src/api/modules.ts"
---

开发聊天昵称操作时，用 edit 在 ChatPunishment 接口后追加 ChatReportItem 并新增 chatApi 方法，new_string 漏写原接口的 `ts: number` 字段，导致 modules.ts 类型破损。同一轮内二次 edit 还原 ts 字段并完成追加，读回文件验证完整；随后 npm run build（vue-tsc）exit 0，无部署影响。教训：edit 改写含多字段的 interface 时替换文本必须逐字段核对，改后立即读回并依赖 vue-tsc 兜底。
