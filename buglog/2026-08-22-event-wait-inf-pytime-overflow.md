---
date: "2026-08-22T10:07:21.425Z"
symptom: "cancel_test.py 运行到停顿流测试时报 \"timestamp out of range for C PyTime_t\"，线程内异常被记入 errors 导致断言失败"
component: "cancel_test.py"
severity: "minor"
status: "fixed"
root_cause: "Windows 上 threading.Event.wait(float('inf')) 的 timeout 参数被转换为 C PyTime_t 时溢出（timestamp out of range），并非 r1_client 的逻辑问题。"
fix: "FakeResp.iter_lines 中当 stall==float(\"inf\") 时改调 self._closed_evt.wait()（无超时参数），不再传 inf。"
related_files:
  - "F:\\QiTa\\banmu\\LuYin_RuanJian\\cancel_test.py"
---

在编写 cancel_test.py 模拟"永久停顿流"（等连接关闭）时，用 threading.Event().wait(float("inf")) 实现无限阻塞，运行后抛出 "timestamp out of range for C PyTime_t"。排查：CPython threading.Event.wait(timeout) 在 Windows 上会把 timeout 转成 C PyTime_t 再调用 WaitForSingleObject，inf 溢出报错；而 Event.wait() 无参调用是原生的无限等待，不经过 PyTime_t 转换。修复：FakeResp.iter_lines 中 inf 分支改为 self._closed_evt.wait() 无参调用，有限停顿仍用 wait(秒数)。修复后测试 4/5/8/9/10 的停顿场景全部通过。
