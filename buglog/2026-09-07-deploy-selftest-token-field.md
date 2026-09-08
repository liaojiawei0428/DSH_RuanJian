---
date: "2026-09-07T02:27:10.863Z"
symptom: "部署自测脚本误判登录失败并因解包异常中断重启步骤"
component: "banmu-admin-deploy"
severity: "minor"
status: "fixed"
root_cause: "登录接口 token 字段为 access_token（非前端 accessToken 命名）+ 脚本 run() helper 未声明返回值"
fix: "deploy_chat_send.py 修正 token 字段为 access_token、run() 返回 stdout；前端 catch/失败分支读取 msg 字段。"
related_files:
  - "banmu-admin/deploy/deploy_chat_send.py"
  - "banmu-admin/web/src/views/logic/index.vue"
---

deploy_chat_send.py 自测阶段两个缺陷：①登录接口返回体 token 字段是 access_token（NestJS dto 约定），脚本按前端习惯 accessToken 提取取空，误报「密码可能已被修改」导致跳过自测；②run() 封装只打印未 return，`_,o,_=run(...)` 解包 TypeError 中断脚本，重启步骤未执行。修正：token 提取改 json['data']['access_token']；run() 返回 stdout。修正后自测全绿：login→/api/admin/chat/send world 成功 id=27→10s 内二次发送被游戏服限速拦截（code=400 msg=发送太频繁_请稍后再试）→messages 回查含新消息且 nickname=后台联调落库。公网 https://yx.maque.uno/api/admin/chat/send 全链路（nginx→3002→3000）id=28 成功、system 频道正确拒绝。另记录：admin 全局 ResponseInterceptor 对 service 返回 {ok:false,messageZh} 转 {code:400,msg,data:null} 且 HTTP 仍 200，前端 axios 不抛错，失败分支必须读 res.msg——已在前端 sendChat 中兼容。
