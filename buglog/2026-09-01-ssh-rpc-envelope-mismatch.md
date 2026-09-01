---
date: "2026-09-01T06:30:08.738Z"
symptom: "面板所有 RPC 无反馈：测试连接停在「正在连接…」、保存后服务器列表永远空、state 恒 undefined"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "自造 dsss:1 双信封误判了平台协议：connection RPC 的 handler 返回值本身就是 {ok,value}|{ok,error} 信封，客户端 parseConnectionResponse 强校验该形状且要求 error.details 必须是对象；内层 dsss 信封被塞进 value 后，client.js 读 envelope.ok（恒 true）与 envelope.data（恒 undefined）"
fix: "重写 src/rpc.js 对齐平台信封（dispatch 直返数据、域错误走 ok:false 且 details 恒对象）；src/client.js call 解包 result.value，域错误抛带 .code/.stage/.fingerprint 的 Error；node build.mjs 重建"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\rpc.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

用户报告「无法添加服务器测试连接」。复核 packages/client/connection/src/client/rpc.ts 与 rpc-host.ts：客户端 parseConnectionResponse 只认 {ok:true,value}|{ok:false,error:{code,message,details}}，且 details 缺失会抛 TypeError；host 端 handler 返回值直接作为 result 回传（L240-241）。而本插件 handler 返回 {ok:true,value:{v:'dsss:1',ok,data}}，client.js 读 envelope.ok/envelope.data——value 里的内层信封永远解不开，所有端点成功失败在浏览器都表现为 undefined：state 面板永远空态、server.test 停在「正在连接…」、保存后列表不出现，与用户症状完全吻合。修复：rpc.js 删除 dsss 信封，dispatch 直接返回数据，handler 成功回 {ok:true,value}、域错误回 {ok:false,error:{code,message,details:{stage?,fingerprint?}}}（details 恒为对象规避 parser TypeError）；client.js call 改读 result.value、result.ok===false 时抛带 .code/.stage/.fingerprint 的 Error。产品 client.js 由 19.1kb 变 21.0kb，闸门 8/8、回归 4/4 全绿。esbuild 产品中文以大写 \uXXXX 转义，复验接线时需按此形态搜索。
