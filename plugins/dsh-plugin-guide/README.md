# dsh-plugin-guide

在官方「插件清单页」的每个插件卡片展开区里，注入**中文名**与**一句话功能说明**两行。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## 模型 / 用户效果

- 用户在「设置 → 插件 → 全部」展开任一插件卡片，详情里多出「中文名」「功能说明」两行，与官方详情行同构（`div > dt + dd`），自动继承页面布局与主题。
- 字典未收录的插件不加行、不影响官方渲染；官方插件更新后无需改动即可继续工作。

## 实现机制（重要边界）

- 官方清单卡片详情区**没有 slot 注入点**，故 client.js 用 `MutationObserver` 监听页面 DOM，在卡片详情块（`li[data-plugin-module] … div[id^="plugin-details-"] dl`）出现时追加两行；React 每次展开都会重建详情节点，观察器随之补挂。
- 回调经微任务合并扫描，行带 `dataset.dspgGuide` 标记防重复；观察器经 `ctx.effect` 挂在插件 Fiber 上，停用即断开。
- **依赖官方 DOM 结构**（`data-plugin-module`、`plugin-details-*` id、`dl.details` 行结构）。官方升级若改动该结构，插件不会报错，只是不再注入——届时按新结构修 `enhanceCard` 的选择器即可。
- 不消费任何 Cordis 服务（`inject: []`），apply 立即执行。

## 字典维护

- 中文说明来自 `client.js` 内置字典 `GUIDE`（按模块短名归一索引，归一规则与官方清单页一致）。
- **新增/改名插件后**：在 `GUIDE` 补一行即可；不改也不报错，该卡片只是不显示中文行。
- 字典初版覆盖 0.1.2-alpha.2 部署的全部 150 个挂载模块。

## 开发循环

1. 编辑 `client.js`（全部行为在此；`index.js` 为 Node 半占位）；遵守准则 P1–P10
2. 随时验证：`node E:\DSH\DSH-ops\validate-plugins.mjs` —— 必须全绿才能进入安装

## 安装

经 `dsh-personal-hub` 统一安装：`personal-hub/personal.json` 清单已含本插件，`personal_hub_reapply` 一键完成 dependencies + bundles + pnpm install，重启服务生效。

## 已知边界

- 面板文案为硬编码简体中文（本插件目的即汉化说明），不接 locale 字典。
- 卡片折叠态标题保持官方英文短名，不改动 React 管理的文本节点；翻译体现在展开区。
- 说明文字是人工维护的静态字典，不联网翻译。
- 按插件 key 分发的 `settings.plugin.item` 槽（可配置插件卡）与本插件无关，未使用。
