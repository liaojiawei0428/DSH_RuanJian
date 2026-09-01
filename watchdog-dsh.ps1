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
    if ($line -match 'plugins[\\/](dsh-[A-Za-z0-9-]+)[\\/]') { return $Matches[1] }
  }
  return $null
}

# 防循环护栏：拉起记录保留 1 小时窗口，窗口内已拉起 3 次仍不稳定 → 转人工。
# （坏插件若"拉起后随即又崩"，新启动器的存活复核+G3 会先接手；本护栏兜住
#  更换慢、反复崩的极端形态，防止看门狗变成无限重启机。）
$restartsFile = Join-Path $ops 'watchdog-restarts.log'
function Test-RestartBudget {
  if (Test-Path $restartsFile) {
    $cutoff = (Get-Date).AddHours(-1)
    Get-Content $restartsFile -ErrorAction SilentlyContinue |
      ForEach-Object { try { [datetime]$_ } catch { $null } } |
      Where-Object { $_ -and $_ -gt $cutoff } |
      Set-Content $restartsFile
  }
  $recent = @(Get-Content $restartsFile -ErrorAction SilentlyContinue | Where-Object { $_.Trim() })
  return ($recent.Count -lt 3)
}

Write-Log "看门狗启动 (pid $me): 每 ${IntervalSeconds}s 查询 3080, 连续 $DebounceMisses 次无监听认定死亡"
$misses = 0
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
  $broken = Get-BrokenPluginName
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

  # WMI 一级拉起完整启动链（父进程 WmiPrvSE，不受任何 Job 对象管辖；
  # 不带 -Restart——服务已死，启动器幂等语义直接启动）。启动成功后启动器
  # 会拉起新看门狗，本实例随之让位退出。
  $launcher = Join-Path $ops 'start-dsh-web.ps1'
  $pwsh = Resolve-PwshPath
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = "`"$pwsh`" -NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
    CurrentDirectory = $ops
  }
  if ($r.ReturnValue -eq 0) {
    Write-Log "已 WMI 拉起启动链 (执行者 pid $($r.ProcessId)), 本看门狗退出让位"
  } else {
    Write-Log "WMI 拉起失败 (ReturnValue $($r.ReturnValue)), 请人工启动 DSH"
  }
  exit 0
}
} finally {
  # 黑匣子：正常退出、exit、终止性错误都会留下这行；被 Stop-Process 强杀
  # 不会。health-check.py 判据：启动行后无此行且心跳过期 → 强杀/崩溃，转死因排查。
  Write-Log "看门狗进程退出 (pid $me)"
}
