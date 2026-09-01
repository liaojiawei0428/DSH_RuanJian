# dsh-github-push

> DSH 插件：把本地项目目录绑定到 GitHub 仓库，**由用户手动触发推送**（`git add -A` → `git commit` → `git push`），不做定时任务。

遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发（P1–P11）。

## 工作方式

- **绑定**：面板中为每个本地项目配置一条「绑定」——绑定名称、本地目录绝对路径、GitHub `owner/repo`、目标分支、PAT Token。
- **状态**：打开面板自动探测每条绑定的仓库状态：是否 git 仓库、当前分支、未提交改动数、相对远端领先/落后（有 Token 时经 `git ls-remote` 比对）。
- **手动推送**：点行内「推送」→ 输入提交说明（可留空，默认 `chore: DSH sync`）→ 确认后 Host 依次执行 add → commit → push，结果回显。
- **凭据**：Token 存 `~/.dsh/github-push/credentials.json`（独立于 state），进 UI 只显示「是否已配置」，不回流。推送时经 `GIT_ASKPASS` 临时脚本注入——Token 不进命令行、不进 git remote/config、进程结束后临时目录即删。
- **安全**：只做 fast-forward push，远端分叉时明确报错（不 force）；非 git 目录明确提示（不自动 init）。

## 配置字段

| 字段 | 含义 | 示例 |
|---|---|---|
| `name` | 绑定名称 | DSH-ops |
| `localPath` | 本地项目目录（绝对路径） | `E:/DSH/DSH-ops` |
| `repoOwner` | GitHub 用户名/组织 | `YourName` |
| `repoName` | 仓库名 | `DSH-ops` |
| `branch` | 目标分支 | `main` |
| `token` | GitHub PAT（fine-grained，Contents 读写 + Metadata 只读） | `github_pat_…` |

## 安装（三步）

1. profile `package.json` 的 `dependencies` 加：
   `"dsh-github-push": "link:E:/DSH/DSH-ops/plugins/dsh-github-push"`
2. `dsh.profile.bundles` 数组追加 `"dsh-github-push"`
3. profile 目录执行 `pnpm install`，然后重启服务（预检闸门自动运行）

## 验证

- `node E:\DSH\Deepseek_DSH/apps/cli/lib/bin.js --profile web --dump-config` 出现 `id: github-push` 行
- `node E:\DSH\DSH-ops\validate-plugins.mjs` 全绿（含 `dsh-github-push: loads, apply() registers`）
- Web 会话头部出现「Git 推送」胶囊，打开面板能新增绑定并推送
- 手动验证：`git -C E:/DSH/DSH-ops status` 与面板显示一致

## 已知边界

- 只支持 HTTPS + PAT；不支持 SSH key 认证。
- 不做定时/自动推送（按需求由用户决定时机）。
- 不做 `git pull` / `git init` / 冲突自动解决——远端落后/分叉时报错，由用户本地处理。
- 提交只走 `git add -A`（全部改动），不支持部分文件选择。
- 探测 ahead/behind 需 Token 且远端分支存在；私有仓库匿名 ls-remote 不可达时退化为「未同步」状态。