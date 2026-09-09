# dsh-personal-hub

个人 DSH 配置器：把个人插件与配置覆盖收敛为一份声明式清单（唯一权威），官方 DSH 升级后按清单一键重建 web profile。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## 工作方式

- 共享清单：`<ops 根>/personal-hub/personal.json`（JSON，git 同步，**机器无关**）。只声明组合意图：官方基底层 bundles、自研插件列表（含 patch 注释）。**不写绝对路径**——`profileDir` 运行时派生（`$DSH_HOME` 或 `~/.dsh` + `profiles/web`），`pluginsDir` 从本插件自身所在仓库布局派生。
- 本机覆盖层：同目录 `personal.local.json`（**gitignore，每台机器自建**）。放机器特定的绝对路径（如 `tool-python` 的 `pythonPath`、`pwsh-sandbox` 的 `pwshPath`）与机器特有条目。合并语义：`plugins` 按 `name`、`extraPatches` 按 `id` 深合并，覆盖值优先；文件不存在则纯用共享清单 + 派生默认值。
- 三个模型工具：
  - `personal_hub_status` — 比对清单（合并后视图）与 profile 实况（dependencies / bundles / patch 条目），报告漂移；只读。
  - `personal_hub_validate` — 校验清单结构、插件目录在位、id 唯一、官方层与个人层无重名；只读。
  - `personal_hub_reapply` — 备份 → 按清单重写 `package.json`（dependencies + `dsh.profile.bundles`）→ 重生成 `cordis.patch.yml` 的**托管条目**（官方/未知块逐字保留）→ profile 目录 `pnpm install` → 复检。不重启服务。
- 托管条目 id 约定：插件 = 包名去 `dsh-` 前缀（如 `dsh-tool-python` → `tool-python`）；部署覆盖用清单里显式的 `id`。
- 默认清单路径从插件目录推导（`<ops 根>/personal-hub/personal.json`）；可用本插件 config 的 `manifestPath` 覆盖。

## 个人插件工具栏（browser half）

浏览器半在输入卡下方（官方槽位 `conversation.composer.dock`）注册**一行**宿主条目，并声明子槽位 `dsh.personal.bar`（list / session）。所有个人插件的按钮注册到该子槽位，由宿主统一横排——个人控件与官方标题行按钮彻底分离，且互不争抢空间。

- **扩展方式**（任何自研插件，无需改宿主或官方代码）：
  ```js
  slots.inject('dsh.personal.bar', () => slots.register(
    { name: 'dsh.personal.bar', id: '<唯一 id>', order: <数字> },
    YourCapsule,
  ))
  ```
- **排序**：官方 list 语义按 `order` **升序**（`Array.prototype.sort` 稳定，`order` 相同则保持注册顺序）。当前占用：`server-ssh` 30、`github-push` 40、`deepseek-balance` 100、`deepseek-balance-version` 101；负数可插到最前。
- **换行**：宿主容器为 `display:flex; flex-wrap:wrap`，宽度上限与官方内容列对齐；按钮放不下时**自动换行**，不会溢出或堆叠成列。
- **接入约定**：新插件取 `order` 时在现有区间外选值（如 10/20/110+），避免与既有条目同值（同值虽可稳定排序，但顺序取决于加载顺序，不便预测）。

## 个人部署层设置页（browser half）

浏览器半另外注册官方「设置 → 插件」分区的一页（`settings.plugins.tab`，id `personal-hub`，order 30）：显示清单漂移状态（无漂移 / 逐项漂移列表），并提供「重新检查」「一键重建」两个动作。

- **RPC 通道**：host 半在 `connection` 服务上注册包私有通道 `/dsh-personal-hub`，端点 `status` / `validate` / `reapply`，返回平台信封 `{ ok, value | error }`；`connection` 是可选服务（`ctx.get`），缺失时页面提示"连接服务尚未就绪"，模型工具不受影响。
- **异步安装**：`reapply` 内的 `pnpm install` 走**异步 `spawn`**（超时上限 `INSTALL_TIMEOUT_MS`），不再阻塞事件循环——否则点击「一键重建」会冻结整个服务（此前工具调用也有此问题，已一并修复）。
- 页面只渲染 host 返回的 JSON；所有决策与写入都在 host 半完成。

## 配置字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `manifestPath` | string | `<ops 根>/personal-hub/personal.json` | 声明清单的绝对路径 |

## 安装（三步）

1. profile `package.json` 的 `dependencies` 加：
   `"dsh-personal-hub": "link:E:/DSH/DSH-ops/plugins/dsh-personal-hub"`
2. `dsh.profile.bundles` 数组追加 `"dsh-personal-hub"`
3. profile 目录执行 `pnpm install`，然后重启服务（预检闸门自动运行）

首次安装后即由 `personal_hub_reapply` 接管后续安装/重适配（含 `pnpm install`）。

## 验证

- `node E:\DSH\Deepseek_DSH/apps/cli/lib/bin.js --profile web --dump-config` 出现 `id: personal-hub` 行
- 调用 `personal_hub_status`：清单与 profile 一致时报告"无漂移"
- 人为把一个插件从 profile `dependencies` 删除后 `personal_hub_status` 应报缺失，`personal_hub_reapply` 后恢复

## 官方升级后的重适配流程

1. `update-dsh.ps1` 完成官方升级。
2. `personal_hub_validate` → 必须全绿（官方删包/改名会导致清单校验失败，先改清单）。
3. `personal_hub_reapply` → 备份并重建个人层。
4. 重启服务；`personal_hub_status` 复检无漂移。

## 已知边界

- 只管理 web profile 的三件套（`package.json`、`cordis.patch.yml`、`cordis.yml` 备份）；不触碰 `~/.dsh` 的 credentials 与 settings。
- `cordis.patch.yml` 解析按 `- id:` 行分块的受限形式；官方若改变该文件整体格式，托管条目仍会重生成，但非托管块保留依赖分块假设，reapply 前先看备份 diff。
- 不自动重启 DSH 服务；reapply 完成后需显式重启使新组合生效。
- 官方升级若引入新的 patch 默认行，`personal_hub_status` 会将其列为"非托管条目"供知悉，不会自动删除或改写。
