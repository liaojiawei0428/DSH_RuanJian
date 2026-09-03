"""DSH-ops 一键体检 — "查状态"类任务的默认入口（D7 工具分工纪律）。

用法:
    python health-check.py           # 全量体检（含闸门 + 回归，约 10 秒）
    python health-check.py --quick   # 快速体检（跳过闸门/回归）

检查项:
  1. 服务端口 3080 监听 + 服务进程 pid/名（socket + netstat/tasklist，纯 python）
  2. 运行期看门狗在岗 pid（系统对象查询，白名单内的 pwsh 调用）
  3. watchdog.log / dsh-switch.log 尾部（纯 python）
  4. profile bundles 完整性（纯 python）
  5. 闸门 validate-plugins.mjs + 回归 test-standard.mjs（node 进程编排，白名单内）

退出码: 全绿 0；任何异常 1（看 [exit code: N] 标记即知）。
设计依据: PLUGIN-STANDARD.md D7 — 数据操作用 python，系统对象/进程编排才 pwsh；
本脚本把这些 pwsh 调用固化下来，模型日常查状态零 pwsh 接触。
"""

from __future__ import annotations

import csv
import datetime
import io
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

OPS = Path(__file__).resolve().parent
PORT = 3080
PROF_PKG = Path.home() / ".dsh" / "profiles" / "web" / "package.json"
OFFICIAL_PREFIX = "@deepseek-ai/"

issues: list[str] = []


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def fail(msg: str) -> None:
    issues.append(msg)
    print(f"  [异常] {msg}")


def ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, timeout=timeout, capture_output=True, text=True, encoding="utf-8", errors="replace")


# 1. 端口监听（纯 python）
section("服务端口")
sock = socket.socket()
sock.settimeout(3)
try:
    sock.connect(("127.0.0.1", PORT))
    listening = True
except OSError:
    listening = False
finally:
    sock.close()
if not listening:
    fail(f"端口 {PORT} 无监听 — 服务未运行")
else:
    ok(f"端口 {PORT} 在听")

# 2. 服务进程（netstat + tasklist，纯 python）
svc_pid = None
if listening:
    ns = run(["netstat", "-ano", "-p", "TCP"])
    for line in ns.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[3] == "LISTENING" and parts[1].endswith(f":{PORT}"):
            svc_pid = int(parts[4])
    if svc_pid is None:
        fail("netstat 未解析到监听 pid")
    else:
        tl = run(["tasklist", "/FI", f"PID eq {svc_pid}", "/FO", "CSV", "/NH"])
        rows = list(csv.reader(io.StringIO(tl.stdout.strip())))
        name = rows[0][0] if rows and rows[0] else "?"
        ok(f"服务 pid {svc_pid} ({name})")

# 3. 看门狗（系统对象 — 白名单内的 pwsh 调用）；不在岗时自动复活
section("看门狗 G5")
HEARTBEAT = OPS / "watchdog.heartbeat"
STALE_SECONDS = 75  # 2.5 个轮询周期；超过即认定卡死/死亡

ps = (
    "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe' OR Name='pwsh.exe'\" | "
    # 精确匹配 watchdog-dsh.ps1（含点号转义），排除 .wd-relay.ps1 中继与
    # 一切 -Command 查询进程；旧条件 'watchdog-dsh' 会把命令行里含该字符串
    # 的中继也当"看门狗"，导致复活误报失败（2026-09-02 修复）。
    "Where-Object { $_.CommandLine -match 'watchdog-dsh\\.ps1' -and $_.CommandLine -notmatch '-Command' -and $_.CommandLine -notmatch 'wd-relay' } | "
    # 输出 "pid|CreationDate" 供宽限判定（CreationDate 是 WMI UTC 时间）。
    "ForEach-Object { \"$($_.ProcessId)|$($_.CreationDate)\" }"
)
wd = run(["pwsh", "-NoProfile", "-Command", ps])
wd_entries = [ln.split("|") for ln in wd.stdout.splitlines() if "|" in ln] if wd.returncode == 0 else []
wd_pids = [int(e[0]) for e in wd_entries]

