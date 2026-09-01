---
date: "2026-09-01T06:10:51.353Z"
symptom: "SSH 管理面板一打开即崩溃（notice/editing 初值 undefined 误过 !== null 判断，访问 notice.kind / editing.form 抛 TypeError）；此前仅 bundle 加载成功，面板从未渲染成功。"
component: "dsh-server-ssh/client"
severity: "major"
status: "fixed"
root_cause: "useState(undefined) 初值与 `!== null` 判断不匹配：undefined !== null 恒为 true，首帧渲染进入依赖状态非空的分支，访问 undefined 的属性抛 TypeError——面板挂载即崩（React 无错误边界时整块卸载）。"
fix: "src/client.js 两处条件改为宽松不等 `notice != null` / `editing != null`（同时排除 undefined 与 null）；移除 useRef 死解构；fingerprint 回退 ?? 改 ||。node build.mjs 重建后产品含 require(\"react\")/require(\"react-dom\") 各 1 处、两处 != null 接线、无旧判断残留；node validate-plugins.mjs 8/8 全绿。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\client.js"
---

用户报告 React 全局问题并修复后，要求重新仔细检查插件。全文审计 src/client.js 发现两处渲染期 TypeError：ServerManager 的 notice 与 editing 状态初值均为 useState(undefined)，但条件渲染写的是 `notice !== null`（L225）与 `editing !== null`（L288）——首帧 undefined !== null 求值为 true，立即访问 notice.kind / editing.form（ServerForm 内 useState(editing.form)）抛 TypeError，SSH 面板一打开就崩溃。此前的"启动成功"只是 bundle 加载成功（顶部不再报 Failed to load plugins），面板从未渲染成功过。同批顺带清理：useRef 死变量（解构未用）；runTest 成功文案的 fingerprint 空字符串回退 ?? 改 ||（fingerprint 为 string，空串应显示"未捕获"）。已对照 rpc.js server.test 返回形状 {server, fingerprint, home, uname, shell} 确认 runTest 读取匹配；对照 balance 确认 package.json dsh.client.inject:[] 为图元数据（与模块 export const inject=['slots'] 两回事），无需改动。教训：useState 无显式初值时是 undefined 不是 null，条件渲染用 != null（宽松）或显式 undefined 初值 + !== undefined，两种风格选一并全文件统一。
