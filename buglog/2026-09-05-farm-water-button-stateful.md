---
date: "2026-09-05T04:44:47.418Z"
symptom: "田地浇水按钮一直显示，未按需浇水/除虫/收获状态隐藏"
component: "banmu-admin/logic view + 文字版前端"
severity: "major"
status: "fixed"
root_cause: "后台投影只以 tu_di_kuo_jian>0 判 unlocked，未透传水位值，前端无条件渲染浇水按钮，未对齐游戏服\"据 tk==1 才可浇\"的权威前置。"
fix: "buildGrid 透传 land_state；前端按钮改为 v-if 按缺水/虫灾/干旱/成熟状态显示。"
related_files:
  - "banmu-admin/server/src/modules/logic/logic.service.ts"
  - "banmu-admin/web/src/api/modules.ts"
  - "banmu-admin/web/src/views/logic/index.vue"
---

用户反馈浇水按钮不需要一直显示，要做成状态按钮：需浇水才显示浇水、需除虫才显示除虫、可收获才显示收获。根因：游戏服权威语义"浇水按钮据 tu_di_kuo_jian==1 才可用"（game_actions.js L1679 注释，BUG-090 同链），但后台 buildGrid 只用 tu_di_kuo_jian>0 判 unlocked，未透传具体水位值，前端无法判定缺水。解决：buildGrid 暴露 land_state（0/1/2），api 类型加 land_state，世界地图田地列表状态按钮串行（除虫/解救干旱/浇水/收获/铲除/种植），我的花坊浇水 v-if=needWater&&!mature 且湿润显示"土壤湿润"标签，生长文案加待浇水标记。验证：部署后 888 grid 81 块 land_state 各值正确；实测种植 slot0→land_state=1（显示浇水）→farm_water→land_state=2（隐藏浇水）。
