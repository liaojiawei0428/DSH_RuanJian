---
date: "2026-09-03T04:17:34.620Z"
symptom: "带 x-panel-token 调用玩家面板接口仍返回 401 Unauthorized"
component: "banmu-admin-server players-module"
severity: "major"
status: "fixed"
root_cause: "app.module 全局 AuthGuard(jwt) 先于路由级 PanelAccessGuard 执行，无 Bearer 一律 401，token 通道被前置拦截"
fix: "players.controller.ts 的 @Get(':openid/panel') 增加 @Public() 装饰器，跳过全局 AuthGuard"
related_files:
  - "banmu-admin/server/src/modules/players/players.controller.ts"
  - "banmu-admin/server/src/common/auth.guard.ts"
---

新增显性玩家面板接口 GET /api/admin/players/:openid/panel 时，用了 @UseGuards(PanelAccessGuard)（双通道：x-panel-token 或 JWT），但实测带 x-panel-token 请求仍 401 且消息为默认 'Unauthorized'（非守卫自定义中文），JWT 通道却正常。排查发现 app.module 全局注册了 AuthGuard(jwt)（APP_GUARD），在路由级守卫之前执行，无有效 Bearer 一律拦截 401，PanelAccessGuard 的 token 通道根本轮不到。修复：panel 路由加 @Public()（IS_PUBLIC_KEY），全局 JWT 守卫跳过后再由 PanelAccessGuard 独立做双通道校验。验证：A=无凭证 401、B=带 x-panel-token 200、C=带 Bearer JWT 200，游戏服代理接口转发正常。
