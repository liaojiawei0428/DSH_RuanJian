# DSH 插件开发与改动行为准则

本准则是 DSH 相关插件开发与系统改动的唯一权威规范。**每次开发新插件、修改既有插件、改动 profile 或启动链，必须完整执行本准则**，不允许任何插件问题导致 DSH 无法正常运行或启动，并确保出现问题的插件随时可以修复或摘除。

底线（违反任何一条即视为事故）：

1. **坏插件不得阻断 DSH 启动**——三层防线保证：预检闸门在重启前拦截（G1–G2）；漏网坏插件导致启动失败时启动链**自动隔离肇事插件并重试**（G3）；紧急情况可一键摘除（R4）。任何情况下 DSH 必须能正常启动运行。
2. **旧服务器不受更新过程影响**——所有检查通过之前，不得杀死正在运行的服务器。
3. **用户数据零损坏**——凭据、设置、profile 修改前必须备份，写入必须整体原子替换。

## 规则来源（每条规则对应一次真实事故）

| 事故 | 根因 | 形成的规则 |
|---|---|---|
| 2026-08-17 npm 撞名 | `dsh plugin add` 从 npm 装到同名旧版悬浮胶囊插件 | P1：自研插件 `private: true` 永不发布 npm，一律 link 安装 |
| 2026-08-18 凭据文件损坏 | `Set-Content -NoNewline` 把行数组无分隔拼接成非法 YAML，凭据插件 fail-loud，进程起不来 | D4：用户数据文件整体原子重写，禁止行级拼接 |
| 2026-08-18 BOM 乱码 | 编辑工具剥掉 .ps1 的 UTF-8 BOM，PowerShell 5.1 按 GBK 解析中文导致语法错误 | D5：.ps1 恒为 UTF-8 带 BOM；启动链恒用 pwsh 7 |
| 2026-08-18 13:05 启动阻断 | 插件 output schema 把 `required: true` 写进属性内部，违反核心 JSON Schema 方言，`assertSupportedJsonSchema` 抛错，插件树加载失败 | P4 + 预检闸门：注册路径必须在重启前经过真实核心校验器执行 |
| 2026-08-31 inject 漏声明 | `ctx.tools` 未在 `inject` 声明，真实 loader 抛 `cannot get property "tools" without inject` 拒绝启动；闸门 mock 无守卫放行（stub 绿、运行时红） | G1：闸门用 Proxy 复刻 inject 守卫，报错与运行时逐字一致 |
| 2026-08-31 演练半安装 | 演练插件 link 进 profile 但未 `pnpm install` 即重启，`resolveBundleDir` 失败停机；闸门不验 install 状态照样全绿，兜底定位器不认识 resolve 失败格式 | G2：闸门增查 node_modules 符号链接；G3：定位器补第三模式并在失败时输出 err.log 原文；G4：演练必须完整走 S3 |
| 2026-08-31 演练残留三连 | 演练插件手写骨架漏 `dsh.bundle` 声明，boot 在 loadProfile fail-loud（`declares no dsh.bundle`）3 次全灭停机；闸门不查声明、兜底不识该格式 | G1 第 6 项：dsh.bundle 声明与补丁在盘；G3：定位器补第四格式；G4：演练插件 manifest 必须完整 |
| 2026-08-31 端口后延迟崩溃 | bad4（setImmediate 异步崩）闸门八项全绿、端口曾就绪，启动器判成功退出后服务静默死亡，G3 从未触发——"3 次失败"前提不成立 | G3：就绪后 2 秒存活复核（崩溃计入失败）；G1 第 8 项：演练保留区名直接拒绝（DSH_DRILL=1 显式旁路）；新增 G5 运行期看门狗 |
| 2026-08-31 看门狗 pwsh 路径 | 看门狗与 WMI 拉起把 pwsh 写死为 `C:\Program Files\PowerShell\7`，本机装在 `E:\GongJu\7` → ReturnValue 9 恒失败，服务死亡无人接管 | 两脚本加 `Resolve-PwshPath`（DSH_PWSH_PATH → PATH → Program Files，与 restart-resume 同一定位链）；新脚本引用 pwsh 一律用定位链，禁止写死 |

## 第一部分：插件开发规范（P1–P10）

