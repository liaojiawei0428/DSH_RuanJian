---
date: "2026-08-22T07:00:40.483Z"
symptom: "调用 MemoryEngine.stats()（如 memory_query 工具 stats 动作）抛 NameError: name 'os' is not defined"
component: "memory_engine.py"
severity: "major"
status: "open"
root_cause: "memory_engine.py 模块作用域未导入 os，stats() 引用 os.path 导致 NameError"
fix: "在 memory_engine.py 文件头补 import os（待修，本次仅审查未改动）"
related_files:
  - "memory_engine.py"
  - "speech_cli.py"
---

审查 11 核心模块时发现：memory_engine.py 文件头 import 列表（第 9-16 行）为 sqlite3/sqlite_vec/threading/numpy/typing/json/from config import DB_PATH，没有 import os；但 stats() 第 252 行使用 os.path.getsize 和 os.path.exists。AST 静态分析确认 imports 集合不含 os 而源码含 os. 引用。speech_cli.py:961 在 memory_query 工具的 stats 动作中调用 memory.stats()，命中即抛 NameError: name 'os' is not defined。与 BUGS.md/CHANGELOG 无重合记录（bug_search 未命中）。其余模块（knowledge_engine/tasks/wake_filter）均正确导入 os。
