---
date: "2026-08-22T10:14:49.288Z"
symptom: "cancel_test.py 测试 8/9 失败：第二轮请求未发起（_seq==1）或工具调用解析为空"
component: "cancel_test.py"
severity: "minor"
status: "fixed"
root_cause: "多轮测试的响应注册键在 _seq 尚未递增时互相覆盖；批量改写文件时 JSON 转义被消掉一层导致 tool_calls 无法解析。"
fix: "set_response 增加 _pending 预注册计数分配序列号；t1/t2 行恢复 \\\\\" 双重转义。"
related_files:
  - "F:\\QiTa\\banmu\\LuYin_RuanJian\\cancel_test.py"
---

开发 cancel_test.py 过程中出现两个自伤型缺陷导致测试 8/9 失败：(1) set_response 以 FakeClient._seq+1 作为响应注册键，但 _seq 只在 stream() 时递增，连续两次预注册都在 _seq=0 时把第二个响应覆盖到键 1，第一轮就消费停顿流（测试 9 表现为第二轮从未发起、_seq==1）；(2) 批量重写时把 JSON 字符串转义 \\" 消掉一层变成 \"，运行后 tool_calls 的 arguments 值变裸引号，json.loads 抛 JSONDecodeError 被 _stream_once 静默 continue，tool_calls 永远为空（第一轮 valid 空 → chat_stream 直接 break）。修复：(1) 引入 FakeClient._pending 预注册计数，注册键=_seq+_pending，stream() 消费后再减一；(2) 恢复 t1/t2 行的 \\" 双重转义（文件源码 \\" → 运行值 \" → JSON 字符串转义正确）。修复后 11 项全部通过，连续两次运行稳定。
