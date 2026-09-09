# dsh-deepseek-balance

DSH 系统组件：在个人插件工具栏（输入卡下方横排一行，`dsh.personal.bar`）显示两个胶囊：

1. **余额胶囊**：DeepSeek 账户余额，点击立即刷新，**每 5 分钟自动静默刷新**，
   余额 ≤ ¥10 橙色警示，悬停显示明细。
2. **版本胶囊**：`DSH版本号：xxx`，悬停显示本地 commit 与检查状态；
   **每 1 小时自动检查官方仓库更新**（host 定时器），发现更新后胶囊变为
   高亮脉动的 **「有新版本」**，点击立即启动自动更新（分离进程运行
   `update-dsh.ps1`，完成后服务自动重启，刷新页面即见新版）。

- **Host 半端**（`index.js`）：
  - `/api/dsh/deepseek-balance`：余额路由，`credentials` 服务解析
    `DEEPSEEK_API_KEY`，官方 `https://api.deepseek.com/user/balance`，60 秒缓存。
  - `/api/dsh/repo-status`：版本检查路由，读本地 `package.json` 版本号，
    经系统代理 `git fetch origin` 对比 `HEAD` 与 `origin/master`，
    结果缓存 1 小时（`?force=1` 立即重查），并发请求复用同一次 fetch。
   - `/api/dsh/update-now`：POST 在**可见终端窗口**中启动自动更新
     （`cmd /c start` 打开新控制台，进度全程可见——与手动双击 `更新DSH.bat`
     完全一致的体验：git 拉取、依赖安装、构建输出、成功后约 3 秒自关、
     失败时暂停显示错误）。pwsh 7 按优先级定位：`DSH_PWSH_PATH` 环境变量 →
     `PATH` 各目录 → Program Files 默认安装位；PATH 可达时窗口直接运行
     `更新DSH.bat`，否则用绝对 pwsh 路径运行 `update-dsh.ps1`。更新进程以
     `DSH_UPDATE_SOURCE=auto` 运行（台账记"自动更新"），自带全套守卫：
     干净检查/备份/构建/组合预检/插件闸门/健康检查；窗口未能打开时向胶囊
     如实返回失败（不静默）。
- **浏览器半端**（`client.js`）：手写 client bundle，注册到个人插件工具栏子槽位
  `dsh.personal.bar`（dsh-personal-hub 在输入卡下方托管的横排一行）两个胶囊
  （余额 order 100、版本 order 101），余额 5 分钟轮询、版本 5 分钟轮询（host 控制真实检查节奏）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `repoDir` | 自动推导（DSH-ops 同级 `Deepseek_DSH`） | DSH 主仓库路径（版本检查目标） |
| `opsDir` | 自动推导（本插件所在 DSH-ops） | 运维脚本目录（`update-dsh.ps1` 所在） |
| `checkIntervalMs` | `3600000` | 官方仓库检查间隔（1 小时） |

默认值按"两仓库同父目录"结构从插件自身位置推导（盘符任意）；仅当布局偏离约定时在 profile `cordis.patch.yml` 覆盖。

## 在新电脑上部署（同步 DSH 插件）

前置：本仓库已 clone，DSH 已安装并能启动 web 服务。

1. **挂载到 web profile**：编辑 `%DSH_HOME%\profiles\web\package.json`
   （默认 `C:\Users\<你>\.dsh\profiles\web\package.json`）：

   - `dependencies` 加入（注意把 `<本仓库盘符>` 换成本机实际路径）：

     ```json
     "dsh-deepseek-balance": "link:<本仓库路径>/plugins/dsh-deepseek-balance"
     ```

   - `dsh.profile.bundles` 数组加入 `"dsh-deepseek-balance"`。

2. **建立链接**：在 profile 目录执行 `pnpm install`。

3. **重启 web 服务**：插件行在启动时加载；启动后刷新页面即可看到余额胶囊。

## 验证

- `curl http://127.0.0.1:3080/api/dsh/deepseek-balance` 返回余额 JSON。
- 设置 → 插件列表出现 `dsh-deepseek-balance` 条目。
