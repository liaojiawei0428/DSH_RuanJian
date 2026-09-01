---
date: "2026-09-01T06:30:24.319Z"
symptom: "密码认证的服务器点「测试连接」必报「该认证方式需要密码」"
component: "dsh-server-ssh"
severity: "major"
status: "fixed"
root_cause: "表单密码被 inputOf 塞进 input.password（校验器忽略），而 rpc.testServer 从顶层 args.password 读取，参数从未到达探测层"
fix: "src/client.js buildArgs 增加 password: form.password !== '' ? form.password : undefined"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-server-ssh\\src\\client.js"
---

复核 buildArgs 时发现：inputOf 把表单密码放进 input.password，而 validateServerInput 不识别该字段（故意忽略，保证密码不落盘）；rpc.testServer 读的是顶层 args.password。两条路径错位导致 password/auto 认方式的「测试连接」必报 PASSWORD_REQUIRED。修复：buildArgs 增加顶层 password 字段（form.password 非空时），input.password 保持丢弃语义——密码只参与一次性探测，不入库。
