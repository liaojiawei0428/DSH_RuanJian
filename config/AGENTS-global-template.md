# DSH 环境运行规则（用户全局）— 部署模板

> **部署方法**：把本文件复制为新机的 `%USERPROFILE%\.dsh\AGENTS.md`，再把其中
> `<盘符>` 全部替换为实际盘符。该文件会被 DSH 指令加载器注入**所有会话**
> （任何 profile、任何项目工作目录），是本机 AI 协作的统一运行规则底座。
> **同步规则**：本模板改动后，须同步更新各已部署机器的 `%USERPROFILE%\.dsh\AGENTS.md`；
> 完整规范唯一权威版本：DSH-ops 仓库的 `PLUGIN-STANDARD.md`。

**语言**：始终使用简体中文思考与回复，除非用户明确要求其他语言。

本文件由 DSH 指令加载器对**所有会话**注入，无论会话工作目录在哪个项目。项目级 AGENTS.md 只补充项目细节，不得覆盖本节硬规则。

## 工具分工（D7 纪律，硬规则）

- **默认用 python**：一切计算、数据处理、日志/文本文件读写、JSON/CSV 解析、多步逻辑、DSH 状态检查。
- **pwsh 仅限白名单**：Windows 系统对象（服务/进程/端口/WMI/注册表）、git/pnpm/node 等进程编排、运行 .ps1 脚本。
- 反例（必须用 python 而非 pwsh）：读日志（Get-Content）、改 JSON 配置（ConvertFrom-Json）、文本搜索（Select-String）、端口/文件轮询循环。
- pwsh 必须为 7.x（5.1 禁用）：**永远不要硬编码 pwsh 路径**，用定位链（Get-Command 优先、常见安装位置回退）；非标准安装位时设 `DSH_PWSH_PATH` 或加入 PATH。

## DSH 服务纪律（硬规则）

- DSH 状态检查统一入口：`python <盘符>:\DSH\DSH-ops\health-check.py`（全绿退出 0；发现服务/看门狗异常时自动复活后复查）。
- 服务重启只能走标准重启链（request_restart → start-dsh-web.ps1，经 WMI 独立进程）；禁止另起服务器替代本 GUI 服务。
- 改动自研插件落盘前必须先过闸门 `<盘符>:\DSH\DSH-ops\validate-plugins.mjs`：任何插件（无论好坏）都不得妨碍 DSH 正常启动运行。
- 修复任何 bug 后必须 `bug_report` 记录；调查任何异常前先 `bug_search` 查既有记录。

## 本机环境事实（按新机实际情况修改本节）

- DSH 工作区：`<盘符>:\DSH`（ops 工具链 + 自研插件）；harness 源码 checkout：`<盘符>:\DSH\Deepseek_DSH`。
- Web GUI：`http://127.0.0.1:3080`；DSH_HOME：`%USERPROFILE%\.dsh`。
- 看门狗 G5 常驻守护服务（30 秒心跳 + 黑匣子 + 自动复活）；体检与看门狗结论冲突时以体检输出为准。
