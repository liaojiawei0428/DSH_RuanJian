# dsh-server-ssh 自研插件设计（v1）

依据：`research/remote-ssh-audit-report.md`（参考插件审核 + 本机架构验证）+ 用户决策（独立 ssh_* 工具集）。
准则：`E:\DSH\DSH-ops\PLUGIN-STANDARD.md` 全条（P1–P11，G1–G5）。

---

## 0. 目标与边界

- 用户在 GUI 配置 SSH 服务器（增删改查、测试连接、指纹信任），**所有会话**可读取配置；
- 每个会话可选择一台服务器作为当前目标，模型随即获得 `ssh_*` 工具集操作该远程主机（文件读写编辑、目录、搜索、命令执行）；
- 密码/密钥安全边界与参考插件一致（密码仅进程内存、退出遗忘；host key TOFU；不转发 agent）。
- 明确不做（v1）：同名工具遮蔽、终端持久会话（ssh_terminal）、ripgrep 远端供给、交接聊天卡片——均列为后续增强。

## 1. 总体架构

```
┌─ client.js（浏览器）─────────────────────────────┐
│ 目标选择器（输入框旁 Slot）· 服务器管理/编辑 Modal │
│ 连接引导（ssh-keygen/agent）· 错误状态卡          │
│ RPC: rpc.call('/api', 'dshServerSsh/<method>')   │
└──────────────┬───────────────────────────────────┘
               ┌──────────────────────────────────┐
┌─ index.js（Host, esbuild 产物, ssh2 内联）────────┐
│ store     服务器配置持久化（DSH_HOME/state.json） │
│ transport 连接池（按 serverId）· SFTP · TOFU      │
│ orchestr  agent 事件编排 · scoped systemPrompt    │
│ tools     7 个 ssh_* 工具（per-agent 目标路由）    │
│ rpc       /api 下自有 endpoint（loopback authority）│
└──────────────────────────────────────────────────┘
```

## 2. 目录与构建

```
plugins/dsh-server-ssh/
  src/
    index.js        host 入口（apply 编排，P5/P6：fail-loud）
    store.js        配置存储（写链自愈 + 损坏隔离重建 + 备份）
    transport.js    ConnectionManager（连接池/单飞/TOFU/错误分类）
    sftp-io.js      SFTP 读写原语（原子写/乐观版本/CRLF 采样/二进制拒绝）
    tools.js        7 个 ssh_* 工具定义与 handler
    orchestrator.js agent 事件编排 + scoped systemPrompt + 目标路由
    rpc.js          RPC handler（方法面 + 双包络错误）
    utils.js        校验/脱敏/指纹/known_hosts 匹配/shellQuote
  client.src/       （可选拆分；先单文件手写，格式照 dsh-deepseek-balance 先例）
  client.js         浏览器面（ModuleLoader 壳，inject:['slots']）
  build.mjs         esbuild 打包 src/index.js → index.js（ssh2 内联，
                    external:['@deepseek-ai/*']，stub cpu-features/sshcrypto.node；
                    产物自检：import 列表仅 node: 且 ssh2 不出现）
  index.js          构建产物（exports "." 指向；**不手改**）
  package.json      P1 全项：private/type:module/exports 四条/dsh.bundle.patch/dsh.client
  cordis.patch.yml  一行 insert：id: server-ssh, name: dsh-server-ssh
  README.md         P10 五节（含 ssh2 版本与审计节奏说明）
```

- 入口 imports 仅 `node:*` + 注入服务（P2）；ssh2 为 devDependency，仅构建期存在，package.json 固定精确版本。
- `node new-plugin.mjs dsh-server-ssh` 起步，脚手架骨架按上表扩展。

## 3. store（服务器配置存储）

- 路径：`path.join(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'), 'server-ssh', 'state.json')`——不依赖进程 cwd。
- schema v1：`{ version: 1, servers: Server[], selectedBySession: Record<sessionId, serverId> }`；`Server = { id, name, host, port, username, auth: {type: key|agent|password|auto, keyPath?, allowFingerprint?}, remoteRoot, fingerprint?, createdAt, updatedAt }`；密码永不落盘（内存 `Buffer`，连接池持有，`forgetPassword` 时 `fill(0)`）。
- 写链（修对方 major#1）：串行队列 + 每 次 `catch` 记录并**继续接受后续写入**（失败只丢弃当次，链不死）；tmp 文件（`.pid.timestamp.tmp`）+ `rename` 原子替换。
- 读入自愈（修 major#2）：解析失败 → 原文件复制为 `state.json.corrupt-<ts>` 备份 → 空状态重建 → 日志告警，不抛出、不阻塞插件加载（防 G3 隔离）。
- upsert（修 major#3）：`host`/`port`/`username` 任一变更时清空 `fingerprint`（重走 TOFU）；`id` 不变保持会话绑定。

## 4. transport（SSH 连接层）

- `ConnectionManager`：`Map<serverId, entry>`，entry = `{ client, sftp?, connectPromise, password }`；`connect` 单飞；stale-entry 守卫（close/error 回调先比对 `entries.get(id)`）。
- ssh2 全部事件源（client/sftp/临时测试连接）**常驻 `on('error')`**（对方血训：认证候选迭代多发 error，`once` 会进程级崩溃）。
- 错误分类 → 编码错误（`NETWORK_TIMEOUT / NETWORK_REFUSED / HOST_NOT_FOUND / AUTH_FAILED / KEY_PASSPHRASE_REQUIRED / PASSWORD_REQUIRED / HOST_KEY_UNTRUSTED / HOST_KEY_CHANGED`），RPC 双包络携带到 UI。
- host key 三级 TOFU：配置指纹 > 请求级 `allowFingerprint` > `~/.ssh/known_hosts`（含 `|1|` HMAC-SHA1 hashed 匹配）；变更即拒并提示。
- 认证顺序：keyPath/keyPath 探测（`~/.ssh/id_ed25519|ecdsa|rsa`）→ agent（`SSH_AUTH_SOCK` + Windows 管道）→ password。`port` 校验 `??`（不吞 0）；`auth.type` 非法值显式报错（P6）。
- `test(server)`：临时连接探针 SFTP→realpath→`uname`→`$SHELL`，onStage 进度回报 UI。

