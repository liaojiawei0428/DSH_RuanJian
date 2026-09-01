---
date: "2026-08-28T01:50:17.653Z"
symptom: "后台登录后左侧菜单看不到「场景管理」「结局设定」板块，但直接访问 /scenes URL 可正常打开"
component: "banmu-admin/web layout"
severity: "minor"
status: "fixed"
root_cause: "侧边栏菜单是 layout/index.vue 独立维护的手写 allMenus 数组，与 vue-router 路由表是两套清单，新增页面时只注册了路由未同步菜单数组"
fix: "allMenus 在「剧情任务」后插入 {path:'/scenes',title:'场景管理'} 与 {path:'/endings',title:'结局设定'}；构建部署 dist 至 /www/wwwroot/banmu-admin/web/dist/"
related_files:
  - "banmu-admin/web/src/layout/index.vue"
---

回填 2026-08-25 会话修复（项目 BUGS.md BUG-105 已有完整记录，DSH 知识库缺条目）：16规划落地场景管理与结局设定时只注册了路由/视图/后端模块，layout/index.vue 的手写 allMenus 数组漏加条目。修复：allMenus 插入 /scenes 与 /endings 菜单（super_admin/admin/operator），vue-tsc+vite build 通过并部署生产 dist。教训：新增后台页面必须同步路由+视图+allMenus 三处。
