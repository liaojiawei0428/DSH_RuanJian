param(
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
# 路径约定：本脚本位于 <root>\DSH-ops，官方仓库为同级 <root>\Deepseek_DSH，
# 盘符任意，仅要求两仓库同父目录。
$ops = $PSScriptRoot
$repo = Join-Path (Split-Path $ops -Parent) 'Deepseek_DSH'
$log = Join-Path $ops 'dsh-update.log'
. (Join-Path $ops 'lib-proxy.ps1')

function Write-Both([string]$msg) {
  Write-Host $msg
  "[$([DateTime]::Now)] $msg" | Out-File $log -Append
}

Write-Both '==== DSH 升级检查 ===='
if (-not (Test-Path (Join-Path $repo '.git'))) {
  Write-Both "错误: 未找到仓库 $repo"
  exit 1
}

# 1. 本地工作区必须干净（.npmrc 等未跟踪文件不算）。
$dirty = git -C $repo status --porcelain | Where-Object { $_ -notmatch '^\?\?' }
if ($dirty) {
  Write-Both "警告: 仓库有未提交的修改, 中止升级:`n$dirty"
  exit 1
}
Write-Both '本地工作区干净 OK'

# 1.5 用户配置完整性校验（在动任何东西之前）。
# 背景: .credentials.yaml 一旦损坏, 凭据插件按设计 fail-loud, 进程在监听端口前
# 就退出, 启动器重试全部失败。文件有两代合法形态, 校验须同时认:
#   A. 新版 (dsh 0.1.1-rc.1+, credentials-local parseCredentialsDocument):
#        顶层键只允许 version / refs / records; refs 值为非空标量;
#      B. 旧版扁平 KEY: value (无 version 顶层键)——新版启动时自动迁移,
#        守卫不应拦截。
# 标量值规则: YAML 中 "冒号后跟空格" (: ) 无引号时非法; "冒号后跟非空格"
# (如 sk-abc:def) 合法 —— 旧守卫"值中不允许冒号"的假设已过时。
function Test-CredentialsYamlShape {
  param([string]$Path)
  $topKeys = @('version', 'refs', 'records')
  try { $raw = Get-Content $Path } catch { return "无法读取文件 ${Path}: $($_.Exception.Message)" }
  $section = $null
  $sectionIndent = -1
  $sawVersion = $false
  $flatKeys = @()
  $lineNo = 0
  foreach ($line in $raw) {
    $lineNo++
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed -match '^#') { continue }
    $indent = $line.Length - $line.TrimStart().Length
    if ($line -notmatch '^\s*([^\s:][^:]*?)\s*:\s*(.*?)\s*$') {
      return "第 $lineNo 行不是合法的 KEY: value 条目"
    }
    $key = $Matches[1]
    $value = $Matches[2]
    if ($indent -eq 0) {
      if ($key -in $topKeys) {
        if ($key -eq 'version') {
          $sawVersion = $true
          if ($value -notmatch '^\d+$') { return "第 $lineNo 行 version 值非法: '$value'" }
        } else {
          if ($value -ne '') { return "第 $lineNo 行 $key 为块首, 不允许内联值" }
          $section = $key
          $sectionIndent = -1
        }
      } else {
        if ($sawVersion) { return "第 $lineNo 行顶层键 '$key' 不在 {version, refs, records} 内" }
        $flatKeys += $key
      }
    } else {
      # 缩进行
      if ($null -eq $section) { return "第 $lineNo 行出现缩进但没有上层块 (结构损坏)" }
      if ($sectionIndent -lt 0) { $sectionIndent = $indent }
      if ($indent -lt $sectionIndent) { return "第 $lineNo 行缩进小于块缩进 (结构损坏)" }
      if ($section -eq 'refs') {
        if ($indent -ne $sectionIndent) { return "第 $lineNo 行 refs 块内出现更深嵌套 (refs 值应为标量)" }
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$') { return "第 $lineNo 行 refs 键名非法: '$key'" }
        if ($value -eq '') { return "第 $lineNo 行 refs 键 '$key' 值不能为空" }
      }
      # records 块允许任意层级, 只做行级检查
      if ($value -match ':\s' -and -not $value.StartsWith('"') -and -not $value.StartsWith("'")) {
        return "第 $lineNo 行值含非法 ': ' 序列 (YAML 标量不允许; 需加引号)"
      }
    }
  }
  # 旧扁平格式 (无 version): 顶层键都应在缩进制, 且值合法; 允许被新版自动迁移
  if (-not $sawVersion) {
    $bad = $flatKeys | Where-Object { $_ -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$' }
    if ($bad) { return "扁平格式存在非法键: '$($bad -join ', ')'" }
  } elseif ($flatKeys.Count -gt 0) {
    return "混合格式: 既有 version 又有扁平顶层键 '$($flatKeys -join ', ')' (结构损坏)"
  }
  return $null
}

$credPath = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'
if (Test-Path $credPath) {
  $shapeError = Test-CredentialsYamlShape -Path $credPath
  if ($null -ne $shapeError) {
    Write-Both "错误: $credPath $shapeError"
    Write-Both "恢复: 从 $env:USERPROFILE\.dsh\backups\<时间戳>\ 复制最近的备份"
    exit 1
  }
  Write-Both '凭据文件结构 OK (支持新嵌套格式与旧扁平格式)'
}

# 1.6 备份用户配置（升级出错时可立即恢复; 含密钥, 必须留在本机, 不可提交仓库）。
$backupDir = Join-Path $env:USERPROFILE ("\.dsh\backups\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($f in @('.credentials.yaml', 'settings.yaml')) {
  $p = Join-Path $env:USERPROFILE ".dsh\$f"
  if (Test-Path $p) { Copy-Item $p $backupDir }
}
$profPkg = Join-Path $env:USERPROFILE '.dsh\profiles\web\package.json'
if (Test-Path $profPkg) { Copy-Item $profPkg $backupDir }
Write-Both "用户配置已备份到 $backupDir"

# 1.7 记录升级前的版本号（用于升级成功后写入本地版本台账）。
$oldVer = 'unknown'
try { $oldVer = (Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version } catch {}

# 2. 网络通道诊断（系统代理 或 虚拟网卡直连，本地问题在此明确中止）。
$proxy = Get-SystemProxy
if (-not (Set-ProxyEnvironment $proxy)) {
  Write-Both "升级中止: $($proxy.Status) 且直连 GitHub 不可达"
  Write-Both '提示: 这是本地网络问题, 请开启 VPN (系统代理模式或 TUN 虚拟网卡模式均可) 后重试'
  exit 1
}
if ($proxy.Enabled) { Write-Both "网络通道: 系统代理 $($proxy.Url)" } else { Write-Both '网络通道: 直连 (虚拟网卡/TUN 模式)' }

# 3. 获取远端信息（走动态代理或直连）。
Write-Both '正在检查远端更新 (git fetch)...'
git -C $repo -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 fetch origin 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Both '升级中止: 网络通道已就绪但访问 GitHub 失败 (可能是 VPN 节点失效或网络波动)'
  Write-Both '请切换 VPN 节点或检查网络后重试'
  exit 1
}
$local = git -C $repo rev-parse HEAD
$remote = git -C $repo rev-parse origin/master
$localShort = $local.Substring(0, 12)
$remoteShort = $remote.Substring(0, 12)

if ($local -eq $remote) {
  Write-Both "本地已是最新: $localShort (origin/master 相同)"
  if ($CheckOnly) { exit 0 }
  Write-Both '没有新提交, 跳过 git pull'
} else {
  Write-Both "发现更新: 本地 $localShort -> 远端 $remoteShort"
  if ($CheckOnly) { exit 2 }
  git -C $repo pull --ff-only
  if ($LASTEXITCODE -ne 0) { Write-Both 'git pull 失败 (可能本地有提交, 需要手动处理)'; exit 1 }
  Write-Both 'git pull 完成 OK'
}

if ($CheckOnly) { exit 0 }

# 3.5 记录升级后的提交（用于版本台账; 无更新时与旧提交相同）。
$newSha = git -C $repo rev-parse HEAD

# 3.9 MSVC 工具链预检: 官方 0.1.3-alpha.1 起 lockfile 含原生依赖 fs-ext
# (session 写锁, 提交 c58097a826), pnpm install 需 node-gyp 现场编译。
# 缺工具链的机器提前给出可执行修复命令, 不必从 node-gyp 英文报错里猜
# (见 buglog fs-ext-msvc-blocks-update)。
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vcHint = '修复: winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"'
if (-not (Test-Path $vswhere)) {
  Write-Both '警告: 未检测到 Visual Studio 安装器 (vswhere)。若新版 lockfile 含原生依赖 (如 fs-ext), pnpm install 会失败。'
  Write-Both $vcHint
} elseif (-not (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null)) {
  Write-Both '警告: 检测到 Visual Studio 但缺少 "Desktop development with C++" 工作负载, 原生依赖编译会失败。'
  Write-Both $vcHint
}

# 4. 重新安装依赖。
Push-Location $repo
try {
  Write-Both '安装依赖 (pnpm install --frozen-lockfile)...'
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }
  Write-Both '依赖安装完成 OK'

  # 5. 重新构建（lib + web）。
  Write-Both '构建中 (pnpm run build, 约 2-5 分钟, 请勿关闭窗口)...'
  pnpm run build
  if ($LASTEXITCODE -ne 0) {
    # 跨"官方删除包/文件"的提交升级时, git pull 不清理已删包的旧 lib 产物,
    # tsc 增量编译会留下孤儿文件, 让 tsdown 报 MISSING_EXPORT。自愈: 全量清理后重建一次。
    Write-Both '构建失败, 疑似旧构建产物残留, pnpm run clean 后重试一次...'
    pnpm run clean
    if ($LASTEXITCODE -ne 0) { throw 'pnpm run clean 失败' }
    pnpm run build
    if ($LASTEXITCODE -ne 0) { throw 'pnpm run build 失败 (clean 重试后仍失败, 见上方输出)' }
  }
  Write-Both '构建完成 OK'
} catch {
  Write-Both "构建阶段失败: $($_.Exception.Message)"
  Write-Both '旧服务仍在运行, 不受影响 (可继续使用旧版本)'
  Write-Both "回滚到升级前版本: git -C $repo checkout $($local.Substring(0, 12)) 后重跑本脚本"
  Pop-Location
  exit 1
}
Pop-Location

