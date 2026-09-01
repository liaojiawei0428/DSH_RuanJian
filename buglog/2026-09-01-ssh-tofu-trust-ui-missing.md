---
date: "2026-09-01T06:30:24.262Z"
symptom: "新主机首次「测试连接」报主机密钥未信任后无路可走，无法完成添加"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "transport.test 拒绝路径虽携带指纹（SshError.fingerprint），但 UI 无信任确认交互，allowFingerprint 重试入口只存在于协议层不存在于面板"
fix: "src/client.js：ServerForm 增加 trust state 与指纹确认块，runTest 支持 allowFingerprint 重试参数；ServerManager 的 onTest 改为直接传 call"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\transport.js"
---

即使 RPC 信封修好，新主机首测也会因 TOFU 三层（配置指纹 > known_hosts > 拒绝）被 hostVerifier 拒绝：transport.js connectOnce 抛 HOST_KEY_UNTRUSTED，test() 把指纹挂到 SshError.fingerprint（L397），但面板没有展示指纹并确认的流程——错误只显示一句文案，用户永远无法完成首次信任。同根因下 details.fingerprint 已随信封修复贯通到浏览器。修复：ServerForm 新增 trust state，捕获 HOST_KEY_UNTRUSTED/HOST_KEY_CHANGED 且带指纹的错误时展示指纹（user-select:all）与「核对无误，信任并重试 / 不信任」按钮，重试在 server.test args 顶层带 allowFingerprint；HOST_KEY_CHANGED 显示中间人警告文案。onTest 由 act('server.test') 改为直通 call，使带 code/fingerprint 的错误对象能到达表单。
