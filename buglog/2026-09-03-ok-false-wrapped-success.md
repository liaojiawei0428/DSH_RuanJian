---
date: "2026-09-03T07:47:53.211Z"
symptom: "后台玩家物品超扣/业务失败接口返回 code:0 成功，错误被静默吞掉"
component: "banmu-admin-server common"
severity: "major"
status: "fixed"
root_cause: "全局响应拦截器对 service 返回的 {ok:false} 业务失败对象无条件包装为 code:0 成功响应"
fix: "response.interceptor.ts map 内检测业务对象 ok===false 时返回非 0 code 与 msg，其余保持 code:0"
related_files:
  - "banmu-admin/server/src/common/response.interceptor.ts"
---

验收玩家物品超扣时发现：POST /players/:openid/items amount=-999999 应拒绝（insufficient_item）却返回 code:0。根因：全局 ResponseInterceptor（response.interceptor.ts）对控制器返回值无条件包装 {code:0,msg:'ok'}，而 players/guilds 等模块 service 的业务失败以 {ok:false, code, messageZh} 纯对象返回（不抛 HttpException），被拦截器一律包成成功。此缺陷影响所有返回 {ok:false} 的编辑接口（guilds 编辑失败同样会被前端静默误判）。修复：拦截器 map 阶段识别 data.ok === false，转 {code: 400 或业务 code(>=400), msg: messageZh/msg, data: null}；未限类型（不改签名）。验证：超扣请求现返回 code=400 + 中文消息；正常响应仍 code:0。
