---
date: "2026-09-03T04:17:40.446Z"
symptom: "后台玩家档案接口对存在的玩家返回 found=false，档案页无数据"
component: "banmu-admin-server players-module"
severity: "major"
status: "fixed"
root_cause: "Player entity 未映射全部列且虚构不存在的 id 主键，createQueryBuilder/getRawOne 查询不可靠；列表接口用的原生 SQL 一直正常"
fix: "players.service.ts fetchRow 由 createQueryBuilder getRawOne 改为原生 SQL manager.query SELECT * LIMIT 1"
related_files:
  - "banmu-admin/server/src/modules/players/players.service.ts"
---

重构玩家档案时手工验证发现 GET /api/admin/players/test_user_888 返回 found=false，尽管 MySQL 直查 players 表该行存在。排查：旧 findByOpenid 用 playerRepo.createQueryBuilder('p').where('p.yong_hu_id = :id').getRawOne()，而 Player entity 只映射 7 列且虚构 @PrimaryGeneratedColumn id（表真实主键是 yong_hu_id），getRawOne 结果与实体映射错位/查询行为不可靠（列表接口用的原生 manager.query 一直正常）。修复：fetchRow 改用 this.playerRepo.manager.query('SELECT * FROM players WHERE yong_hu_id = ? LIMIT 1', [openid])，与 listPlayers 同一可靠路径。验证：档案接口 found=true，21 列全量解析展示正确（base/currency/progress/farm/inventory/friend/collection/quest/meta 全部有值）。
