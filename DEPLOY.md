# 新电脑部署指南（DEPLOY.md）

在另一台电脑上完整复刻当前 DSH 环境。照此清单执行即可得到与开发机一致的环境：
同一 DSH 版本、同一插件集、同一 BUG 知识库、同一套准则与工具链、同一套运维脚本。

> 兼容目标：Windows + PowerShell 7 + Node 24 + Python 3.12。
> 本指南于 2026-08-18 在 `E:\DSH` 完整模拟验证通过（模拟 + 清理 + 回归）。

---

## ⚠️ 最重要的前提：相对路径约定（盘符自由）

**所有运维脚本、插件、更新链路都按"同级目录结构"自动推导路径**——不依赖固定盘符。
部署时只需保证两个仓库**在同一父目录下**（任意盘符均可）：

| 路径 | 内容 |
|---|---|
| `<盘符>:\DSH\Deepseek_DSH` | 官方 DSH 源码仓库 |
| `<盘符>:\DSH\DSH-ops` | 本仓库（插件/脚本/标准/知识库） |
| `%USERPROFILE%\.dsh` | DSH 用户数据（DSH_HOME，每机独立） |

**规则：两仓库必须同父目录、同名**（`Deepseek_DSH` 与 `DSH-ops` 并列）。例如：

- 开发机：`D:\DSH\Deepseek_DSH` + `D:\DSH\DSH-ops`
- 另一台电脑：`E:\DSH\Deepseek_DSH` + `E:\DSH\DSH-ops`（盘符随意，父目录名也可随意）

脚本从自身位置推导仓库路径（`$PSScriptRoot`/`%~dp0`/`import.meta.url`），
**只要结构成立，任何盘符都能零修改工作**。

唯一需要写入具体路径的地方：profile 的 `link:` 依赖（见第 3 步）。启动/更新/插件等其余全部自定位，无外部环境变量约定。

---

## 第 0 步：环境准备（新机手工）

| 依赖 | 要求 | 验证命令 |
|---|---|---|
| Git | 任意较新版本 | `git --version` |
| Node.js | ^22.19 或 >=24（仓库 engines 要求） | `node --version` |
| pnpm | 任意（corepack 或 `npm i -g pnpm`） | `pnpm --version` |
| PowerShell 7 | >= 7（**5.1 不可用**，见 BOM/GBK 事故）。标准位置安装（msi/winget）或 PATH 可用即零配置；便携/自定义安装位置见文末"已知差异" | `pwsh --version` |
| Python 3 | >= 3.10（dsh-tool-python 需要） | `python --version` |
| VS C++ 工具链 | **0.1.3-alpha.1 起必需**：官方新增原生依赖 fs-ext（session 写锁）在 `pnpm install` 时经 node-gyp 现场编译，Windows 需 MSVC。装免费 Build Tools 即可：`winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`（见 buglog `fs-ext-msvc-blocks-update`） | `& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` |
| 网络通道 | 能访问 GitHub 的通道：**系统代理模式 或 TUN/虚拟网卡模式（直连）均可**。脚本自动判定：系统代理启用（ProxyEnable=1）则用代理；否则探测 github.com 直连，TUN 模式直连可达即按直连继续 | 控制面板 → Internet 选项 → 代理；或 VPN 的 TUN 虚拟网卡开关 |

---

## 第 1 步：拉取两个仓库

> 选一个父目录（本文以 `<盘符>:\DSH` 为例，实际任意盘符/目录名均可），
> 两个仓库必须并列放在该目录下：

```powershell
# 官方仓库（clone 默认分支即官方最新，无需指定版本；VPN 需先开）
git clone https://github.com/deepseek-ai/deepseek-harness.git <盘符>:\DSH\Deepseek_DSH

# DSH-ops 仓库
git clone https://github.com/liaojiawei0428/dsh-ops.git <盘符>:\DSH\DSH-ops
```

> **不指定版本**：克隆得到的即为官方最新，与后续 `更新DSH.bat` 的升级路径一致。
> 本指南只在官方变更影响部署步骤时（如凭据格式、目录结构）才更新；常规版本
> 迭代不修改本指南。如确需复刻特定历史版本（非常规操作），以版本台账
> [version-history.md](version-history.md) 为准 checkout 对应 tag 即可。

---

## 第 2 步：构建 DSH 主程序

```powershell
cd <盘符>:\DSH\Deepseek_DSH
pnpm install --frozen-lockfile
pnpm run build
node apps\cli\lib\bin.js --version   # 应输出 0.1.x-rc.x（与克隆时的官方最新一致，不写死）
```

---

## 第 3 步：生成 web profile

创建目录 `%USERPROFILE%\.dsh\profiles\web\`，写入两个文件。

**`package.json`**（`<盘符>` 换成你实际选择的盘符）：

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-bug-log": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-bug-log",
    "dsh-deepseek-balance": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-deepseek-balance",
    "dsh-locale-language": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-locale-language",
    "dsh-personal-hub": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-personal-hub",
    "dsh-plugin-guide": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-plugin-guide",
    "dsh-restart-resume": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-restart-resume",
    "dsh-tool-python": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-tool-python"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-locale-language",
        "dsh-deepseek-balance",
        "dsh-tool-python",
        "dsh-bug-log",
        "dsh-personal-hub",
        "dsh-plugin-guide",
        "dsh-restart-resume"
      ]
    }
  }
}
```