**P1 结构与发布**
- 目录名 = 包名，形如 `dsh-<role>`（如 `dsh-tool-python`）。
- `package.json` 必备：`"private": true`、`"type": "module"`、`main`、`exports`（含 `./cordis.patch.yml`）、`dsh.bundle.patch` 指向补丁文件。
- **永不发布到 npm 注册表**；部署一律 `link:` 本地路径。npm 上存在同名包时，`dsh plugin add` 会装错版本——这是既成事故。
- 入口导出 `name`、`inject`、`apply`。

**P2 零 workspace 依赖**
- 不得 `import` 任何 `@deepseek-ai/*` 包。link 安装没有自己的 node_modules，这类 import 会让服务器加载即崩。
- 只允许 `node:` 内置模块与注入服务。需要核心校验器等能力时，在插件外解决（闸门脚本负责），不进插件。

**P3 注入最小化**
- `inject` 只列硬依赖（缺它插件行应等待而非崩溃）。
- 可选服务一律 `ctx.get('name')` 读取并处理 `undefined`，绝不写进 `inject`。每多一个硬注入，就多一种"行未激活"的启动期失败模式。

**P4 schema 方言（13:05 事故的直接规则）**
- `required` 必须是**父对象上的字符串数组**：`required: ['kind', 'exitCode']`。
- 属性定义内部**禁止**出现 `required: true`；`string`/`boolean`/`number` 类型属性内禁止 `required`；`required` 不得与 `oneOf` 并列。
- 对象节点声明 `additionalProperties: false`；字面量用 `const`。
- 工具 `parameters` 用 `defineTool` 属性式写法时（注册表会提升为必填列表）不受此限，但**裸 `ctx.tools.register` 的 parameters 必须已是本方言**。
- 写完必须过闸门（真实核心校验器），不靠肉眼。

**P5 注册即效果**
- 一切注册（tools、路由、系统提示段、事件、定时器）必须包在 `ctx.effect(() => disposer)` 中，保证插件摘除/禁用时全部副作用可回收。

**P6 失败边界**
- 配置错误在 `apply()` 期间 fail-loud 抛错（闸门会在重启前捕获，旧服务器不受影响）。
- 执行期错误转为**工具错误结果**返回给模型，绝不抛出到进程级。

**P7 编码与输出**
- 子进程执行强制 UTF-8（如 `PYTHONUTF8=1`、PowerShell `[Console]::OutputEncoding` 前导），杜绝 OEM 代码页乱码。
- PowerShell 脚本与含中文的文件：UTF-8 带 BOM。

**P8 资源清理**
- 每次调用创建的临时文件/目录在 `finally` 中尽力清理；清理失败不报错。

**P9 平面归属**
- 只消费 host 服务的插件行松放、无 realm。
- 发布服务的行必须在挂载组合中置于 `isolate` realm（服务名冲突会让第二次挂载即崩）。

**P10 文档**
- 每个插件必有 README：工作方式、配置字段表、安装三步、验证方法、已知边界。骨架由脚手架生成，不得删除章节。

**P11 BUG 记录纪律（由 dsh-bug-log 插件执行）**
- 修复任何 BUG 后、继续下一步前，**必须**调用 `bug_report`（症状/根因/修复/组件/严重度/状态）——未记录视为任务未完成。
- 排查任何异常、错误、意外行为前，**先**调用 `bug_search`——历史记录通常已含根因与修复。
- 需要汇总时用 `bug_stats`（按组件/严重度/月份/状态聚合）。
- 绕过未根治的修复记 `status: workaround`，持续关注直到转 fixed。
- 记录落 `buglog/`（git 版本化、双机同步）；兜底启发式会在漏记的下一个会话提醒补录。

## 第二部分：新插件开发流程（S1–S5）

```
S1  node <盘符>:/DSH/DSH-ops/new-plugin.mjs dsh-<role>
    —— 脚手架产出合规骨架（结构、insert 方言补丁、README）

S2  开发 index.js，遵守 P1–P10
    —— 随时验证：node <盘符>:/DSH/DSH-ops/validate-plugins.mjs
    —— 全绿才能进入安装；红就修，不许带病安装

S3  安装三步（写入 profile）：
    1. profile package.json dependencies 加 "dsh-<role>": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-<role>"
    2. dsh.profile.bundles 数组追加 "dsh-<role>"
    3. profile 目录 pnpm install

S4  重启服务（restart-dsh-web.ps1 / update-dsh.ps1 / start-dsh-web.ps1）
    —— 三个脚本均已内置预检闸门：插件不过闸 → 重启中止，旧服务器原样运行

S5  验证：
    —— dump-config 出现插件行
    —— 新会话确认行为与工具列表
```

