# dsh-plugin-guide

在官方「设置 → 插件」分区里提供一页**中文插件说明**：字典内每个插件显示模块短名、中文名与一句话功能。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## 模型 / 用户效果

- 用户在「设置 → 插件 → 中文说明」看到可搜索的说明列表（模块短名 / 中文名 / 功能说明三列），输入关键字即过滤。
- 页面注册为官方 `settings.plugins.tab` 的一个标签页（id `plugin-guide-zh`，order 20），导航入口、标签栏、主题与布局全部由官方插件分区拥有。
- 字典未收录的插件不出现在列表中，不影响官方页面。

## 实现机制

- 浏览器半注册 `settings.plugins.tab`（官方「插件」分区声明的一页），组件用 `React.createElement` 渲染搜索框 + 列表；**不观察 DOM、不访问 `document.body`、不依赖任何官方 DOM 选择器**（此前版本用 MutationObserver 向官方卡片内注入两行，已废弃——那违反客户端规范且随官方改版即失效）。
- 样式经一次性 `<style>` 注入，`ctx.effect` 挂在插件 Fiber 上，停用即移除。
- 消费 `slots` 服务（`exports.inject = ['slots']`），apply 在 slots 就绪后执行。

## 字典维护

- 中文说明来自 `client.js` 内置字典 `GUIDE`，键为**模块短名**（去掉 `@deepseek-ai/`、`cordis:`、`cordis-plugin-`、`dsh-(host-|client-)?` 前缀后的名字，与官方清单页归一规则一致）。
- **新增/改名插件后**：在 `GUIDE` 补一行即可；不改也不报错，该插件只是不出现在说明页里。
- 字典初版覆盖 0.1.2-alpha.2 部署的全部挂载模块。

## 开发循环

1. 编辑 `client.js`（全部行为在此；`index.js` 为 Node 半占位）；遵守准则 P1–P10
2. 随时验证：`node E:\DSH\DSH-ops\validate-plugins.mjs` —— 必须全绿才能进入安装

## 安装

经 `dsh-personal-hub` 统一安装：`personal-hub/personal.json` 清单已含本插件，`personal_hub_reapply` 一键完成 dependencies + bundles + pnpm install，重启服务生效。

## 已知边界

- 页面文案为硬编码简体中文（本插件目的即汉化说明），不接 locale 字典。
- 说明文字是人工维护的静态字典，不联网翻译，也不从官方页面抓取。
- 页面只覆盖字典条目，不是官方清单的镜像；完整插件列表仍看官方「全部」标签页。
