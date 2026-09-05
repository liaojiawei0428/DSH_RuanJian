---
date: "2026-09-05T04:31:43.990Z"
symptom: "dsh 服务重启后，SSH 服务器面板与 GitHub 推送面板打开正常但内容全空（服务器列表/绑定/Token 显示\"丢失\"）；重建插件 client bundle 触发 HMR 重载后数据恢复"
component: "dsh-server-ssh + dsh-github-push（client RPC 通道）"
severity: "major"
status: "workaround"
root_cause: "dsh 服务重启后浏览器页面未完整刷新：会话头按钮与面板骨架正常（boot 时注册的 Slot 还在），但面板的 client→host 私有 RPC（connection.rpc.call 私有 channel）在重启后的旧页面连接上失效，state 快照拉不到 → 面板显示空列表，用户感知为\"配置和 Token 全部丢失\"。磁盘数据自始至终完好（独立进程以部署等价代码 load 出全部 1 服务器 + 3 绑定 + 3 PAT）。轮询未自愈且\"读取失败\"横幅未显现的机制待下次复现时用 F12 Network 取证。"
fix: "重建 dsh-server-ssh 与 dsh-github-push 的 client bundle（node build.mjs，字节变化）触发 HMR 自动重载浏览器插件 → 重新 apply/重新 mount → 面板 state 重新拉取 → 服务器与 GitHub 数据恢复显示（用户确认）。validate-plugins 9/9 PASS，服务无需重启，数据未损坏。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\client.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\store.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\store.js"
dsh_commit: "d347e703908d"
---

调查全景：用户报告 SSH 服务器配置与 GitHub Token"全部丢失"。服务端 12 层验证全部健康——磁盘数据完好（server-ssh/state.json 662B 1 服务器 + github-push/state.json 3 绑定 + credentials.json 3 PAT，mtime 09-02，无 BOM 无 quarantine）；服务进程环境块直接读取验证（pid 40680：DSH_HOME 未设、USERPROFILE=Administrator → storePaths 兜底 ~/.dsh 正确）；profile link 10 条全部正确；boot manifest 51 行含全部自研插件；bundle 导出协议正确（closure-factory + inject:['slots']）；normalizeState 过滤条件与现有数据兼容；独立 node 进程以部署等价方式跑两个 store 的 load() 全部读出数据；balance host 路由活着（502 是 DeepSeek API 域错误）；gateway/connection 的 RPC 协议在 0.1.2-rc.1→0.1.3-alpha.1 之间未变。面板能打开、按钮正常（boot 激活断言保证 client 全 ACTIVE）。唯一断点：页面侧面板的 state RPC 拉取失效（服务器列表/绑定/Token 显示空）。恢复：重建两插件 client bundle 触发 HMR 重载 → 插件重新 apply → 面板重新拉 state → 数据恢复（用户确认）。疑点待查：页面在 11:49 服务重启后未完整刷新，主通道（对话）正常而插件私有 RPC 通道失效，且面板 5 秒轮询未自愈也未显示"读取失败"横幅——需要在下次重启窗口用浏览器 F12 Network 抓 /dsh-server-ssh state 请求定位（response 是 ok:true 空 value 还是调用失败）。注意：selectedBySession 按会话记录是设计行为，新会话需重新选服务器，勿与数据丢失混淆。