# 看门狗进程启动时间（WMI CreationDate = UTC）；用于"刚启动宽限"判定
wd_born = None
if wd_entries:
    try:
        wd_born = datetime.datetime.fromisoformat(wd_entries[0][1].replace("Z", "+00:00"))
    except Exception:
        wd_born = None

heart_age = None
if HEARTBEAT.exists():
    heart_age = time.time() - HEARTBEAT.stat().st_mtime

if wd_pids and heart_age is not None and heart_age < STALE_SECONDS:
    ok(f"看门狗在岗 pid {wd_pids[0]} (心跳 {heart_age:.0f}s 前)")
elif wd_pids and heart_age is None:
    ok(f"看门狗在岗 pid {wd_pids[0]} (心跳未产生 — 刚上岗宽限期内)")
elif wd_pids:
    # 刚启动宽限：进程出生 < STALE_SECONDS 时，心跳过期可能是上一实例的
    # 残留（本实例首轮心跳尚未写或刚写），不判卡死（2026-09-02 9448 事故）。
    fresh = wd_born is not None and (datetime.datetime.now(datetime.timezone.utc) - wd_born).total_seconds() < STALE_SECONDS
    if fresh:
        ok(f"看门狗在岗 pid {wd_pids[0]} (刚启动 {heart_age:.0f}s 心跳待首轮 — 宽限)")
    else:
        fail(f"看门狗 pid {wd_pids} 进程在但心跳过期 ({heart_age:.0f}s 前) — 卡死，自动复活")
        for pid in wd_pids:
            run(["taskkill", "/F", "/PID", str(pid)])
        wd_pids = []
else:
    # 死亡现场判读：日志无「进程退出」行 = 强杀/崩溃（finally 黑匣子未走）
    log_txt = (OPS / "watchdog.log").read_text(encoding="utf-8", errors="replace") if (OPS / "watchdog.log").exists() else ""
    last_lines = [ln for ln in log_txt.splitlines() if ln.strip()]
    killed = bool(last_lines) and "看门狗进程退出" not in last_lines[-1]
    verdict = "强杀/进程级崩溃 (黑匣子无退出行, 转死因排查)" if killed and heart_age is not None else "不在岗"
    extra = f", 心跳 {heart_age:.0f}s 前" if heart_age is not None else ""
    fail(f"看门狗不在岗 ({verdict}{extra}) — 自动复活")

