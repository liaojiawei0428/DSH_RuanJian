---
date: "2026-08-23T08:16:49.327Z"
symptom: "冒烟测试中 speaker verify 调用报 \"ma-bridge JSON 解析失败: Unexpected non-whitespace character after JSON at position 103\"。"
component: "memory-assistant-plugins"
severity: "major"
status: "fixed"
root_cause: "speaker_id.verify 返回值与桥接信封同为 {\"ok\": true, ...} 结构，lastIndexOf('{\"ok\"') 定位到嵌套的内层对象，截取起点错误导致 JSON 不平衡。"
fix: "packages/ma/lib/src/index.ts runBridge 改为行级解析：split(/\\r?\\n/) 过滤含 {\"ok 的行取最后一行，行内 indexOf('{\"ok\"') 至 lastIndexOf('}') 截取。"
related_files:
  - "packages/ma/lib/src/index.ts"
  - "python/ma-engine/speaker_id.py"
---

M3 audio 插件冒烟测试时，lib runBridge 用 out.lastIndexOf('{"ok"') 定位信封 JSON，再截到最后 '}'。speaker verify 的返回值结构为 {"ok": true, "match": true, ...}，与桥接层信封 {"ok": true, "data": {...}} 键相同：封装时外层信封内嵌了相同键的数据对象。lastIndexOf 定位到内层 {"ok"，导致截取的字符串缺失外层 "{"ok": true, "data": " 前缀且末尾多一个 }，JSON.parse 报 "Unexpected non-whitespace character after JSON at position 103"。诊断过程：逐项排除 CRLF/print 混入（手工 pwsh 输出干净），用逐字符/尾部 charcode 诊断确认 raw 内容后才定位到嵌套键问题。修复：改为行级解析——取 stdout 按行分割后最后一个含 {"ok 的行，行内用 indexOf 取第一个 {"ok 到最后一个 }。验证：完整链路冒烟（tts→asr 回环、speaker verify、capture probe、memory stats）全部通过。
