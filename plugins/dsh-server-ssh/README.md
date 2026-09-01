# dsh-server-ssh

服务器配置登录：在 Web GUI 中配置 SSH 远程主机，全部会话即可通过 `ssh_*` 工具读写操作该服务器。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发（零 `@deepseek-ai/*` 导入；ssh2 经 esbuild 内联进产品包）。

## 功能概述（用户视角）

- **GUI 管理面板**：会话头部工具区的「SSH」按钮打开服务器管理器——新增/编辑/删除服务器、测试连接、把当前会话绑定到某台服务器。
- **七个模型工具**：`ssh_read / ssh_write / ssh_edit / ssh_list / ssh_glob / ssh_grep / ssh_bash`。会话绑定了服务器时，模型直接用它们操作远端（路径均为 POSIX 风格，`~` 表示远端家目录）。
- **每会话独立目标**：`selectedBySession` 记录各会话绑定；系统提示词中注入当前目标描述，切换绑定在下一次请求生效，无需重开会话。
- **安全边界**：密码仅存进程内存（`Buffer.fill(0)` 主动擦除，永不落盘）；主机密钥三层校验（已存指纹 > `allowFingerprint` > known_hosts TOFU），不匹配即拒绝并要求人工确认；存储文件 `~/.dsh/server-ssh/state.json` 不含任何凭据。

## AI 标准操作流程（SOP）

### 何时使用

- 用户要求「连接 / 操作 / 部署到远程服务器」且尚未配置该服务器时：让用户在 GUI 打开 SSH 面板配置，或引导其提供连接参数后由 AI 说明需在面板中录入（密码类凭据 AI 不代录）。
- 会话内检查绑定：无绑定时报错 `NO_TARGET`，此时提示用户在「SSH」面板绑定服务器。

### 工具选择

| 任务 | 工具 |
| --- | --- |
| 读文件 / 写文件 / 精确替换 | `ssh_read` / `ssh_write`（≤512KB）/ `ssh_edit` |
| 目录列表 / 按模式找文件 / 按正则搜内容 | `ssh_list` / `ssh_glob` / `ssh_grep` |
| 运行命令 | `ssh_bash`（timeout_ms 1000–300000，超时返回 timedOut） |

- 远端路径一律 POSIX（`/var/log/app.log`、`~/deploy.sh`）；Windows 风格路径会被拒绝（`INVALID_INPUT`）。
- 未知主机首连会报 `HOST_KEY_UNTRUSTED`：让用户在面板中「测试连接」确认指纹后重试。

### 故障排查

1. 报错码即语义：`AUTH_FAILED`（凭据错）、`HOST_KEY_CHANGED`（指纹不符，删库重测）、`SERVER_BUSY`（有会话绑定，删除需 `force`）、`PASSWORD_REQUIRED`（密码认证但未提供）。
2. 服务端日志：`E:\DSH\DSH-ops\dsh-web.err.log` 中检索 `[server-ssh]`。
3. buglog 检索关键词：`server-ssh`、`ssh2`。

## 工作原理

```
Web GUI「SSH」按钮 ──rpc /dsh-server-ssh──► applyRpc（server.* / target.* / state）
        │                                        │
        │                              ServerStore（~/.dsh/server-ssh/state.json）
        │                                        │
        └── 会话绑定 target.set ──► orchestrator：agent/created 时挂
                                   systemPrompt.context（动态 text，每次组合重算）
                                            │
 模型 ssh_* 工具 ──► resolveTarget(sessionId) ──► ConnectionManager（ssh2 连接池，TOFU）
```

- **双包结构**：`index.js`（Host，esbuild 内联 ssh2 1.17.0，纯 node: 导入）+ `client.js`（浏览器，`__ModuleLoader__` 信封，react/cordis 走共享模块表）。
- **RPC 双信封**：`{ v:'dsss:1', ok, data|error{code,message,stage} }`；域错误也在 `ok:true` 的 value 内，只有传输层故障 reject。
- **作用域上下文**：`systemPrompt.context({name:'ssh-server-target', text})` 的 `text` 是闭包，读取当前 store 状态——绑定变化即时反映，代理释放自动展开。
- **连接池**：每服务器单连接、单飞复用；SFTP 句柄缓存；`server.reconnect` / `server.remove` 时断开；插件停止时 `dispose()` 全量清理并擦除密码。

## 配置与数据

- 存储：`%DSH_HOME%/server-ssh/state.json`（损坏自动隔离重建为 `state.json.corrupt-<ts>`）。
- 字段：`name/host/port/username/auth{type: key|agent|password|auto, keyPath?}/remoteRoot`；`auth.password` 只进内存。
- 面板轮询：模态框打开期间每 5 秒刷新一次状态。

## 维护说明

- ssh2 处于低维护状态（作者声明安全修复仍会发布）；升级时只改 `package.json` devDependency 精确版本并重跑 `pnpm build`（post-build 断言保证产品零裸导入）。
- `cpu-features` / `sshcrypto.node` 可选原生加速在构建中被 stub，ssh2 走纯 JS 路径——无需 `pnpm approve-builds`。
- 改 `src/` 后必须：`pnpm build` → `node E:\DSH\DSH-ops\validate-plugins.mjs` 全绿 → 重启服务。
- 安装（三步）：profile `package.json` 依赖加 `"dsh-server-ssh": "link:E:/DSH/DSH-ops/plugins/dsh-server-ssh"`；`dsh.profile.bundles` 追加 `"dsh-server-ssh"`；profile 目录 `pnpm install` 后重启（预检闸门自动运行）。
