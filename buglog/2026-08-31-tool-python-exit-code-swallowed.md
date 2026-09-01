---
date: "2026-08-31T09:30:42.821Z"
symptom: "python 工具非零退出码全部显示为 [exit code: 1]：sys.exit(3) 实测显示 1，模型永远看不到脚本真实退出码"
component: "dsh-tool-python"
severity: "minor"
status: "fixed"
root_cause: "PowerShell 7 的 -Command 退出码规则：不传播尾部原生命令的 $LASTEXITCODE，任何非零值塌缩为 1；只有显式 exit N 语句才传播。插件命令结尾是原生命令调用，缺少一级显式退出码传播"
fix: "index.js 中 command 尾部追加 `; exit $LASTEXITCODE`，把 python 的退出码显式提升为 pwsh 进程退出码；闸门+回归全绿后经 request_restart 重启服务加载，实测 [exit code: 3] 正确显示"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-tool-python\\index.js"
---

用户要求检查 dsh-tool-python 功能时发现。注册层正常（闸门 PASS），运行层验证 sys.exit(3) 却得到 [exit code: 1]。对照实验双线定位：pwsh 工具跑 `cmd /c exit 5` 也得 [exit code: 1]，而 `exit 5` 得 5——锁定 PowerShell 7 -Command 规则：不传播尾部原生命令的 $LASTEXITCODE（非零一律塌缩为 1），显式 exit N 才传播。python 工具的命令结尾是原生命令 `& python.exe script.py`，故真实退出码永远丢失。修复为命令尾缀 `; exit $LASTEXITCODE` 并注释 load-bearing 原因。影响面评估：修复前所有非零 python 退出都显示 1，模型无法区分退出码语义（如 argparse 的 2、断言失败的 1 与自定义码），脚本仍能收到 stderr 故多数失败可诊断，属正确性缺陷非功能性中断。修复后验证：sys.exit(3)→[exit code: 3]，正常退出无标记无回归，闸门 7/7 + test-standard 4/4。附带确认：pwsh 工具本身行为符合 pwsh -Command 规则（用户脚本显式 exit 才传播），非 bug。
