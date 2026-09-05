---
date: "2026-09-05T03:01:26.067Z"
symptom: "升级 0.1.3-alpha.1 后点开其他工作区的老会话，GUI 加载即崩（服务端 session/follow 迁移链抛 SessionFormatError）；当前会话正常"
component: "Deepseek_DSH session-format-v0-to-v1（官方迁移链）"
severity: "major"
status: "fixed"
root_cause: "官方 v0→v1 迁移器用严格成员白名单（assertReleasedV0Keys）与 descriptor version 校验对历史 v0 数据 fail-loud：老版本 DSH（8 月中下旬）写出的合法 v0 会话含 assistant/chunk.replayState.kind 成员或 subagent/descriptor version 2，不在后来的\"released v0 词表\"内；升级 0.1.3-alpha.1 引入 v2 迁移链后这些会话每次冷读必抛 SessionFormatError，GUI follow 流失败即\"加载就崩溃\"。此前所有离线验证全过是因为只覆盖了 --E-DSH-- 目录，其他 6 个 cwd 工作区从未被测。"
fix: "已修复（同日，由 2026-09-05-v0-migration-rejects-historical-shapes.md 关闭）：v0→v1 迁移器收录两种历史形状——replayEnvelopeValue 新增扁平 pre-envelope replayState 准入（flatPreEnvelopeReplayValue，固定成员集合），subagentDescriptorValue 接受 version [2,3]，validation.ts 入口条件放宽为非 2/3 才拒；全部 lossless 透传不改写已提交世代。pnpm run build 后磁盘 49/49 会话 open+read 复验全部通过，服务重启后生效。原'不能改官方 checkout（部署纪律）'的判断经用户确认放开（版本台账已有手动修官方源码先例）；官方 checkout 工作树改动待审阅提交。本记录尾部的'子会话直开崩溃链（navigationAddress undefined → session/agent-busy）'是独立导航 bug，仍未修复。"
related_files:
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-format-v0-to-v1\\src\\validation-helpers.ts"
  - "E:\\DSH\\Deepseek_DSH\\packages\\session\\session-format-v0-to-v1\\src\\validation.ts"
  - "E:\\DSH\\Deepseek_DSH\\packages\\api\\session-controller\\src\\history.ts"
---

排查路径：排除服务崩溃（看门狗零介入、err.log 0 字节、多次 -Restart 均为人工）→ 排除导出/分页 RPC（session.export 200、session/page ok）→ 排除投影折叠（14 个定义 × 46 个 v0 会话离线全 OK）→ 全量 7 个 cwd 目录 46 个 v0 会话跑官方迁移链，11 个被拒，全部位于 --E-DSH-- 之外（正是用户点的"其他会话"）。受影响清单：主会话 session-214c1eea（E:\GongJu\Deepseek_DSH）、session-4e02e4a3、session-e8367e00（同上）、session-7a5f7cfe（banmufanghua）= replayState "kind"；子会话 3f39934e、4c7fcc36、56dff0fb、99ce1814、a5e2fd0f、d966021c、f34c2bbc（LuYin_RuanJian）= descriptor v2。writeAt 8 月中下旬，早于 0.1.2-rc.1。另确认子会话直开崩溃链：list 返回 origin=subagent 条目，父目录未刷新时 navigationAddress 返回 undefined → 以 kind:'session' 地址打开 → 服务端 validateAddress 固定抛 session/agent-busy。数据未丢失（文件完好），仅不可读。


**修复（2026-09-05 同日）**：由 [v0-migration-rejects-historical-shapes](2026-09-05-v0-migration-rejects-historical-shapes.md) 关闭，同根因。v0→v1 迁移器收录两种历史形状（扁平 pre-envelope replayState、subagent/descriptor version 2），lossless 透传、不改写已提交世代；重建后 49/49 会话全部可读，服务重启生效。"不能改官方 checkout"的部署纪律判断经用户确认放开。⚠️ 尾部"子会话直开崩溃链（navigationAddress undefined → 服务端 validateAddress 抛 session/agent-busy）"是独立的 GUI 导航 bug，不随本修复恢复，仍待处理。