## 5. 工具面（7 个，独立 ssh_* 前缀）

所有工具 handler：先取当前会话目标（无目标 → 明确错误结果提示先在 UI 选择服务器，P6），再走连接池。schema 方言按 P4。

| 工具 | 参数 | 行为 |
|---|---|---|
| `ssh_read` | `path`, `offset?`, `limit?` | 全文/窗口读取，≤ 256KB 截断标注；二进制拒绝（NUL 探测） |
| `ssh_write` | `path`, `content` | tmp + posix-rename 原子写；返回新版本（size+mtime） |
| `ssh_edit` | `path`, `oldString`, `newString`, `replaceAll?` | 唯一匹配替换；CRLF 采样对齐；无匹配/多处匹配明确报错 |
| `ssh_list` | `path` | 目录清单（名称/类型/大小/mtime），含隐藏项标注 |
| `ssh_glob` | `pattern`, `cwd?` | `find` 实现通配（`*`/`**`/`?`），结果上限 200 条 |
| `ssh_grep` | `pattern`, `path?`, `ignoreCase?` | 远端 `grep -rn` 包装，结果上限 100 行 |
| `ssh_bash` | `command`, `timeoutMs?`, `background?` | 前台：64KB 尾窗 + 超时杀进程组；后台：nohup 启动返回 pid |

工具结果文本带服务器名前缀标注，避免跨服务器混淆。

## 6. 会话编排（orchestrator）

- `agent/created`：读 `selectedBySession[agent.session.id]`；有目标 → 在 `agent.ctx` 上 `systemPrompt.context` 注入执行世界（服务器名/host/账户/默认 cwd/OS/工具说明），并保持到 target 变更。
- `agent/pre-step`（waterfall，必 `next()`）：轻量校验——目标服务器仍在配置中且连接可用；**不可达时降级**（修 major#4）：注入一条警告上下文（"当前目标无法连接，可提示用户检查"）并放行，绝不阻塞会话。
- `target.set` RPC（client 选择器）：写 store + 对活跃 agent 立即重注入上下文（dispose 旧 context effect 后重挂）。
- 服务器编辑/删除：`busyUsingServer` 锁（被任何活跃会话用作目标时拒绝删除，编辑允许但触发重同步）。
- 会话结束（`agent/disposed`）：清 scoped 注册（自动回卷）+ 释放该会话目标占用计数。

## 7. RPC 面（channel `/api`，endpoint 前缀 `dshServerSsh/`）

`state`（全量脱敏视图）· `server.upsert` · `server.remove` · `server.test` · `server.testAndSave` · `server.reconnect` · `target.set` · `target.clear`
双包络协议照参考插件：transport ok + `{ v: 'dsss:1', ok|error{code,message,stage?} }`，编码错误穿透到 UI。authority：loopback（本机 GUI）。

## 8. Client 面

- 壳格式照 `dsh-deepseek-balance` 先例：`window.__ModuleLoader__.load({id:'dsh-server-ssh', factory})`，`inject:['slots']`（0.1.2 并发 apply 语义），react 从 require 种子词取。
- 目标选择器：输入框旁 Slot（准确 Slot 名开发期用 cordis_inspect_list/query 核实，先例 `conversation.session.header.utilities` 证明命名风格）；显示当前目标 + 下拉切换 + 状态点（绿=已连接/黄=未验证/红=错误）。
- 服务器管理 Modal：列表 + 新增/编辑表单（校验照 utils）+ 测试连接（onStage 进度）+ 删除（busy 锁拒绝时提示）；host key 首次信任/变更警告卡。
- 连接引导：按平台分页的 `ssh-keygen`/`ssh-add` 命令说明（目标文本防注入：正则白名单转义）。
- 5s 轮询仅在管理 Modal 打开时运行；其余状态靠 RPC 推送（host → client 事件或选择器低频拉取）。

## 9. 里程碑

| M | 内容 | 出口 |
|---|---|---|
| M1 | 脚手架 + store + utils + RPC(state/upsert/remove) + client 管理 UI | 闸门绿；GUI 可管理服务器配置（未连接） |
| M2 | transport + test/testAndSave + TOFU + 连接引导 | GUI 可测试连接并保存指纹 |
| M3 | sftp-io + 7 工具 + agent/created 注入 + target.set/clear | 会话选择目标后模型可用 ssh_* 操作 |
| M4 | pre-step 门（降级版）+ busy 锁 + reconnect + 错误卡完善 | 全链路可用 |
| M5 | 构建产物自检 + 闸门 + link 安装 + request_restart + 实测（本机可达的 SSH 目标） | 重启后插件在线、工具实测通过 |

## 10. 风险与对策

- **esbuild 产物直载风险**：产物必须 ESM、仅 node: import；build.mjs 内置自检（解析产物 import 列表断言）。
- **ssh2 内联体积**：预计 +1MB 量级，启动加载无碍（本地文件）；stub 两个 native 候选。
- **Slot 名不确定**：M1 开发期先用 Inspect 核实，若输入框旁 Slot 不存在则降级到会话头工具行（先例已验证）。
- **G3 风险**：所有加载期代码 fail-loud 但不依赖外部状态；store 读取自愈保证坏文件不炸启动（audit §5.2 的本机化）。
