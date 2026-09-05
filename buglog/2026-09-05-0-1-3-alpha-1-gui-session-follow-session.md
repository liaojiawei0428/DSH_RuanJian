---
date: "2026-09-05T03:01:26.067Z"
symptom: "升级 0.1.3-alpha.1 后点开其他工作区的老会话，GUI 加载即崩（服务端 session/follow 迁移链抛 SessionFormatError）；当前会话正常"
component: "Deepseek_DSH session-format-v0-to-v1（官方迁移链）"
severity: "major"
status: "open"
root_cause: "官方 v0→v1 迁移器用严格成员白名单（assertReleasedV0Keys）与 descriptor version 校验对历史 v0 数据 fail-loud：老版本 DSH（8 月中下旬）写出的合法 v0 会话含 assistant/chunk.replayState.kind 成员或 subagent/descriptor version 2，不在后来的\"released v0 词表\"内；升级 0.1.3-alpha.1 引入 v2 迁移链后这些会话每次冷读必抛 SessionFormatError，GUI follow 流失败即\"加载就崩溃\"。此前所有离线验证全过是因为只覆盖了 --E-DSH-- 目录，其他 6 个 cwd 工作区从未被测。"
fix: "本机无法修复：不能改写已提交的会话世代（官方 adjacent-migration 红线），不能改官方 checkout（部署纪律）。已离线精确复现并列出全部 11 个受影响会话；等待官方把 replayState.kind 与 descriptor v2 收录进 released v0 词表（或迁移器宽容化）后自然恢复。缓解认知：受影响会话每次冷读都走 v0→v2 迁移故每次必炸；已 resume 过的活动会话已有 v2 日志，不受影响。"
related_files:
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-format-v0-to-v1\\src\\validation-helpers.ts"
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-format-v0-to-v1\\src\\validation.ts"
  - "E:\\DSH\\Deepseek_DSH\\packages\\api\\session-controller\\src\\history.ts"
---

排查路径：排除服务崩溃（看门狗零介入、err.log 0 字节、多次 -Restart 均为人工）→ 排除导出/分页 RPC（session.export 200、session/page ok）→ 排除投影折叠（14 个定义 × 46 个 v0 会话离线全 OK）→ 全量 7 个 cwd 目录 46 个 v0 会话跑官方迁移链，11 个被拒，全部位于 --E-DSH-- 之外（正是用户点的"其他会话"）。受影响清单：主会话 session-214c1eea（E:\GongJu\Deepseek_DSH）、session-4e02e4a3、session-e8367e00（同上）、session-7a5f7cfe（banmufanghua）= replayState "kind"；子会话 3f39934e、4c7fcc36、56dff0fb、99ce1814、a5e2fd0f、d966021c、f34c2bbc（LuYin_RuanJian）= descriptor v2。writeAt 8 月中下旬，早于 0.1.2-rc.1。另确认子会话直开崩溃链：list 返回 origin=subagent 条目，父目录未刷新时 navigationAddress 返回 undefined → 以 kind:'session' 地址打开 → 服务端 validateAddress 固定抛 session/agent-busy。数据未丢失（文件完好），仅不可读。
