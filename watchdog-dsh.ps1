param(
  # 轮询周期与去抖计数可调，默认 30 秒 x 2 = 连续 60 秒无监听才认定死亡。
  [int]$IntervalSeconds = 30,
  [int]$DebounceMisses = 2
)
$ErrorActionPreference = 'Continue'
# G5 运行期看门狗：启动器的存活复核只覆盖启动后 2 秒；坏插件完全可能在
# 任意延迟后才崩（首次调用某工具、定时器、内存耗尽）。服务死亡时启动器
# 早已退出、G3 无从触发——由本看门狗接管：定位肇事插件（与 G3 同判据）、
# 自动隔离、WMI 拉起完整启动链，实现"任何情况下 DSH 都能恢复运行"。

$ops = $PSScriptRoot
$log = Join-Path $ops 'watchdog.log'
# 心跳文件：主循环每轮覆盖写入。health-check.py 据此区分「进程在但卡死」
# （心跳过期）与正常在岗，并量化死亡时长。2026-08-31 起看门狗出现两例
# 上岗后 1-2 分钟无声消失（2568、26636），事件日志无痕、自身日志无退出行
# ——死因未明；心跳 + finally 黑匣子负责抓现场（有 finally 行 = 正常/错误
# 退出；无 finally 行且心跳过期 = 被强杀或进程级崩溃）。
$heartbeat = Join-Path $ops 'watchdog.heartbeat'

# 解析 pwsh 7 实际路径（本机可能装在非标准位置）：DSH_PWSH_PATH → PATH →
# Program Files 两处默认位。与 dsh-restart-resume 的定位链一致，避免写死
# 安装路径导致 WMI 拉起失败（2026-08-31：写死 Program Files 路径在本机
# 不存在，拉起永远 ReturnValue 9，服务死后看门狗形同虚设）。
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

function Write-Log([string]$msg) {
  "[$([DateTime]::Now)] $msg" | Out-File $log -Append
}

# 隐藏自身控制台窗口（兜底保险）：不管由谁拉起、是否带 -WindowStyle Hidden，
# 看门狗都不弹黑窗。2026-09-02 事故：黑窗被用户误关 = 杀看门狗（第 4 例
# 无声死亡：2568/26636/27112/31652 均为"黑窗被关→进程被杀→保护悬空"）。
# 注意：控制台窗口属于 conhost，不是 pwsh 的 MainWindow——必须用
# GetConsoleWindow 拿真实句柄（MainWindowHandle 恒为 0，无效）。
try {
  $sig = '[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); '
    + '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'
  Add-Type -Namespace 'Dsh' -Name 'DshWatchdogWin' -MemberDefinition $sig -ErrorAction Stop
  $hwnd = [Dsh.DshWatchdogWin]::GetConsoleWindow()
  if ($hwnd -ne [IntPtr]::Zero) { [Dsh.DshWatchdogWin]::ShowWindow($hwnd, 0) | Out-Null }
} catch {
  # 无控制台窗口（如已 Hidden 拉起）或 Add-Type 受限时静默忽略。
}

# 单实例：已有看门狗在跑则退出（每次启动器成功都会确保一个看门狗在岗）。
$me = $PID
$others = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
  Where-Object {
    $_.ProcessId -ne $me -and
    $_.CommandLine -match 'watchdog-dsh\.ps1' -and
    $_.CommandLine -match '-File' -and
    $_.CommandLine -notmatch '-Command'
  }
if ($others) {
  Write-Log "已有看门狗在运行 (pid $($others.ProcessId -join ',')), 本实例退出"
  exit 0
}

# 与 start-dsh-web.ps1 的 Get-BrokenPluginName 保持同步（G3 同判据）：
# loader entry 报错 / resolve 失败 / declares no dsh.bundle / 异常栈插件路径。
function Get-BrokenPluginName {
  $errLog = Join-Path $ops 'dsh-web.err.log'
  if (-not (Test-Path $errLog)) { return $null }
  $tail = Get-Content $errLog -Tail 80 -ErrorAction SilentlyContinue
  # 优先取最内层的 entry 报错（failed to import loader entry X (dsh-xxx)）：
  # 外层 include (cordis:include) 只是包装，误抓它会让 disable 失败并浪费
  # 看门狗预算（2026-09-01 dsh-remote-ssh 事故）。
  foreach ($line in $tail) {
    if ($line -match 'failed to import loader entry \S+ \(([^)]+)\)') { return $Matches[1] }
  }
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
    # 只从真正的异常栈行提取插件路径（错误特征行），避免普通日志里恰好
    # 出现的 plugins\dsh-xxx 路径被误判为肇事者（2026-09-08 事故：健康插件
    # 因 err.log 陈旧痕迹被误摘）。
    if ($line -match 'plugins[\\/](dsh-[A-Za-z0-9-]+)[\\/]' -and
        $line -match 'Error|error|at |throw|failed|FAILED|Cannot|Unhandled') { return $Matches[1] }
  }
  return $null
}