## 第三部分：修复流程（R1–R4）

```
R1  定位：看 C:/Users/<u>/.dsh/restart-dsh-web.log 与 dsh-web-stderr.log
    —— 闸门输出（plugins: 行）与服务器崩溃栈都在这里

R2  复现：node <盘符>:/DSH/DSH-ops/validate-plugins.mjs
    —— FAIL 行给出插件名与精确原因（与生产校验器同一实现，错误逐字一致）

R3  修复 → 闸门全绿 → 重启

R4  紧急逃生（插件一时修不好，DSH 必须立即可用）：
    node <盘符>:/DSH/DSH-ops/disable-plugin.mjs dsh-<role>
    —— 只从 dsh.profile.bundles 移除该插件；文件与 link 原样保留
    —— 重启后 DSH 干净启动；修复后把名字加回 bundles 数组即恢复
```

## 第三点五部分：闸门与启动保险（G1–G4）

底线 1 的机制化。闸门是**唯一权威的准入检查**——所有自研插件无论好坏，都必须先过它；启动保险兜住闸门拦不住的残余风险。

**G1 闸门检查范围**（`node validate-plugins.mjs`，一条命令八项全查）：

1. 模块可导入（`import` 真实执行入口文件）且导出 `apply()` 函数；
2. `apply()` 同步执行一遍（真实 `ctx.effect`/`ctx.on` + **Proxy 复刻的 inject 守卫**——访问未在 `inject` 声明的服务会报与 Cordis 运行时逐字一致的 `cannot get property ... without inject`；框架内置 `get`/`effect`/`on`/`logger` 免声明）；
3. 工具 output schema 用**真实核心** `assertSupportedJsonSchema` 校验方言；
4. client 入口 `node --check` 语法解析；
5. manifest 声明的 exports 文件在磁盘存在；
6. **`dsh.bundle.patch` 声明与补丁文件在盘**——生产 boot 的 loadProfile 对缺失声明 fail-loud（`declares no dsh.bundle`）且 `loadOverlayPatches` 读不到补丁文件即崩（2026-08-31 演练残留事故：闸门曾 8/8 全绿放行、服务停机）；
7. **安装状态**（G2）；
8. **演练名称保留区**（G4）：名字命中 `dsh-gate-demo-*` / `gate-demo-*` 的 link 直接拒绝——演练插件按纪律不得留在 bundles（2026-08-31 bad2/bad3/bad4 三次残留三次停机）。显式设置环境变量 `DSH_DRILL=1` 时放行并打印 WARN——启动链的任何自动路径都不设该变量，演练只能由人/受监督的会话主动开启。

闸门只校验 `dsh.profile.bundles` 内的 link 插件；被 `disable-plugin.mjs` 摘除（不在 bundles）的插件输出 `SKIP` 行——它不会加载，不必也不应拦住闸门，自动隔离的重试轮正依赖这一点转绿。

**G2 安装状态检查**：profile `node_modules/<插件名>` 符号链接必须存在——link 只写进 `dependencies`+`bundles` 而**没跑 `pnpm install`** 的"半安装"插件，真实服务经 node_modules 解析必然 `cannot resolve profile bundle` 失败（2026-08-31 演练事故：闸门曾全绿放行、服务停机）。闸门直接读 `link.dir` 文件，永远看不出缺 symlink，所以此项必须单查。FAIL 文案自带修复命令（profile 目录 `pnpm install`）。该检查仅在 profile 已有 `node_modules` 目录时启用（全新/临时 profile 无法判定）。

**G3 启动自动隔离兜底**（`start-dsh-web.ps1` 内置）：闸门拦不住运行期才炸的插件（如 `setImmediate` 异步抛错——闸门只执行同步注册路径）。若 3 次启动尝试全灭：