# 6. 新版本号确认。
$ver = node (Join-Path $repo 'apps\cli\lib\bin.js') --version
Write-Both "新版本: $ver"

# 6.5 profile 组合预检: profile 声明的每个 bundle 都必须能解析进组合树。
# 背景: 曾发生过 npm 上同名旧版插件被误装, 位置形态全错。这一步在重启前
# 就能发现 bundle 解析失败; 已链接插件指向的路径丢失也会在此暴露。
$dump = node (Join-Path $repo 'apps\cli\lib\bin.js') --profile web --dump-config 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Write-Both "错误: dump-config 失败, 中止 (旧服务不受影响): $dump"
  exit 1
}
$bundles = (Get-Content $profPkg -Raw | ConvertFrom-Json).dsh.profile.bundles
foreach ($b in @($bundles)) {
  if ($dump -notmatch [regex]::Escape($b)) {
    Write-Both "错误: profile 声明的 bundle '$b' 未出现在组合树中 (依赖丢失或未安装)"
    Write-Both "中止重启, 旧服务不受影响; 修复: 检查 $profPkg 与 node_modules 链接"
    exit 1
  }
}
Write-Both "profile 组合校验 OK ($(@($bundles).Count) 个 bundle 全部解析)"

# 6.7 link 插件预检闸门: 用真实核心校验器执行每个 link 插件的注册路径。
# 背景: 13:05 事故——插件注册期抛错 (schema 方言违规) 使进程在监听端口前
# 崩溃, 启动器 3 次重试全部死于同一错误。此闸门在动旧服务之前拦截该类故障。
& 'C:\Program Files\nodejs\node.exe' (Join-Path $ops 'validate-plugins.mjs') 2>&1 | ForEach-Object { Write-Both "plugins: $_" }
if ($LASTEXITCODE -ne 0) {
  Write-Both '错误: link 插件未通过预检, 中止重启 (旧服务不受影响)'
  Write-Both '修复对应插件后重跑本脚本; 也可临时从 profile bundles 移除该插件'
  exit 1
}
Write-Both 'link 插件预检 OK'

