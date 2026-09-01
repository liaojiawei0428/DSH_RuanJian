# remote-ssh 参考插件审核报告 + 本机自研架构验证

审核对象：`NaNQiQ/deepseek-harness-remote-ssh`（源码快照 `E:\DSH\DSH-ops\research\remote-ssh-ref\`，15 文件 3950 行）
目标版本：本机 DSH 0.1.2-alpha.3（源码部署 `E:\DSH\Deepseek_DSH`）
审核方法：三路并行源码审计（client.js；connection/fs/subprocess/realm/utils；index/store）+ 本机 API 逐一验证。
结论先行：**对方插件的设计思路成立，但其"provider seam 替换"实现层在本机不可复用（P2 约束 + 版本线差异）；本机存在一条更原生的等价接缝——scoped 工具遮蔽（`ctx.tools.register` on `agent.ctx`），自研插件走"配置共享 + scoped SSH 工具"路线。**

---

## 1. 参考插件总体架构（值得继承的思路）

目标版本 0.1.0-rc.8。核心不变式："执行移动，DSH 不动"——官方工具（read/write/edit/bash/glob/grep/terminal）代码不变，改的是它们底下注入的 `fs`/`shell` 服务实现。

四层结构：

| 层 | 文件 | 职责 |
|---|---|---|
| 状态 | store.js (232) | 服务器配置持久化 `state.json`（schema v8），原子写（写链串行 + tmp + rename），密码永不落盘 |
| 传输 | connection-manager.js (446) | Host 级连接池，**按服务器 id** 复用 ssh2 传输 + SFTP 通道；连接单飞；错误分类编码；host key 三级 TOFU |
| 替换 | remote-fs.js / remote-subprocess.js / remote-realm.js (988) | `SshFileSystem extends FileSystem`、`SshSubprocessRuntime extends SubprocessRuntime`；per-agent isolate 5 服务后重挂 9 个官方工具包 |
| 编排 | index.js (623) | RPC（7 方法）+ 事件编排 + per-agent realm 生命周期 + systemPrompt 注入 + pre-step 就绪门 |
| UI | client.js (905) | 目标选择器（输入框旁 Slot）+ 服务器管理/编辑 Modal + 连接引导 + 错误状态；RPC 双包络协议 |

### 会话编排生命周期（照抄价值最高）

- `agent/created`：读 target，有则挂 realm + 冻结快照（structuredClone）；`agent/session-start` 恢复；
- `agent/status` running→idle：解冻 + 重同步；
- `agent/pre-step`：**权威门**——下一步前确保 realm 与目标一致（`next()` 放行）；
- `agent/disposed`：清理 per-agent 状态（realm 本体靠 isolate 回卷）。
- 服务器编辑/删除受 `busyUsingServer` 锁保护（使用中不可改删）。
- systemPrompt：per-agent scoped `context({name, order:10000})` 注入"当前执行世界"说明 + waterfall 覆盖 `variables.cwd`。

### 安全边界（SECURITY.md 承诺，自研保持）

- Agent 模式：不读私钥、不转发 agent；Key 模式：只存路径，连接时读；密码模式：仅进程内存，退出即 `fill(0)` 遗忘。
- host key 三级信任：配置指纹 > 单次确认指纹 > `~/.ssh/known_hosts`（含 hashed `|1|salt|hash` HMAC-SHA1 匹配）。
- 远端权限 = 远程账户权限（README 明确声明 remoteRoot 是默认 cwd 不是沙箱）。

---

## 2. 本机架构验证（决定自研路线的关键证据）

| # | 验证点 | 结论 | 证据 |
|---|---|---|---|
| 1 | `ctx.isolate` API 存在 | ✅ | api-catalog.ts L6179（`ctx.extend / ctx.isolate / ctx.intercept`） |
| 2 | 官方 tool-fs/tool-bash 经服务注入 fs/shell | ✅ | tool-fs `inject=['tools','fs','systemPrompt']`（index.ts L22）；tool-bash `inject=[...,'shell',...]` |
| 3 | 官方工具的 fs 注入解析时机 | **挂载时固定** | tool-fs/src/index.ts `apply()` 把 `ctx.fs` 经闭包传给 applyRead/Write/EditTool；handler 内 `ctx.fs.xxx` 全是挂载实例引用（read.ts L144、write.ts L113、edit.ts L126） |
| 4 | 静态 link 插件运行时 import 官方包 | ❌ 不可行 | link 安装无自有 node_modules，解析链不含主仓库 workspace；P2 硬规则禁止 `@deepseek-ai/*` import（事故血训） |
| 5 | **scoped 工具遮蔽**（本机等价接缝） | ✅ **决定性** | docs/subsystems/tools.md L499："Register globally or in the calling agent scope. **Scoped tools shadow globals**"；解析走 `layers.chainLayers(exec.agent)`（tools/src/index.ts L1113） |
| 6 | agent scope 级工具限制 | ✅ | tools.md L507：`restrict(filter)` "Restrict global tools for the calling agent scope" |
| 7 | `Agent.ctx` 存在且 scoped | ✅ | runtime-types.ts L82："Agent-scoped context; its contributions are agent-local, **unwind on disposal**" |
| 8 | agent 生命周期事件 payload | ✅ | runtime-types.ts L166/175/185/224：`agent/created|disposed|status|session-start` 均携带 `{ agent }` |
| 9 | RPC 通道 | ✅ | packages/client/connection：host `connection.rpc.handle(channel, handler)`（rpc.d.ts L107）；client `rpc.call(channel, endpoint, {args})` |
| 10 | agent/pre-step 门 | ✅ | 对方用法本机可复刻（waterfall，须 `next()`） |
| 11 | scoped systemPrompt | ✅ | 官方插件先例（goal-round-driver 等 `scope.systemPrompt.context`） |
| 12 | 自研 client bundle 形态 | ✅ | 本机先例 dsh-deepseek-balance / dsh-plugin-guide：手写 `window.__ModuleLoader__.load({id, factory})`，`require` 种子词含 react/`@deepseek-ai/cordis`，须声明 `inject:['slots']`（DSH 0.1.2 并发 apply 语义） |

**推论**：验证 3+4 封死"isolate 服务 + 重挂官方工具"路线（官方工具代码我们拿不到、其 fs 注入在 host 挂载时已闭包固定）；验证 5+6+7 打开本机等价门——**在 `agent.ctx` 上注册 scoped 工具遮蔽/补充全局工具，disposal 自动回卷，无需 isolate、无需官方包源码**。

---

## 3. 可复用 vs 不可复用清单

### 直接移植（P2 干净，仅相对 + node: import）

- **index.js 编排骨架**：RPC 方法面、事件编排、pre-step 门、busy 锁、快照/恢复 —— 全部照抄思路，去掉 realm 挂载改为 scoped 工具注册。
- **store.js**：schema 结构、原子写、密码不落盘 —— 移植时修 3 个已知 bug（见 §5）+ 路径改挂 `DSH_HOME`。
- **utils.js**：校验、脱敏视图、指纹、known_hosts 匹配、shellQuote —— 照抄。
- **connection-manager.js**：连接池/单飞/错误分类/TOFU —— 照抄 + 修 2 个 bug + ssh2 内联。

### 思路继承、代码重写（P2 受阻）

- **remote-fs.js / remote-subprocess.js**：`extends FileSystem/SubprocessRuntime` 的 import 不可用；但 SFTP 语义（原子写 ext_openssh_rename、乐观版本、CRLF 采样、二进制拒绝）与执行语义（ Collector 64KB 尾窗、setsid 脱离、TERM→KILL 阶梯、PTY 前台组查询、ripgrep 供给）**全部转为自研工具的内部实现**。
- **remote-realm.js**：整体废弃，替代物 = agent.ctx 上的 scoped 工具注册。
- **client.js**：ModuleLoader 壳与 primitives 引用按本机先例重写；RPC 方法名、双包络协议、Modal/选择器交互照抄。

### 交付形态差异（对方明确避免的路线，本机为最优可行）

对方 README 明确"不新增能力受限的 ssh_* 替代工具"——它的底气是 provider seam（官方工具换 provider，能力零损失）。本机 seam 对插件封闭，两条路：
- **A. 同名遮蔽**：agent.ctx 上注册同名 read/write/edit/bash… 自研实现，模型零感知。要求自研工具 100% 复刻官方 schema 与行为语义（官方工具行为丰富：读窗口、乐观锁、CRLF、后台任务、溢出……），复刻质量不足反而伤模型。
- **B. 独立 ssh_* 工具集**：schema 自由、渐进交付、行为透明（systemPrompt 说明即可），模型可见附加工具。

推荐 **B 起步、预留 A**：第一阶段交付完整 ssh_* 工具集 + 配置管理（用户核心诉求"配置好服务器后所有会话可读可用"完全满足）；同名遮蔽作为后续增强路线（每个工具成熟一个切换一个）。

---

## 4. ssh2 传输与构建（照抄 + 硬化）

- **依赖**：ssh2 为 devDependency，esbuild bundle 时内联（`external: ['@deepseek-ai/*']`，stub `cpu-features`/`sshcrypto.node`）；构建后检查产物 import 禁止 ssh2 出现。link 安装不装 link 目标的依赖——内联是唯一路径。
- **版本治理**：ssh2 处于维护模式，package.json 固定精确版本 + README 记录安全审计节奏。
- **错误事件纪律**（对方血训）：ssh2 认证候选迭代会发多个 error 事件，`once('error')` 会让第二个错误进程级崩溃——连接/SFTP/测试连接一律常驻 `on('error')`。
- **Cordis traceable 阴影接收器**：provider 类可变状态禁用 `#private` 字段（brand 检查失败），用普通共享对象属性。
- 移植修复：sftp() 通道打开加单飞（对方并发双开泄漏）；端口 0 `||`→`??`（静默回落 22）；auth.type 非法值显式报错。

---

## 5. 移植时必须修复的已知缺陷（审计发现汇总）

**Major**：
1. store 写链无 catch——一次磁盘故障永久破坏后续所有持久化 → 自愈写链。
2. state.json 损坏 → 插件加载失败 → 本机 G3 隔离全局插件 → 损坏隔离 + 备份 + 空状态重建。
3. upsert 合并在 host 变更时继承陈旧指纹 → host/port 变更时清指纹重走 TOFU。
4. pre-step 权威门无回退——SSH 不可达时 session 卡死 → 门失败降级策略（提示 + 可继续，不阻塞）。
5. sftp() 无单飞 → 并发双开通道泄漏。
6. `signalForeground` 的 `this` 断链（L440-447）；abort 竞态窗口远端进程泄漏（L312）；`spec.stdio.stdout` 缺 `?.`（L290）。

**Minor**：abort listener 累积；终端 shell 硬编码 `/bin/bash`（应用探测 `$SHELL`）；client `useRuntimeState` 死代码；`window.confirm`/`document.head` 注入/`:has()` CSS 覆盖改 Cordis 等价物。

**存储位置**：对方写 `<cwd>/.dsh-remote-ssh/state.json`（进程 cwd 不稳定）；自研挂 `DSH_HOME`（`C:\Users\Administrator\.dsh`）下固定目录。

---

## 6. 本机落地要点（自研设计输入）

- **插件名**：`dsh-server-ssh`（dsh-<role> 规范，role = server-ssh）。
- **Host 面**：store + connection-manager + RPC（channel `/api` 下自有 endpoint 前缀，参照 dsh-deepseek-balance 的 `/api/dsh/...` 先例）+ agent 事件编排 + scoped 工具注册 + scoped systemPrompt。
- **Client 面**：ModuleLoader 壳（本机先例格式）+ `inject:['slots']`；目标选择器挂输入框旁 Slot（本机 Slot 名以动态 Inspect 或现有插件为准）；管理/编辑 Modal + 连接引导 + 错误状态卡。
- **流程**：`node new-plugin.mjs dsh-server-ssh` 脚手架 → 开发 → `node validate-plugins.mjs` 绿 → link 安装 → request_restart → 验证。
- **Slot 名待验**：开发 client 前用 cordis_inspect_list/query 确认输入框旁 Slot 与会话头工具行的准确名称。

---

*审核子代理原始报告已并入本文件；源码快照保留于 `research/remote-ssh-ref/` 供开发期对照。*