1. 从 `dsh-web.err.log` 尾部定位肇事插件（四种格式：`failed to apply loader entry X (dsh-xxx)`；`cannot resolve profile bundle`；`profile bundle "dsh-xxx" declares no dsh.bundle`；异常栈中的 `plugins/dsh-xxx/` 路径）；
2. 定位到 → 自动 `disable-plugin.mjs` 摘出 bundles（文件与 link 保留）→ **自动重试一轮**（只隔离一次，防误判连环摘）；
3. 定位不到 → 输出 err.log 最后几行原文，转人工。

每次尝试端口就绪后还有**存活复核**：睡 2 秒复查监听仍在——`setImmediate` 类异步崩溃发生在端口绑定**之后**，若按"端口在听"判成功，坏插件逃过 G3、服务随后静默死亡（2026-08-31 bad4 事故）。复核失败的尝试计入失败，三次后照常走兜底。

闸门在启动链中的位置：单实例检查之后、`-Restart` 停止动作**之前**——闸门红 = 直接中止，旧服务零影响（闸门若排在停止之后，坏插件会先杀服务再中止，变成停机）。

**G4 演练纪律**（故障注入演练 = 主动制造坏插件验证防线）：

- 演练必须**完整走 S3**：link + bundles + `pnpm install` 三步一个不少（半安装事故的直接教训）；
- 演练插件必须用**保留区命名**（`dsh-gate-demo-*` / `gate-demo-*`）——闸门对保留区名字直接拒绝（G1 第 8 项），演练残留不可能留在 bundles 里造成停机（2026-08-31 bad2/bad3/bad4 三次残留三次停机的根治）；演练结束后**必须**删除插件目录并清理 profile。演练**进行中**用 `$env:DSH_DRILL='1'` 显式放行闸门保留区检查——只在该会话设置，启动链任何自动路径（含看门狗拉起）都不携带，`Ensure-Watchdog` 还会主动清除以防泄漏；
- 演练插件的 manifest 必须**完整**（含 `dsh.bundle.patch` 声明与补丁文件在盘）——手写最小骨架漏字段会让演练死在 boot 的 loadProfile 而不是目标防线（2026-08-31 gate-demo-bad3 事故）；拿不准就 `new-plugin.mjs` 脚手架起步再注入缺陷；
- 演练结束立即清理：删插件目录 + 摘 link（依赖项），并确认闸门恢复全绿；
- 演练用 `-Restart` 真实执行才有验证价值，但必须预期停机窗口（3×30 秒轮询 + 兜底重试）；
- 每次演练暴露的防线缺口（如本次的 inject 守卫、install 检查）修复后必须回归 `test-standard.mjs` 并落 buglog。

**G5 运行期看门狗**（`watchdog-dsh.ps1`，第四层防线）：启动器的存活复核只覆盖启动后 2 秒，坏插件可能在**任意延迟**后才崩（首次调用某工具、定时器、内存耗尽）——届时启动器早已退出、G3 无从触发。看门狗接管运行期：

- 启动器每个**成功路径**（含"已在运行"）调 `Ensure-Watchdog` 拉起独立看门狗（WMI 独立进程，不受 Job 对象管辖；自带单实例保护）；
- 每 30 秒查 3080 端口，**连续 2 个周期无监听**才认定死亡（60 秒去抖，滤掉 `-Restart` 的正常端口空窗）；
- 死亡确认 → 与 G3 同款定位器找肇事插件 → 定位到则自动 `disable-plugin.mjs` 隔离 → WMI 拉起完整启动链（幂等语义直接启动），本实例退出让位（新启动器拉起新看门狗）；
- **防循环护栏**：拉起记录保留 1 小时窗口，窗口内已拉起 3 次仍不稳定 → 停止自动恢复、转人工（防"拉起又崩"无限重启机）；
- pwsh 路径一律 `Resolve-PwshPath` 定位链（`DSH_PWSH_PATH` → PATH → Program Files），**禁止写死**（2026-08-31 写死 `C:\Program Files\PowerShell\7` 事故：本机装在 `E:\GongJu\7`，WMI ReturnValue 9 恒失败，看门狗从未上岗）。

## 第四部分：DSH 改动规范（D1–D6）

**D1 profile 改动**：改完立即 `--dump-config` 验证组合树 + 跑闸门；两绿才算改完。

**D2 启动链改动**：改任何 `.ps1`/`.bat` 后——语法检查通过 + UTF-8 BOM 在位 + `powershell.exe` 引用为零（恒用 pwsh 7）。三个检查一个都不能省。

