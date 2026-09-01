param(
  # 彻底重启模式：先强制停止当前监听 3080 的服务（若有）并等待端口释放，
  # 再走完整启动流程。默认（不带此开关）保持幂等语义：已在运行则直接打开
  # 浏览器退出（update-dsh.ps1 等调用方依赖该语义）。
  [switch]$Restart
)
$ErrorActionPreference = 'Continue'
# 路径约定：本脚本位于 <root>\DSH-ops，官方仓库为同级 <root>\Deepseek_DSH。
$ops = $PSScriptRoot
$repo = Join-Path (Split-Path $ops -Parent) 'Deepseek_DSH'
New-Item -ItemType Directory -Path $ops -Force | Out-Null
$log = Join-Path $ops 'dsh-switch.log'
$me = $PID

# 控制台 + 日志双输出。
function Write-Both([string]$msg) {
  Write-Host $msg
  "[$([DateTime]::Now)] $msg" | Out-File $log -Append
}

# 启动兜底的定位器：从 dsh-web.err.log 尾部提取肇事插件名。三种现场——
# Cordis loader 报错自带插件名（failed to apply loader entry X (dsh-xxx): ...）；
# bundle 解析/声明失败自带包名（cannot resolve profile bundle ... / declares
# no dsh.bundle）；未捕获异常栈里出现插件目录路径（.../plugins/dsh-xxx/index.js）。
function Get-BrokenPluginName {
  $errLog = Join-Path $ops 'dsh-web.err.log'
  if (-not (Test-Path $errLog)) { return $null }
  $tail = Get-Content $errLog -Tail 80 -ErrorAction SilentlyContinue
  foreach ($line in $tail) {
    if ($line -match 'failed to apply loader entry \S+ \(([^)]+)\)') { return $Matches[1] }
  }
  foreach ($line in $tail) {
    if ($line -match 'cannot resolve profile bundle.*?(dsh-[A-Za-z0-9-]+)') { return $Matches[1] }
  }
  foreach ($line in $tail) {
    if ($line -match 'profile bundle ["]?([^"\s]+)["]? declares') { return $Matches[1] }
  }
  foreach ($line in $tail) {
    if ($line -match 'plugins[\\/](dsh-[A-Za-z0-9-]+)[\\/]') { return $Matches[1] }
  }
  return $null
}

# 解析 pwsh 7 实际路径（本机可能装在非标准位置）：DSH_PWSH_PATH → PATH →
# Program Files 两处默认位。与 dsh-restart-resume 的定位链一致，避免写死
# 安装路径导致看门狗/启动链静默失效（2026-08-31：写死 Program Files 路径
# 在本机不存在，Ensure-Watchdog 永远 ReturnValue 9，服务死后无人接管）。
function Resolve-PwshPath {
  $override = $env:DSH_PWSH_PATH
  if ($override -and (Test-Path $override)) { return $override }
  foreach ($dir in ($env:PATH -split ';')) {
    if ($dir -and (Test-Path (Join-Path $dir 'pwsh.exe'))) { return (Join-Path $dir 'pwsh.exe') }
  }
  foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if (-not $pf) { continue }
    $candidate = Join-Path $pf 'PowerShell\7\pwsh.exe'
    if (Test-Path $candidate) { return $candidate }
  }
  return 'pwsh'
}

# G5 运行期看门狗：启动器退出后继续守护服务——运行期任意延迟崩溃（端口
# 就绪后才发生，G3/存活复核均已退场）由看门狗接管：定位肇事插件 → 自动
# 隔离 → WMI 拉起完整启动链。WMI 独立进程不受 Job 对象管辖；看门狗自带
# 单实例保护与防循环护栏（详见 watchdog-dsh.ps1）。启动器只在成功路径
# 调用它：服务没起来时轮到 G3 兜底，轮不到看门狗。
function Ensure-Watchdog {
  Remove-Item env:DSH_DRILL -ErrorAction SilentlyContinue
  $running = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
    Where-Object {
      $_.CommandLine -match 'watchdog-dsh\.ps1' -and
      $_.CommandLine -match '-File' -and
      $_.CommandLine -notmatch '-Command'
    }
  if ($running) { return }
  $pwsh = Resolve-PwshPath
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = "`"$pwsh`" -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $ops 'watchdog-dsh.ps1')`""
    CurrentDirectory = $ops
  }
  if ($r.ReturnValue -eq 0) { Write-Both "运行期看门狗已在岗 (pid $($r.ProcessId))" }
  else { Write-Both "看门狗拉起失败 (ReturnValue $($r.ReturnValue))——服务运行中但无运行期保护" }
}

# 单实例保护：只匹配真正的 `pwsh/powershell -File start-dsh-web.ps1` 调用
# （不带 -Command），避免命令行里恰好提到脚本名的诊断进程被误判。
$others = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
  Where-Object {
    $_.ProcessId -ne $me -and
    $_.CommandLine -match 'start-dsh-web\.ps1' -and
    $_.CommandLine -match '-File' -and
    $_.CommandLine -notmatch '-Command'
  }
if ($others) {
  Write-Both "另一个启动器已在运行 (pid $($others.ProcessId -join ',')), 本实例退出"
  exit 0
}

