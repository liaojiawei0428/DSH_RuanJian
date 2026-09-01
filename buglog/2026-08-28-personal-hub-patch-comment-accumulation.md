---
date: "2026-08-28T09:48:56.543Z"
symptom: "每次 reapply 后 cordis.patch.yml 头部注释越积越多：deepseek-balance 注释重复 3 次、pwsh-sandbox 块前堆孤儿注释，文件不收敛"
component: "dsh-personal-hub"
severity: "major"
status: "fixed"
root_cause: "parsePatchBlocks 把第一个 - id: 之前的所有行（含旧托管块的前置注释）全归文件头并原样保留，而 managed 块又重新生成新注释——旧注释永不清除，每轮净增；且旧注释与所属块分离后语义错乱。"
fix: "parsePatchBlocks 重写归属语义：头区=首个空行前全部行；块=紧邻 # 注释组(preamble)+- id: 块体；被空行与任何块隔开的注释判为孤儿、重建时丢弃（自愈）。rebuild 时托管块丢旧 preamble 改用清单 comment 字段；foreign 块保留 preamble+body。清单 patch.comment 可选字段承载人类注释。验证：连续两次 reapply，第二次 patch.yml sha256 与第一次完全一致（幂等不动点）。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
  - "E:\\DSH\\DSH-ops\\personal-hub\\personal.json"
---

发现过程：第一次 reapply 后目检 patch.yml diff，Compare-Object 显示注释行错位；双跑收敛测试（reapply 两次比对 sha256）后目检确认：头区保留官方 3 行注释、三个托管块各带清单 comment、无孤儿。hash 序列 62c60c686657 -> d90d7f11c8bf -> d90d7f11c8bf，第二次不动 = 幂等不动点达成。顺带发现 Object.keys(Map) 恒为 [] 导致 status summary 恒显 0 条 patch，一并修正为 managed.size。
