---
date: "2026-09-04T02:29:27.200Z"
symptom: "players 黑名单接口返回空列表且移出失败，私聊误判拉黑拦截"
component: "banmu-admin-server players.service"
severity: "major"
status: "fixed"
root_cause: "asObject 对 JSON 数组返回 {}（!Array.isArray ? obj : {}），normalizeBlacklist 经 asObject 后黑名单数组永远解析为空。"
fix: "正常化 normalizeBlacklist：字符串先 JSON.parse 判数组返回 string[]，再退回 asObject 对象键集。"
related_files:
  - "banmu-admin/server/src/modules/players/players.service.ts"
---

聊天全链路回归中发现：玩家 hei_ming_dan 列值为 ["test_user_999"]（JSON 数组字符串），但 GET /players/:id/blacklist 返回 blacklist:[]，DELETE 报"不在黑名单中"，导致该玩家私聊被误判"对方在您的黑名单中"。根因：normalizeBlacklist 先经 asObject(val)，其内部对 JSON 数组返回 {}（!Array.isArray ? obj : {}），Object.keys({}) 为空 → 永远返回 []。DB TEXT 列读回是字符串，必须显式 JSON.parse 判数组。修复：字符串先 JSON.parse，Array 则 map(String)，否则退回对象键集。重建部署后 GET 返回 ["test_user_999"]、DELETE 成功、私聊 send 恢复。对比：fuwuqi.parseBlackArray 与 game_actions.normalizeBlacklist 的解析顺序（先 parse 判数组）正确，仅 players.service 漏判。