# link 插件预检闸门（必须先于任何停止动作）：注册期抛错的插件会让每次启动
# 尝试在监听端口前崩溃（13:05 事故：3 次重试死于同一错误）。放在 -Restart
# 杀旧服务之前，闸门红 = 直接中止、旧服务零影响，而不是停机后再失败。
& 'C:\Program Files\nodejs\node.exe' (Join-Path $ops 'validate-plugins.mjs') 2>&1 | ForEach-Object { Write-Both "plugins: $_" }
if ($LASTEXITCODE -ne 0) {
  Write-Both '启动中止: link 插件未通过预检 (见上方 plugins: 行); 修复插件后重试'
  exit 1
}

# 彻底重启模式：先强制停止当前服务并等待端口释放，再走完整启动。
if ($Restart) {
  $current = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
  if ($current) {
    $oldPid = $current[0].OwningProcess
    $oldName = (Get-Process -Id $oldPid -ErrorAction SilentlyContinue).ProcessName
    Write-Both "重启模式: 强制停止当前服务 (pid $oldPid, $oldName)..."
    Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline) {
      if (-not (Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Milliseconds 300
    }
    if (Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue) {
      Write-Both '重启失败: 旧服务 10 秒内未释放端口 3080, 请手动检查后重试'
      exit 1
    }
    Write-Both '旧服务已停止, 端口 3080 已释放'
  } else {
    Write-Both '重启模式: 当前无运行中的服务, 直接启动'
  }
}

# 已在运行则直接成功退出（随后打开浏览器）。
$existing = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
if ($existing) {
  Write-Both "DSH 服务已在运行 (pid $($existing[0].OwningProcess))"
  "$($existing[0].OwningProcess)" | Out-File (Join-Path $ops 'dsh-web.pid')
  Ensure-Watchdog
  Start-Process 'http://127.0.0.1:3080'
  Start-Sleep -Seconds 2
  exit 0
}

Write-Both '正在启动 DSH 服务，请稍候...'
# 启动兜底（底线 1"坏插件不得阻断 DSH 启动"的自动执行）：闸门只拦注册期可
# 检出的缺陷；若坏插件仍混进 bundles 且三次尝试全灭（运行期才炸），从
# err.log 定位肇事插件、自动移出 bundles（disable-plugin.mjs，文件与 link
# 保留，修复后加回即可），再重试一轮。只隔离一次，防止误判连环摘插件。
$isolationUsed = $false
:boot while ($true) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
  $p = Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
    -ArgumentList 'apps/cli/lib/bin.js', 'web' `
    -WorkingDirectory $repo `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $ops 'dsh-web.log') `
    -RedirectStandardError (Join-Path $ops 'dsh-web.err.log') `
    -PassThru
  Write-Both "第 $attempt 次尝试: 进程 $($p.Id) 已启动, 等待就绪 (最多 30 秒)..."
  # 轮询端口而不是固定睡眠：pnpm install 后首次启动（Defender 扫描新 link
  # 文件、文件缓存冷）实测 16 秒+，固定 15 秒曾把三个健康进程全部误杀
  # （2026-08-31）；轮询同时让热启动提前几秒返回。
  $deadline = (Get-Date).AddSeconds(30)
  $c = $null
  while ((Get-Date) -lt $deadline) {
    $c = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
    if ($c) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($c) {
    Write-Both "DSH 服务启动成功 (pid $($c[0].OwningProcess))"
    # 就绪后存活复核：异步运行期错误（如 setImmediate 抛错）会在端口绑定
    # 之后才杀掉进程——若此刻按"成功"退出，坏插件就逃过 G3 兜底，服务随后
    # 静默死亡（2026-08-31 gate-demo-bad4 事故）。短暂复核监听仍在才判真成功。
    Start-Sleep -Seconds 2
    $alive = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
    if ($alive) {
      "$($alive[0].OwningProcess)" | Out-File (Join-Path $ops 'dsh-web.pid')
      Ensure-Watchdog
      Start-Process 'http://127.0.0.1:3080'
      Start-Sleep -Seconds 2
      exit 0
    }
    Write-Both "第 $attempt 次尝试: 端口曾就绪但进程随即崩溃 (疑似异步运行期错误), 计入失败"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    continue
  }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Write-Both "第 $attempt 次尝试未就绪, 已终止该进程"
  }
  if (-not $isolationUsed) {
    $broken = Get-BrokenPluginName
    if ($broken) {
      $isolationUsed = $true
      Write-Both "启动兜底: 定位到肇事插件 $broken, 自动移出 bundles (文件与 link 保留) 并重试启动"
      & 'C:\Program Files\nodejs\node.exe' (Join-Path $ops 'disable-plugin.mjs') $broken 2>&1 | ForEach-Object { Write-Both "isolate: $_" }
      if ($LASTEXITCODE -eq 0) { continue :boot }
      Write-Both "启动兜底: 隔离 $broken 失败 (exit $LASTEXITCODE), 请人工排查"
    } else {
      Write-Both '启动兜底: 未能从 dsh-web.err.log 定位肇事插件, 其最后几行原文如下, 请人工排查:'
      Get-Content (Join-Path $ops 'dsh-web.err.log') -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { Write-Both "  err: $_" }
    }
  }
  Write-Both '启动失败: 3 次尝试均未成功, 请查看 dsh-web.err.log'
  exit 1
}
