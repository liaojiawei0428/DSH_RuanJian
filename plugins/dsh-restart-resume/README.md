# dsh-restart-resume

AI 重启 DSH 服务后**自动续聊**：重启完成时自动以用户身份向原会话发送继续消息，任务全程无人值守。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## AI 标准操作流程（SOP）— 每个会话照此执行

### 何时调用

- 安装/更新插件、修改 cordis 配置或 profile、版本更新等**需要重启 DSH 服务**才能生效的场景。
- **不要**用于：服务未运行时的首次启动（直接跑 `start-dsh-web.ps1`）、非 DSH 进程的管理。

### 调用规范

```
request_restart({ message: "<重启完成后给本会话的继续指令>" })
```

- `message` 要写清**重启原因与接下来要做的事**（如「插件 X 已安装。请继续验证其闸门并汇报」），续聊后据此无缝接续。省略则用默认文案。

### 调用后铁律（违反会导致续聊丢失或半途截断）

1. **立即结束当前回复**——服务将在数秒内停止，宿主进程随之死亡；
2. **不要再调用任何工具**、不要再生成多余内容；
3. 等待自动续聊：服务重启完成后，本会话会**自动收到一条用户侧继续消息**，从那里继续任务即可。

### 续聊到达后的确认动作

- 顺带确认三点：标记已删（`~/.dsh/restart-resume.json` 不存在）、`dsh-switch.log` 有本次启动记录、服务就绪（3 秒左右）。

### 失败排查路径（按序）

1. `E:\DSH\DSH-ops\dsh-switch.log` — 重启脚本走到哪一步（强制停止/启动尝试/失败原因）；
2. `~/.dsh/restart-resume.json` 是否还在 — 在 = 新服务未消费（看服务是否真的重启了）；被删 = 已消费或已过期丢弃；
3. `E:\DSH\DSH-ops\dsh-web.err.log` — 新进程启动失败时 node 的 stderr；
4. buglog 检索关键词：`restart-resume`、`detached`、`Job`、`WMI`（本插件历史坑全部有记录，见文末清单）。

## 工作原理（WMI 两级链，2026-08-31 定稿）

```
[旧进程]                                        [新进程 boot]
request_restart 工具
  ├─ exec.agent.id → 会话 id（Agent 对象，非字符串）
  ├─ 写标记 ~/.dsh/restart-resume.json（先于一切 spawn 写盘）
  └─ spawn 短命中继 pwsh（宿主子进程，只活到 WMI 调用返回）
       └─ Invoke-CimMethod Win32_Process.Create
            └─ 执行者 pwsh（父=WmiPrvSE，不在宿主 Job 内）
                 ├─ start-dsh-web.ps1 -Restart → 杀宿主
                 │    （宿主 Job close 只连带已退出的中继，波及不到执行者）
                 └─ 拉起新服务 → apply 里 consumeMarker：
                      sessionController.prompt({ requestId, sessionId,
                        mode:'queue', content:[{type:'text',…}] })
                      成功 → 删标记 → 会话收到继续消息
```

与浏览器输入框发送走**完全相同的官方路径**（显式 resume 冷会话、队列入箱、会话日志、投影、UI 一致）；用户可以关着页面，注入是宿主内动作。

## 为什么必须是 WMI 两级链（历史坑，勿回退）

| 方案 | 结局 | buglog 记录 |
| --- | --- | --- |
| `detached: true` 直接 spawn | pwsh 7.6 在 DETACHED_PROCESS（无控制台）下**启动即静默退出**（exit 0），一行日志不写 | `2026-08-31-pwsh-detached-process-exits-silently.md` |
| 非 detached 直接 spawn | 执行者成功**杀掉宿主后**，被宿主的 Job Object（KILL_ON_JOB_CLOSE）**连带终止**，重启中断、服务停机 | `2026-08-31-host-job-kills-children-use-wmi-relay.md` |
| **WMI 两级链（现行）** | 中继只活几百毫秒；执行者父进程是 WmiPrvSE，不在宿主 Job 内，宿主死亡波及不到 | — |

插件启动失败的 inject 教训见 `2026-08-31-restart-resume-ctx-tools-without-inject.md`（`ctx.tools` 必须声明 `inject: ['tools','sessionController']`）与 `2026-08-31-restart-resume-missing-tools-inject.md`。

## 鲁棒性设计

- **服务未就绪窗口**：boot 早期 llm/session 依赖可能晚于本插件，prompt 失败按 2.5s 间隔重试，预算 10 分钟。
- **永久失败**：目标会话不存在（`session/not-found`）→ 删标记 + error 日志，不无限重试。
- **陈旧标记**：标记有效期 30 分钟，过期丢弃；重试超预算则保留标记，供下次启动消费（自然重试）。
- **启动失败**：relay 的 exit code 即 WMI `Win32_Process.Create` 的 ReturnValue（0=成功，2=拒绝访问，9=路径未找到），非 0 时工具报错；标记已写盘，之后任何一次成功重启都会自动消费。中继 15 秒未退出按失败处理。
- **pwsh 解析**：`DSH_PWSH_PATH` → `PATH` → Program Files（与 dsh-deepseek-balance 同一套逻辑）。
- **可观测性**：`ctx.logger` 无 exporter 时静默丢弃（Cordis 行为），排障以 `dsh-switch.log` 与标记文件状态为准，不要依赖插件日志。

## 配置（cordis.yml 行内 config 可覆盖）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `markerPath` | `$DSH_HOME`（缺省 `~/.dsh`）`/restart-resume.json` | 续聊标记文件路径 |
| `restartScript` | `<DSH-ops>/start-dsh-web.ps1` | 重启脚本（自动带 `-Restart`） |
| `resumeMessage` | 「DSH 服务已自动重启完成……请从中断处继续」 | 默认继续消息 |

## 开发循环

1. 编辑 `index.js`（host-only，无 client 半边）；遵守准则 P1–P10
2. 随时验证：`node E:\DSH\DSH-ops\validate-plugins.mjs` —— 必须全绿才能进入安装
3. 改动后用一次真实 `request_restart` 端到端验证（闸门绿 ≠ 运行时 OK）

## 安装

经 `dsh-personal-hub` 统一安装：`personal-hub/personal.json` 清单已含本插件，`personal_hub_reapply` 一键完成 dependencies + bundles + pnpm install，重启服务生效。

## 已知边界

- `sessionController` 为官方内部服务名（`packages/api/session-controller`，namespace `session`）。官方若改名，插件会在启动闸门/续聊时报错（fail loud），届时同步改名即可。
- 在子代理会话中调用会把继续消息发给该子代理会话；仅在主任务会话使用。
- 2026-08-12:48 曾出现一次执行者秒死（无日志无残骸），疑与环境残留进程竞速有关；WMI 链路重放多次全部成功，如复现优先查当时是否同时存在其他 `start-dsh-web.ps1` 调用（脚本单实例保护按命令行字样匹配：含 `start-dsh-web.ps1` + `-File` 且不含 `-Command` 即互斥）。
- 本插件只编排"重启+续聊"；重启本身的闸门、日志、浏览器打开等行为全部由既有 `start-dsh-web.ps1` 承担。
