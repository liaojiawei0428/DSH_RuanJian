---
date: "2026-09-04T08:06:58.698Z"
symptom: "玩家土地状态 JSON 中出现 \"NaN\" 键（文字版空参数开垦触发）"
component: "banmu-server/game_actions.js"
severity: "major"
status: "fixed"
root_cause: "landSlotKey(undefined) 返回 'NaN'，且 NaN 与数字比较恒 false 导致索引校验失效，脏键被写入 JSON 列。"
fix: "farm_land_expand 空 slot 自动找首块空地并清理 'NaN' 残留键。"
related_files:
  - "banmu-server/game_actions.js"
---

在验证植物品级生长时间时，view 快照发现 test_user_888 的 tu_di_zhuang_tai 与 tu_di_kuo_jian 出现 `"NaN": 1` 脏键。定位：farm_land_expand handler 直接用 landSlotKey(payload.slot)——文字版「开垦一块新土地」按钮 payload 不带 slot（{}），Number(undefined)=NaN → 'NaN' 键通过 idx<0/idx>=81 校验（NaN 比较皆 false）后写入 td['NaN']=1。后果：脏数据膨胀；虽然后台 buildGrid 已过滤非整数的键，但服务端数据持续污染。修复：payload.slot 缺失时自动开垦 0..cap 内第一块空地（找不到返回 no_land），并在写前清理历史残留的 'NaN' 键；实测 farm_land_expand {} 自动开垦 slot10 成功且 DB LIKE '%NaN%'=0。顺带验证：凡品向日葵 60 秒成熟（新种立即收获 400 未成熟、61 秒后收获成功），品级映射（凡60/精300/珍6000/仙60000/绝300000 秒）生效。
