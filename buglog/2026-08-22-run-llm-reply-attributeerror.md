---
date: "2026-08-22T10:08:57.718Z"
symptom: "传入非生成器迭代器时 _run_llm_reply 报 AttributeError 并误入错误分支"
component: "speech_cli.py"
severity: "minor"
status: "workaround"
root_cause: "_run_llm_reply 的 finally 中 gen.close() 假设流对象为生成器；通用迭代器会抛 AttributeError 并误判为流错误。"
fix: "测试内使用生成器函数返回流对象（支持 gen.close()）；产品代码保持不变（生产路径恒为生成器）。"
related_files:
---

编写 regress_core_test.py（66 项）过程中，test_64 selective 模式用例给 r1.chat_stream 传 list_iterator 而非生成器，_run_llm_reply 的 finally 块调用 gen.close() 抛 AttributeError（list_iterator 无 close），被外层 except 捕获后置 _had_error=True，导致 [SKIP] 分支判断错误。生产路径 r1.chat_stream 总是生成器（有 close），故不构成线上 bug；但该假设未显式文档化。已在测试中改用生成器对象规避，产品代码未改动。附带记录：本次编写中发现 8 处测试断言/构造错误并已全部修复（漏定义 client、_split_xml 前置初始化、0.25→0.2 银行家舍入、ISO 时间断言、空条目构造、executor 返回结构）。