**`cordis.patch.yml`**（`<用户名>` 换成新机 Windows 用户名）：

```yaml
# pwsh-sandbox: pin to PowerShell 7 — the resolver's last resort is 5.1,
# which garbles BOM-less UTF-8 (see buglog credentials incident).
- id: pwsh-sandbox
  name: '@deepseek-ai/dsh-pwsh-sandbox'
  config:
    pwshPath: 'C:\Program Files\PowerShell\7\pwsh.exe'

# tool-python: interpreter AUTO-DISCOVERY — pythonPath is optional.
# Discovery order: DSH_PYTHON_PATH env → `py -3` launcher → PATH `python`
# (probe-verified; the WindowsApps Store stub is rejected) → Python3* under
# the standard install roots. Pin pythonPath only to force one of several
# installed versions.
- id: tool-python
  name: dsh-tool-python

# deepseek-balance: repoDir/opsDir 默认按同级结构自动推导，一般无需配置；
# 仅当布局偏离约定时在此覆盖。
- id: deepseek-balance
  name: dsh-deepseek-balance
```

然后在 profile 目录安装链接：

```powershell
cd %USERPROFILE%\.dsh\profiles\web
pnpm install
```

### 第 3b 步：生成 headless profile（可选，推荐）

headless 模式（`pnpm dsh --profile headless "任务"`）使用独立 composition。
不部署则 headless 会话只有官方插件（无 buglog 工具、无 D7 规则注入）。

创建目录 `%USERPROFILE%\.dsh\profiles\headless\`，写入 `package.json`
（7 个自研插件中 3 个纯 host 侧插件；web 专用插件不进 headless）：

```json
{
  "name": "dsh-profile-headless",
  "private": true,
  "dependencies": {
    "dsh-bug-log": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-bug-log",
    "dsh-locale-language": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-locale-language",
    "dsh-tool-python": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-tool-python"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-headless",
        "dsh-bug-log",
        "dsh-locale-language",
        "dsh-tool-python"
      ]
    }
  }
}
```

```powershell
cd %USERPROFILE%\.dsh\profiles\headless
pnpm install
```

---

## 第 4 步：用户配置

**模型/主题设置**（与开发机一致，仓库已备模板）：

```powershell
# 首次执行会创建 %USERPROFILE%\.dsh\
Copy-Item <盘符>:\DSH\DSH-ops\config\settings.yaml %USERPROFILE%\.dsh\settings.yaml
```

**用户全局规则底座**（所有会话注入的硬规则，仓库已备模板）：

```powershell
Copy-Item <盘符>:\DSH\DSH-ops\config\AGENTS-global-template.md %USERPROFILE%\.dsh\AGENTS.md
# 然后编辑该文件：把 <盘符> 替换为实际盘符；pwsh/python 实际安装位有偏离时一并修正
```

> 缺这步：新机所有会话将没有 D7 工具分工与服务纪律注入（模型默认乱用 pwsh）。

**personal-hub 权威清单**（`personal-hub/personal.json`，git 内含开发机路径，新机必须改）：

| 字段 | 开发机值 | 新机改法 |
|---|---|---|
| `profileDir` | `C:/Users/Administrator/.dsh/profiles/web` | 用户名换成新机 Windows 用户 |
| `pluginsDir` | `E:/DSH/DSH-ops/plugins` | 盘符/父目录换成新机实际 |
| `plugins[].patch.config.pythonPath` | 本机 Python 3.14 绝对路径 | **整块删掉** `config`（走解释器自动发现），或改为新机实际路径 |
| `extraPatches[].config.pwshPath` | `E:\GongJu\7\pwsh.exe` | 标准安装改 `C:\Program Files\PowerShell\7\pwsh.exe`，便携位改实际路径 |

> 不改的后果：`personal_hub_status` 校验直接报错（profileDir 不存在，fail-loud 不会静默错写），
> `personal_hub_reapply` 拒绝运行。改对后该清单成为新机的 profile 权威来源。

**API 密钥**（含密钥，永不入 git，每机独立）：

编辑 `%USERPROFILE%\.dsh\.credentials.yaml`。**当前 DSH 使用新版嵌套格式**
（0.1.1+ 凭据体系，`version: 1` + `refs:` 块，两空格缩进）：

```yaml
version: 1
refs:
  DEEPSEEK_API_KEY: sk-你的deepseek密钥
  ZAI_API_KEY: 你的智谱密钥
  OPENCODE_GO_API_KEY: 你的opencode-go密钥