# 7. 重启服务让新构建生效。
Write-Both '重启 DSH 服务...'
# pid 文件可能缺失或过期（服务器由 restart 脚本/其他方式启动时不会更新它），
# 按端口 3080 找真实监听进程兜底，保证自动更新真的换上新构建。
$pidFile = Join-Path $ops 'dsh-web.pid'
$killed = $false
if (Test-Path $pidFile) {
  $old = Get-Content $pidFile
  $alive = Get-Process -Id $old -ErrorAction SilentlyContinue
  if ($alive) {
    Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
    Write-Both "已停止旧服务 (pid $old)"
    $killed = $true
  }
}
if (-not $killed) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Both "已按端口停止旧服务 (pid $($listener.OwningProcess))"
  } else {
    Write-Both '未发现运行中的服务, 直接启动'
  }
}
Start-Sleep -Seconds 2
# 用 $PSHOME 定位当前 pwsh 7 自身，而非裸名依赖 PATH ——
# 非标准安装位置(如便携部署)且 PATH 无 pwsh 的机器上，裸名会让更新
# 全部完成却重启失败，新版不生效。本脚本既由 pwsh 7 执行，$PSHOME 必然有效。
& (Join-Path $PSHOME 'pwsh.exe') -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ops 'start-dsh-web.ps1')
if ($LASTEXITCODE -ne 0) {
  Write-Both '服务重启失败, 请手动运行 启动DSH.bat 或查看 dsh-web.err.log'
  exit 1
}