# 防循环护栏：拉起记录保留 1 小时窗口，窗口内已拉起 3 次仍不稳定 → 转人工。
# （坏插件若"拉起后随即又崩"，新启动器的存活复核+G3 会先接手；本护栏兜住
#  更换慢、反复崩的极端形态，防止看门狗变成无限重启机。）
# 2026-09-02 修复：旧实现里 `Where-Object { $_ -gt $cutoff } | Set-Content`
# 在管道为空（所有记录都已过期）时不清空文件，历史记录永远残留，预算被
# 读成"1 小时内已 3 次"，服务真死时看门狗拒救退出（16:50 事故）。
$restartsFile = Join-Path $ops 'watchdog-restarts.log'
function Test-RestartBudget {
  $cutoff = (Get-Date).AddHours(-1)
  if (Test-Path $restartsFile) {
    $kept = @(Get-Content $restartsFile -ErrorAction SilentlyContinue |
      ForEach-Object { try { [datetime]$_ } catch { $null } } |
      Where-Object { $_ -and $_ -gt $cutoff })
    # 显式以 kept 重写文件（空数组也清空），而非管道直通 Set-Content。
    if ($kept.Count -gt 0) { $kept | Set-Content $restartsFile } else { Clear-Content $restartsFile }
  }
  $recent = @(Get-Content $restartsFile -ErrorAction SilentlyContinue | Where-Object { $_.Trim() })
  return ($recent.Count -lt 3)
}

Write-Log "看门狗启动 (pid $me): 每 ${IntervalSeconds}s 查询 3080, 连续 $DebounceMisses 次无监听认定死亡"
$misses = 0
# 启动立即写一次心跳：health-check 用「进程在+心跳过期」判卡死，若首轮
# 要等 30s 才写，期间会被误判为卡死而误杀（2026-09-02 9448 事故：启动
# 12s 即被判 316s 过期遭 kill）。
(Get-Date).ToString('o') | Set-Content $heartbeat
try {
  while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    (Get-Date).ToString('o') | Set-Content $heartbeat
  $c = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
  if ($c) {
    if ($misses -gt 0) { Write-Log "端口 3080 恢复监听 (pid $($c[0].OwningProcess)), 计数清零" }
    $misses = 0
    continue
  }
  $misses += 1
  Write-Log "端口 3080 无监听 ($misses/$DebounceMisses)"
  if ($misses -lt $DebounceMisses) { continue }

  # 死亡确认。去抖窗口已滤掉 -Restart 的正常端口空窗（杀旧→拉新 ≤35s）。
  Write-Log '服务死亡确认 (连续无监听超过去抖窗口), 进入自动恢复'
  # 主动重启窗口豁免：request_restart（dsh-restart-resume 插件）在停服前写入
  # ~/.dsh/restart-resume.json 续聊标记；看门狗把它当成"本就在进行的重启"而非
  # 意外死亡——跳过肇事插件隔离（避免从 err.log 陈旧痕迹误摘健康插件，
  # 2026-09-08 事故：重启窗口内误摘 dsh-github-push / dsh-server-ssh），
  # 直接让位给启动链。标记由新进程 boot 消费后删除。
  $rerunHome = $env:DSH_HOME
  if (-not $rerunHome -or $rerunHome.Length -eq 0) { $rerunHome = Join-Path $env:USERPROFILE '.dsh' }
  $rerunMarker = Join-Path $rerunHome 'restart-resume.json'
  if (Test-Path $rerunMarker) {
    try {
      $markerAge = (Get-Date) - (Get-Item $rerunMarker).LastWriteTime
      if ($markerAge.TotalMinutes -lt 30) {
        Write-Log '检测到 restart-resume 续聊标记 (主动重启窗口), 跳过肇事插件隔离, 直接拉起启动链'
        $broken = $null
      } else {
        Remove-Item $rerunMarker -Force -ErrorAction SilentlyContinue
        $broken = Get-BrokenPluginName
      }
    } catch {
      $broken = Get-BrokenPluginName
    }
  } else {
    $broken = Get-BrokenPluginName
  }
  if ($broken) {
    Write-Log "从 dsh-web.err.log 定位到肇事插件 $broken, 自动移出 bundles (文件与 link 保留)"
    # node 定位链：PATH 优先，Program Files 兜底（与 Resolve-PwshPath 同纪律，
    # 禁止写死——本机安装位置可能非标准）。
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) { $node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
    & $node (Join-Path $ops 'disable-plugin.mjs') $broken 2>&1 | ForEach-Object { Write-Log "isolate: $_" }
    if ($LASTEXITCODE -ne 0) { Write-Log "隔离 $broken 失败 (exit $LASTEXITCODE), 仍尝试拉起 (启动链闸门会拦截)" }
  } else {
    Write-Log '未能在 err.log 定位肇事插件 (可能非插件原因), 直接拉起启动链'
  }

  if (-not (Test-RestartBudget)) {
    Write-Log '1 小时内已拉起 3 次仍不稳定, 停止自动恢复, 请人工排查 (watchdog-restarts.log)'
    exit 1
  }
  (Get-Date) | Out-File $restartsFile -Append

  # 拉起完整启动链（不带 -Restart——服务已死，启动器幂等语义直接启动）。
  # 用 Start-Process -WindowStyle Hidden（STARTF_USESHOWWINDOW）而非 WMI：
  # WMI 不接受 STARTUPINFO，创建的控制台进程必弹黑窗，用户误关 = 杀进程
  # （2026-09-02 第 4 例无声死亡根因）。启动成功后启动器会拉起新看门狗，
  # 本实例随之让位退出。
  $launcher = Join-Path $ops 'start-dsh-web.ps1'
  $pwsh = Resolve-PwshPath
  $p = Start-Process -FilePath $pwsh -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 500
  if ($p.HasExited) {
    Write-Log "拉起启动链失败 (exit $($p.ExitCode)), 请人工启动 DSH"
  } else {
    Write-Log "已拉起启动链 (执行者 pid $($p.Id)), 本看门狗退出让位"
  }
  exit 0
}
} finally {
  # 黑匣子：正常退出、exit、终止性错误都会留下这行；被 Stop-Process 强杀
  # 不会。health-check.py 判据：启动行后无此行且心跳过期 → 强杀/崩溃，转死因排查。
  Write-Log "看门狗进程退出 (pid $me)"
}
