---
date: "2026-09-07T09:45:51.248Z"
symptom: "花坊/背包种子显示「物品#ID」、部分种子无法种植"
component: "banmu-server/data（plant_defs/item_defs/shop_items 内容）"
severity: "major"
status: "fixed"
root_cause: "内容表与玩法文档（11A/11B）未对齐：plant_defs 仅 11 种、种子名占位「未命名(n)」，前端显示/可种列表依赖这些表导致匹配失败。"
fix: "008_*.sql 内容补齐 + content_update.js 迁移 + seedGrowthCache 真实生长时间。"
related_files:
  - "banmu-server/migrations/008_plant_defs_100.sql"
  - "banmu-server/migrations/008_shop_seeds_100.sql"
  - "banmu-server/migrations/008_item_names_100.sql"
  - "banmu-server/content_update.js"
  - "banmu-server/game_actions.js"
---

用户反馈：花坊购买的种子没有正确显示名字，且无法种植。根因：前端种子名（itemName()）与可种列表（isSeed/bagSeeds）全靠 plant_defs（catalog plants）与 item_defs 匹配 seed_id；实际 plant_defs 仅 11 种（剧情设计为 100 种 4000-4099），shop_items/item_defs 中 5000-5099 种子大量为「未命名(n)」占位——缺数据/占位导致名字匹配不到、种子不在可种分类。修复：按 11A/11B 图鉴补齐 100 种花（plant_defs 100 行含真实生长分钟与 tujian_id=plant_id-1999、shop_items 96 种子正式命名上架〔凡/精/珍/仙，绝品走剧情〕、item_defs 5000-5099 命名替换），玩家旧图鉴 id 迁移，seedGrowthCache 改用真实 growth_min。验证：花坊 96 种全正式名；5005 栀子·素白可正常购买种植；升级激活图鉴 21 种。
