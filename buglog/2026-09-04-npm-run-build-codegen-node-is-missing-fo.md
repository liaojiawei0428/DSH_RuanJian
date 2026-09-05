---
date: "2026-09-04T05:30:40.199Z"
symptom: "npm run build 报 Codegen node is missing for element/if/for node（vite:vue）"
component: "banmu-admin-web"
severity: "major"
status: "fixed"
root_cause: "具名插槽 `<template #xxx>` 被放在普通 div（非组件）内，vue 编译器无法为其生成 codegenNode"
fix: "views/logic/index.vue 中所有 `<div class=\"ui-group-card\">` 改为 `<UiGroupCard>` 组件，`<template #default>` 包裹删除（默认插槽直接放内容）"
related_files:
  - "banmu-admin/web/src/views/logic/index.vue"
  - "banmu-admin/web/src/components/ui/UiGroupCard.vue"
---

文字版游戏页首次构建时 vite 报 "Cannot read properties of undefined (reading 'type')"（compiler-core genNode），vue-tsc 却通过。用 @vue/compiler-sfc parse + compile-dom 二分定位：骨架编译 OK，加入任一含 <template #actions>/<template #default> 的 div 即崩。根因：把具名插槽模板写在普通 <div class="ui-group-card"> 内——插槽模板只能作为组件的子节点；项目卡片统一用 components/ui/UiGroupCard.vue（仅 #actions 具名插槽 + 默认插槽，无 #default 具名）。修复：全部改为 <UiGroupCard>，默认内容去掉 #default 包裹。验证：npm run build 通过，dist 部署后 :80 200。
