---
date: "2026-09-05T08:28:08.458Z"
symptom: "mysql CLI 用 JSON path 复合访问 players 的 tu_jian/bei_bao JSON 列恒报 ERROR 3143/1054，无法 SQL 直读嵌套字段"
component: "banmu-server 线上环境"
severity: "minor"
status: "workaround"
root_cause: "腾讯云 cynos 5.7.18-2.1.14 MySQL JSON path 解析器对带引号数字键+后继层级、以及无引号纯数字键的访问路径报错（`$.\"1\"` 单层可，复合/数字键不可），属数据库变体解析缺陷而非 SQL 写法错误。"
fix: "验证/查询绕开 JSON path：SELECT 整列后在 Node/Python 端 JSON.parse 取值；bug 库与 BUGS.md 记录 BUG-146 警示后续后台/运维勿对 cynos 库写多层 JSON path。"
related_files:
---

精炼随机需求部署验证链中，用 mysql CLI 执行 JSON_EXTRACT(tu_jian,'$."1".star') 查测试号 888 图鉴星级，报 ERROR 3143 (Invalid JSON path expression around position 6)。排查过程：`'$."1"'` 单层引号键正常返回对象；追加 `.star` 后缀即 3143；`'$.1003'`（无引号数字键）同样 3143；`'$."1"."star"'` 报 1054 Unknown column 'tu_jian'。逐一排除了 heredoc 反斜杠转义（`'$.\"1\".star'` heredoc 内反斜杠字面化）与双引号标识符歧义（`"$.\"1\".star"` 被 MySQL 当标识符）后，确认等价标准 MySQL 5.7 语法合法写法全部失败，判定为腾讯云 cynos 5.7.18-2.1.14 变体 JSON path 解析器缺陷（带引号数字键后继访问/纯数字键访问不支持）。游戏服务端 Node(mysql2) 从未使用 JSON_EXTRACT，全程整列读取+JSON.parse，不受影响；本次 jing_lian_xu_qiu 存档功能不依赖该语法。已改验证链为 SELECT 整列后本地解析，全链路验证通过。
