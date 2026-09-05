---
date: "2026-09-03T07:47:48.356Z"
symptom: "后台编辑玩家昵称保存成功但客户端昵称不变"
component: "banmu-admin-server players-module"
severity: "major"
status: "fixed"
root_cause: "更新逻辑把昵称写入 xin_xi_shu_ju[0].nickname，而客户端/服务端权威字段名为 nicheng"
fix: "players.service.ts updateProfile 昵称写入 entry.nicheng 并删除遗留 entry.nickname"
related_files:
  - "banmu-admin/server/src/modules/players/players.service.ts"
---

验收玩家档案编辑时发现：PUT /players/:openid 改 nickname 后重查/游戏服 load_data 昵称不变。根因：客户端与服务端解析 xin_xi_shu_ju[0] 昵称字段名为 nicheng（parseXinxi 读 src.nicheng、游戏服 parseXinxiShujuArrayFromColumn 读 src.nicheng），而 updateProfile 编辑时按 DTO 键 nickname 写入 entry.nickname，导致数据写了冗余键、真实 nicheng 未更新。修复：编辑映射 nickname→nicheng（entry['nicheng']），并写回前 delete entry['nickname'] 清理历史冗余键。验证：PUT nickname 后 DB xin_xi_shu_ju 为 {nicheng:新值,...} 无冗余键，游戏服 load_data nicheng 同步新值。
