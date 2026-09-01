# dsh-personal-hub

个人 DSH 配置器：把个人插件与配置覆盖收敛为一份声明式清单（唯一权威），官方 DSH 升级后按清单一键重建 web profile。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## 工作方式

- 清单：`E:\DSH\DSH-ops\personal-hub\personal.json`（JSON，零依赖可原子写）。声明 web profile 目录、自研插件根、官方基底层 bundles、个人插件列表（含各自 `cordis.patch.yml` 覆盖）与非插件绑定的部署覆盖。
- 三个模型工具：
  - `personal_hub_status` — 比对清单与 profile 实况（dependencies / bundles / patch 条目），报告漂移；只读。
  - `personal_hub_validate` — 校验清单结构、插件目录在位、id 唯一、官方层与个人层无重名；只读。
  - `personal_hub_reapply` — 备份 → 按清单重写 `package.json`（dependencies + `dsh.profile.bundles`）→ 重生成 `cordis.patch.yml` 的**托管条目**（官方/未知块逐字保留）→ profile 目录 `pnpm install` → 复检。不重启服务。
- 托管条目 id 约定：插件 = 包名去 `dsh-` 前缀（如 `dsh-tool-python` → `tool-python`）；部署覆盖用清单里显式的 `id`。
- 默认清单路径从插件目录推导（`<ops 根>/personal-hub/personal.json`）；可用本插件 config 的 `manifestPath` 覆盖。

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
