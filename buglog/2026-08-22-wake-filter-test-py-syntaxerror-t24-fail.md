---
date: "2026-08-22T10:05:37.297Z"
symptom: "wake_filter_test.py 首次运行 SyntaxError 且 t24 FAIL、中文输出乱码"
component: "wake_filter_test.py"
severity: "minor"
status: "fixed"
root_cause: "1) Python 语法要求 global 声明必须先于函数体内使用；测试误以为 reload 后需要重新绑定名字。2) 对 load_mode 无文件时保持现状的设计语义理解偏差导致断言预期错误。3) Windows 下 Python 管道重定向 stdout 编码退化为 GBK。"
fix: "t12: 删除多余的 global wf 与 wf = wf2；t24: 复位 _mode 为默认值后再验证 load_mode 返回 normal；文件顶部加 sys.stdout/stderr.reconfigure(encoding='utf-8')。"
related_files:
  - "F:\\QiTa\\banmu\\LuYin_RuanJian\\wake_filter_test.py"
---

为 wake_filter.py 编写 37 项回归测试时发现并修复的三处问题：
1) t12 中 `global wf` 声明在函数体使用 wf 之后，触发 SyntaxError: name 'wf' is used prior to global declaration。实际上 importlib.reload 对同一模块对象原地重载，无需 global 重新赋值，删掉 global 与赋值即可。
2) t24 断言逻辑错误：load_mode() 在文件不存在/读取失败时被设计为保持当前 _mode 不变（except: pass 后 return _mode），而测试先故意把 _mode 置为 selective 再 load，导致返回 selective 而非 normal。修正为：删除文件后先复位 _mode=normal（模拟全新模块默认状态）再验证 load_mode 返回 normal。
3) Windows 控制台/管道重定向下中文 print 输出乱码（stdout 默认退化为 cp936）。在文件顶部用 sys.stdout.reconfigure(encoding='utf-8') 修复。
修复后全部 37 项通过（exit 0），真实持久化文件 work_mode.json/wakewords.json 经备份-删除-恢复流程保持原状。venv 为 sensevoice_onnx_env（Python 3.13.15, pypinyin 0.55.0）。
