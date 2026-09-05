---
date: "2026-09-05T05:55:06.663Z"
symptom: "图鉴永不解锁、精炼找不到图鉴、图鉴等级奖励从未生效"
component: "banmu-server/game_actions.js + 后台 view"
severity: "major"
status: "fixed"
root_cause: "图鉴 id（2000+i 预生成）与植物 id（4000+）无映射表，且游戏服无任何图鉴解锁路径，导致图鉴相关机制（dengji 奖励/精炼）全部不可达。"
fix: "plant_defs.tujian_id 映射 + plantTujianMap 缓存 + 收获自动解锁 + UPDATE 写回 tu_jian + view 下发 tujian_list。"
related_files:
  - "banmu-server/game_actions.js"
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-server/migrations/005_flower_shop_refine.sql"
---

精炼系统开发中发现：玩家图鉴（tu_jian）由建号时预生成 30 个空条目（id=2000+i、is_unlocked=false），游戏服全程无解锁路径（仅后台手动 POST /players/:openid/tujian 批量解锁）；图鉴 id 体系（2001-2030）与植物 id（4000+）无任何映射，导致 harvest 里 getTujianDengjiForProduct(ent.id vs 植物id) 恒失配（图鉴等级 3004 奖励机制从未生效），精炼按植物 id 也找不到图鉴。修复：plant_defs 加 tujian_id 列填 11 条映射；game_actions 缓存 plantTujianMap 并让 getTujianDengji/Ent/StarForProduct 先经映射；farm_harvest 收获成功自动解锁对应图鉴并写回（UPDATE 加 tu_jian）；view 下发 tujian_list（植物名/品级/星级/解锁态）支撑精炼面板。验证：888 解锁图鉴→精炼凡品0→1→2星（随机材料10-20/精华25/30扣减正确）→播种向日葵出"5000|sec:84"（60×(1+0.2×2)）→模拟成熟收获成功产出+1。