# 7.5 HTTP 健康检查: 启动器退出码为 0 不等于服务已就绪。
$healthy = $false
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
  try {
    # 回环目标必须绕过系统代理：代理对 127.0.0.1 返回 502 时，
    # 就绪的服务会被误判为未就绪，每次升级都以假失败告终。
    # 官方 3e24087bfa（0.1.2-rc.1 起）给 web 加了认证门：根路径对未认证
    # 探测返回 401。收到任何 HTTP 响应即证明服务就绪，必须用
    # -SkipHttpErrorCheck（pwsh 7.2+）让非 2xx 不抛异常，否则永远假失败。
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3080' -UseBasicParsing -TimeoutSec 5 -NoProxy -SkipHttpErrorCheck
    if ($resp.StatusCode -lt 500) { $healthy = $true; break }
  } catch { Start-Sleep -Seconds 3 }
}
if (-not $healthy) {
  Write-Both '错误: 服务 120 秒内未就绪, 排障: dsh-web.err.log / dsh-update.log'
  Write-Both "回滚: git -C $repo checkout $($local.Substring(0, 12)) && 重跑本脚本"
  exit 1
}
Write-Both '健康检查 OK (http://127.0.0.1:3080 已就绪)'

# 8. 写入本地版本台账（每次成功升级追加一行; 台账随 DSH-ops 双机同步）。
$historyFile = Join-Path $ops 'version-history.md'
if (-not (Test-Path $historyFile)) {
  @(
    '# DSH 本地版本台账',
    '',
    '每次成功升级由 update-dsh.ps1 自动追加。版本号来自官方 package.json（稳定），提交为 git commit 前 12 位（精确）。',
    '',
    '| 日期 | 升级前 | 升级后 | 提交 | 方式 |',
    '|---|---|---|---|---|'
  ) | Out-File -FilePath $historyFile -Encoding utf8
}
$method = if ($env:DSH_UPDATE_SOURCE -eq 'auto') { '自动更新' } else { '手动' }
$row = "| $((Get-Date).ToString('yyyy-MM-dd HH:mm')) | $oldVer | $ver | $($newSha.Substring(0, 12)) | $method |"
Add-Content -Path $historyFile -Value $row -Encoding utf8
Write-Both "版本台账已更新: $historyFile"

Write-Both '升级完成! 浏览器将自动打开页面'
exit 0