**D3 主仓库更新**：一律走 `update-dsh.ps1`（内置：工作区干净检查 → 凭据结构校验 → 配置备份 → ff-only 拉取 → frozen-lockfile 安装 → CLI 冒烟 → 构建 → dump-config 组合预检 → 插件闸门 → 重启 → HTTP 健康检查）。不得手工跳步。

**D4 用户数据文件**（credentials/settings/profile package.json）：改前备份到 `~/.dsh/backups/<时间戳>/`；写入必须**整体原子替换**（读 → 改 → 序列化全文 → 写），**禁止行级拼接**（`Set-Content -NoNewline` 数组拼接是既成事故）。

**D5 编码纪律**：`.ps1` 恒 UTF-8 带 BOM；编辑工具会剥 BOM，改完必须补回。

**D6 提交纪律**：DSH-ops 的改动审阅后入库；备份目录含密钥，**永不入库**。

**D7 工具分工纪律**：AI 默认用 `python` 工具——计算、数据处理、日志与文本读写、JSON、多步逻辑、演练脚本；PowerShell 仅限白名单场景——Windows 系统对象（服务/进程/端口/WMI/注册表）、`git`/`pnpm`/`node` 进程编排、执行 `.ps1` 脚本本身。判据：操作对象是**数据**用 python，是**系统对象或外部进程**用 pwsh。依据（2026-08-31 实测）：pwsh 有结构性风险（`-Command` 不传播原生命令退出码、OEM 编码坑、隐式格式化截列、三套引号转义），python 显式哲学 + 训练语料优势正确率更高；高频体检操作已沉淀为 `health-check.py`，"查状态"类任务默认 python 一发完成。

## 工具索引

| 工具 | 作用 |
|---|---|
| `new-plugin.mjs` | 脚手架：产出合规骨架，从源头保证结构正确 |
| `validate-plugins.mjs` | 预检闸门：八项检查（G1/G2）——注册路径真实执行（含 inject 守卫）、schema 方言、client 语法、exports 在盘、dsh.bundle 声明与补丁在盘、安装状态、演练保留区 |
| `disable-plugin.mjs` | 紧急摘除（R4）+ 自动隔离（G3）共用：把坏插件移出加载列表，文件与 link 保留 |
| `test-standard.mjs` | 验收测试：T1–T4 证明脚手架合规、闸门拦截力、逃生通道可用 |
| `update-dsh.ps1` | 主仓库更新：全链路守卫（D3） |
| `start-dsh-web.ps1` / `restart-dsh-web.ps1` | 启动/重启：先过闸门再动手；三次失败自动隔离肇事插件并重试一轮（G3） |
| `watchdog-dsh.ps1` | 运行期看门狗（G5）：30s×2 去抖 → err.log 定位 → 隔离 → WMI 拉起；带心跳文件与 finally 黑匣子（死亡现场判据） |
| `health-check.py` | 一键体检（D7 默认入口）：服务/看门狗/日志/bundles/闸门/回归；看门狗不在岗自动 WMI 复活 |

**闸门自身故障的排查**：闸门从 `DSH_TOOLS_LIB`（默认主仓库构建产物 `packages/core/tools/lib/index.js`）导入真实校验器，导入失败时闸门整体报错、按 fail-closed 中止重启。主仓库重构导致该路径变动时，设置环境变量 `DSH_TOOLS_LIB` 指向新位置即可，无需改插件或放行。

## 提交前检查清单（复制执行）

```
[ ] node <盘符>:/DSH/DSH-ops/validate-plugins.mjs  全绿
[ ] dump-config 组合树含新插件行
[ ] README 五节齐全（工作方式/配置/安装/验证/已知边界）
[ ] package.json: private + type:module + exports + dsh.bundle.patch
[ ] index.js: 零 @deepseek-ai/* import；inject 最小；注册全包 ctx.effect
[ ] schema: required 全在父对象数组；属性内无 required；oneOf 旁无 required
[ ] .ps1 若有改动：语法 OK + BOM 在位 + 无 powershell.exe
[ ] 用户数据文件：已备份；整体原子写入
[ ] 若做过演练：插件目录已删、link 已摘、闸门恢复全绿（G4）
```

---

本准则由 DSH-ops 维护。修订时同步更新脚手架模板与检查清单，保持三者一致。