# 复活：写一个极短命中继 .ps1（WMI 拉起它，脱离宿主 Job 连带），中继用
# Start-Process -WindowStyle Hidden 拉起真正的看门狗（隐藏窗口 + 与宿主
# Job 独立）。WMI 不能直接隐藏窗口（Win32_Process.Create 不接受
# STARTUPINFO），2026-09-02 事故：WMI 拉起的看门狗弹黑窗被用户误关 =
# 杀看门狗；直接 Start-Process 则看门狗随宿主 Job 死亡连带。
if not wd_pids:
    relay_ps = OPS / ".wd-relay.ps1"
    relay_ps.write_text(
        "$pwsh=(Get-Command pwsh -ErrorAction SilentlyContinue).Source; "
        "if(-not $pwsh){$pwsh=\"$env:ProgramFiles\\PowerShell\\7\\pwsh.exe\"}; "
        f"$p = Start-Process -FilePath $pwsh -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass',"
        f"'-File','{OPS}\\watchdog-dsh.ps1' -WindowStyle Hidden -PassThru; "
        "Start-Sleep -Milliseconds 500; "
        # 中继执行完毕自行删除（WMI 拉起是异步的，health-check 若立即 unlink
        # 会让中继读不到脚本——2026-09-02 复活失败根因）。
        "Remove-Item $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue; "
        "if($p.HasExited){exit 1}",
        encoding="utf-8",
    )
    # WMI 拉起中继（父 WmiPrvSE，脱离宿主 Job），中继再隐藏拉起看门狗。
    r = run(["pwsh", "-NoProfile", "-Command",
             "$o='" + str(OPS).replace("'", "''") + "'; "
             "$pwsh=(Get-Command pwsh -ErrorAction SilentlyContinue).Source; "
             "if(-not $pwsh){$pwsh=\"$env:ProgramFiles\\PowerShell\\7\\pwsh.exe\"}; "
             "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments "
             "@{CommandLine=\"`\"$pwsh`\" -NoProfile -ExecutionPolicy Bypass -File `\"$o\\.wd-relay.ps1`\"\";CurrentDirectory=$o} "
             "| Select-Object -ExpandProperty ReturnValue"], timeout=30)
    # 注意：绝不能在 WMI 返回后立即 unlink 中继脚本——WMI 是异步创建的，
    # 返回 0 只代表创建请求成功，中继进程此刻可能还没读取脚本文件；立即
    # 删除会让 pwsh 找不到脚本而启动失败（2026-09-02 复活失败根因，监控
    # 实证 relay 文件 1s 内消失且看门狗未拉起）。中继自身会自删，这里不做。
    if r.stdout.strip() == "0":
        time.sleep(2)
        wd2 = run(["pwsh", "-NoProfile", "-Command", ps])
        pids2 = [int(x) for x in wd2.stdout.split()] if wd2.returncode == 0 else []
        if pids2:
            ok(f"看门狗已自动复活 pid {pids2[0]}")
        else:
            fail("复活拉起后 2s 复查仍未见进程 — 需人工检查 watchdog.log")
    else:
        fail(f"看门狗复活拉起失败 (ReturnValue {r.stdout.strip() or r.returncode})")

log = OPS / "watchdog.log"
if log.exists():
    tail = log.read_text(encoding="utf-8", errors="replace").splitlines()[-3:]
    print("  watchdog.log 尾部:")
    for ln in tail:
        print(f"    {ln}")

# 4. 启动日志尾部
section("启动链日志")
sw = OPS / "dsh-switch.log"
if sw.exists():
    tail = sw.read_text(encoding="utf-8", errors="replace").splitlines()[-5:]
    for ln in tail:
        print(f"  {ln}")
else:
    print("  (dsh-switch.log 不存在 — 服务从未由启动链拉起)")

# 5. bundles 完整性
section("插件 bundles")
if PROF_PKG.exists():
    prof = json.loads(PROF_PKG.read_text(encoding="utf-8"))
    bundles = prof.get("dsh", {}).get("profile", {}).get("bundles", [])
    own = [b for b in bundles if not b.startswith(OFFICIAL_PREFIX)]
    missing = [b for b in own if b not in prof.get("dependencies", {})]
    ok(f"共 {len(bundles)} 项（官方 {len(bundles) - len(own)} + 自研 {len(own)}）")
    print(f"  自研: {', '.join(own)}")
    if missing:
        fail(f"bundles 里声明但 dependencies 缺 link: {missing}")
else:
    fail(f"profile package.json 不存在: {PROF_PKG}")

# 6. 闸门 + 回归
if "--quick" in sys.argv:
    section("闸门/回归")
    print("  (--quick 跳过)")
else:
    for script, label in (("validate-plugins.mjs", "闸门"), ("test-standard.mjs", "回归")):
        section(label)
        r = run(["node", script], cwd=OPS, timeout=120)
        last = (r.stdout.strip().splitlines() or ["(无输出)"])[-1]
        print(f"  {last}")
        if r.returncode != 0:
            fail(f"{label} 未过（exit {r.returncode}）")
        else:
            ok(f"{label} 通过")

# 总结
print("\n" + "=" * 46)
if issues:
    print(f"HEALTH: 异常 {len(issues)} 项")
    for i, m in enumerate(issues, 1):
        print(f"  {i}. {m}")
    sys.exit(1)
print("HEALTH: 全绿")
