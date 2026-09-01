---
date: "2026-08-28T01:50:17.712Z"
symptom: "后台场景管理「关联剧情任务」挂载弹窗 500：Unknown column 'SceneTriggerMap.created_at' in 'field list'"
component: "banmu-admin/server scene-trigger-map entity"
severity: "major"
status: "fixed"
root_cause: "手工建表 SQL 与 ORM Entity 定义漂移：表缺 created_at 列而 Entity 映射 createdAt 并在 addTrigger 写入，TypeORM 默认 SELECT 全部实体字段触发 MySQL 未知列错误"
fix: "生产 MySQL 执行 ALTER TABLE scene_trigger_map ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0 并回填；逐列核对 Entity 与表结构（9列对齐），代码零改动"
related_files:
  - "banmu-admin/server/src/entities/scene-trigger-map.entity.ts"
  - "banmu-admin/server/src/modules/scenes/scenes.service.ts"
---

回填 2026-08-25 会话修复（项目 BUGS.md BUG-106 已有完整记录，DSH 知识库缺条目）：手工建表 scene_trigger_map 只建 8 列无 created_at，Entity 却声明 createdAt→TypeORM repo.find 默认 SELECT 全字段→MySQL Unknown column→Nest 500。生产执行 ALTER TABLE 加列并回填 24 行后恢复（TypeORM 实时查询无需重启）。教训：手工建表必须以 Entity 文件为唯一权威逐列核对；后台接口 500 在前端常表现为"板块空白"，先看 Network 响应体。
