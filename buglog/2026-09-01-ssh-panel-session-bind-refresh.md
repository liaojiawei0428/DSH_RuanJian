---
date: "2026-09-01T10:00:38.735Z"
symptom: "打开 SSH 弹窗可能显示陈旧会话绑定，绑定的服务器被删除后展示 ghost 名称"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "弹窗打开时仅依赖 mount 首拉，未绑定 sessionId 变化重拉；selectedBySession 指向已删服务器 id 时直接原样展示"
fix: "src/client.js：SshEntry 打开前同步 probe；refresh/useEffect 依赖 sessionId；boundServer 归一化 + '需重绑' 悬空卡片"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户要求：打开 SSH 弹窗时刷新「当前会话已绑定」，确保绑定的是当前会话且展示正确。核对 Host 侧 key：deepseek_DSH core/agent 测试断言 agent.id === session.id，工具端 exec.agent.session.id 与浏览器 slot 的 props.sessionId 同源（dsh-session 会话 id），绑定 key 正确；且此前实测绑定腾讯云后 ssh_* 成功执行即为实证。增强：1) SshEntry 胶囊点击时先异步 probe 一次 state 再打开弹窗，杜绝打开瞬间显示陈旧绑定；2) ServerManager refresh 依赖加入 sessionId（会话切换强制重拉快照），useEffect 依赖 [refresh, sessionId] 且切换时先清 notice；3) 新增 boundServer 归一化：绑定的服务器已被删除时 selectedServerId='deleted'，绑定卡片显示「已绑定的服务器不存在 / 需重绑」悬空态，不再展示 ghost 名称。产品 client.js 28.3kb→29.4kb，闸门 8/8、回归 4/4 全绿；产品验证：打开 probe 2 处、refresh/sessionId 依赖、悬空态文案、boundServer 归一化齐备（'deleted' 以双引号形式两处存在）。