```

> 也可先留空启动，在 Web 界面 设置 → 模型中填写，效果相同。
> 升级守卫（update-dsh.ps1）同时认新版嵌套与旧扁平两种格式，兼容无忧。

---

## 第 5 步：验证（全部通过才算部署成功）

```powershell
# 1. 插件闸门（重启前必跑）
node <盘符>:\DSH\DSH-ops\validate-plugins.mjs
# 期望: 7 个插件全部 PASS

# 2. 组合树
node <盘符>:\DSH\Deepseek_DSH\apps\cli\lib\bin.js --profile web --dump-config
# 期望: 出现 pwsh-sandbox / locale-language / deepseek-balance / tool-python /
#       bug-log / personal-hub / plugin-guide / restart-resume 行

# 3. 启动
<盘符>:\DSH\DSH-ops\启动DSH.bat
# 期望: 提示"已是最新版本" + 浏览器打开 http://127.0.0.1:3080
```

启动后检查：

- 会话头部出现 **余额胶囊** 与 **版本胶囊**（版本号与克隆源一致，不写死）
- 悬停版本胶囊：`本地提交` 与 `官方最新` 一致（发布节奏不同时属正常；用 `更新DSH.bat` 对齐）
- 模型工具列表含 `python`、`bug_report`、`bug_search`、`bug_stats`、`personal_hub_status`、`request_restart`
- `http://127.0.0.1:3080/api/dsh/repo-status` 返回 `{"version":"0.1.x-...",...}`

---

## 第 6 步：例行维护（与开发机一致）

| 操作 | 命令 |
|---|---|
| 检查官方仓库更新 | 启动时自动（check-update.ps1）或 `更新DSH.bat` |
| 升级 DSH | `更新DSH.bat`（全套守卫 + 版本台账自动记录） |
| 自动更新 | 点击版本胶囊「有新版本」即触发 |
| 彻底重启 DSH | `启动DSH.bat`（**点击一次即彻底重启**：先强制停止当前服务并等端口释放，再走插件闸门+完整启动；无运行服务时直接启动） |
| 同步插件/知识库 | `git -C <盘符>:\DSH\DSH-ops pull`（buglog、台账、标准随之更新） |

---

## 已知差异（无法通过本仓库同步）

| 项 | 说明 |
|---|---|
| 密钥/模型设置 | 每台机器独立，见第 4 步 |
| 网络通道/VPN | 每台机器独立（GitHub 访问必需）。支持两种模式，脚本自动识别：系统代理模式（注册表 ProxyEnable=1）或 TUN 虚拟网卡模式（直连探测通过）。均不可用时更新链明确报错且不假更新 |
| DSH 官方仓库版本 | 各机器克隆/升级时点不同，各自保持官方最新；版本记录见台账，无需特定对齐 |
| pwsh 7 非标准位置 | pwsh 定位链（版本胶囊自动更新 + update-dsh.ps1 重启）：`DSH_PWSH_PATH` 环境变量 → PATH 各目录 → `C:\Program Files\PowerShell\7`。标准安装零配置；便携/自定义路径时**必须**（其一）：① 把 pwsh 目录加入系统 PATH（推荐）；② 设系统环境变量 `DSH_PWSH_PATH` 指向 pwsh.exe 完整路径。另需把 profile `cordis.patch.yml` 的 `pwshPath` 改为实际路径，否则 pwsh 沙箱工具会静默降级 5.1（中文乱码，见 buglog）。找不到 pwsh 7 时胶囊会明确报"更新启动失败"，不会静默假更新 |
| pwsh 不可用时执行任务 | **不需要** pwsh 可用才能跑任务：DSH 会话内 `python` 工具（dsh-tool-python）与 `pwsh` 工具走同一 shell 执行器，但解释器解析完全独立——pythonPath 缺省时自动发现（DSH_PYTHON_PATH → py -3 → PATH python 探测验证 → 标准安装位），且强制 UTF-8 输出，**即使 pwsh 7 缺失也能用 Python 执行计算/数据处理任务**。唯一硬依赖：机器上至少有一个可用的 Python 3（python.org 标准安装即满足）。更新/启动链路仍要求 pwsh 7（BOM/GBK 事故禁用 5.1），见上一行 |

---

## 部署历史

- 2026-08-18：按本指南在 `E:\DSH` 完整模拟部署验证通过（clone→build→profile→配置→启动→路由验证→清理）。
  发现并修复：`validate-plugins.mjs`/`disable-plugin.mjs` 硬编码用户路径（已改动态解析）；
  补 settings.yaml 复制步骤；淘汰旧部署脚本（setup.ps1 / 安装DSH.bat / DEPLOY.txt / README.txt）。
- 2026-09-01：部署可复制性审计。web profile 模板 4→7 插件（补 personal-hub / plugin-guide / restart-resume）；
  新增第 3b 步 headless profile；第 4 步新增用户全局规则底座（`config/AGENTS-global-template.md` →
  `%USERPROFILE%\.dsh\AGENTS.md`）；修正 PLUGIN-STANDARD.md 与 dsh-bug-log README 残留旧机路径
  `D:/GongJu` 为部署占位（脚本与插件代码经全仓扫描确认零硬盘符，全自定位）。
