$log = 'E:\DSH\DSH-ops\g5-drill.log'
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  $c = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
  $port = if ($c) { "LISTEN pid=$($c[0].OwningProcess)" } else { 'DOWN' }
  $hb = if (Test-Path 'E:\DSH\DSH-ops\watchdog.heartbeat') { (Get-Item 'E:\DSH\DSH-ops\watchdog.heartbeat').LastWriteTime.ToString('HH:mm:ss') } else { 'none' }
  $wd = Get-CimInstance Win32_Process -Filter "Name='pwsh.exe'" | Where-Object { $_.CommandLine -match 'watchdog-dsh\.ps1' -and $_.CommandLine -notmatch 'wd-relay' } | Select-Object -First 1
  $wdp = if ($wd) { $wd.ProcessId } else { 'none' }
  "[$(Get-Date -Format 'HH:mm:ss')] port=$port hb=$hb watchdog=$wdp" | Out-File $log -Append
  Start-Sleep -Seconds 5
}
