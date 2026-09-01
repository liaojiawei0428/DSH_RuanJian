# dsh-bug-log

DSH 系统组件：持久化 BUG 知识库。任何会话中发现并修复的 BUG 都被结构化记录，
供后续 AI 会话快速定位与查阅。遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md)。

## 工作方式（四层）

1. **记录层** `bug_report` 工具：修复 BUG 后强制调用，schema 保证结构统一
   （症状/根因/修复/组件/严重度/状态/关联文件/详情），原子写入
   `buglog/YYYY-MM-DD-<slug>.md`（frontmatter + 正文），自动重建 `INDEX.md`
2. **检索层** `bug_search` 工具：按关键词/组件/严重度/状态/时间窗过滤，
   返回匹配记录摘要——排查问题前的第一步
3. **统计层** `bug_stats` 工具：按组件/严重度/月份/状态聚合计数
4. **召回层**：系统提示段（每次请求渲染）声明强制记录规则 + "先搜后查"引导；
   兜底启发式（`tools/result` + `agent/turn-stopping` 事件）检测
   "错误→修复"形态但无记录的 turn，写入 pending 提示，下次会话注入补录提醒

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `buglogDir` | 仓库内 `buglog/`（自定位：从插件位置上两级推导，任意盘符/父目录均正确） | 共享记录目录（git 双机同步）；仅当布局偏离约定时覆盖 |

部署在 profile `cordis.patch.yml` 覆盖：

```yaml
# 一般无需配置（默认自定位）；仅布局偏离约定时覆盖：
- id: bug-log
  name: dsh-bug-log
  config:
    buglogDir: '<盘符>:/DSH/DSH-ops/buglog'
```

## 记录纪律（强制）

- 修复任何 BUG 后、继续下一步前，**必须**调用 `bug_report`——未记录视为任务未完成
- 排查任何异常前，**先** `bug_search`——历史记录通常已含根因与修复
- `status: workaround` 的记录表示绕过未根治，需持续关注

## 安装

1. profile `package.json` `dependencies` 加：
   `"dsh-bug-log": "link:<盘符>:/DSH/DSH-ops/plugins/dsh-bug-log"`
2. `dsh.profile.bundles` 数组追加 `"dsh-bug-log"`
3. profile 目录 `pnpm install`，重启服务（预检闸门自动运行）

## 验证

- `--dump-config` 组合树出现 `id: bug-log` 行
- 新会话工具列表含 `bug_report` / `bug_search` / `bug_stats`
- 记录一条后 `buglog/INDEX.md` 自动更新

## 已知边界

- 兜底启发式是"错误→成功修改"形态学检测，可能漏报（无工具失败的静默 BUG）
  或偶发误报（提醒文案允许声明"非 BUG 修复"后忽略）
- 检索为子串匹配，非语义检索；记录量级上千前足够
- 事件监听为 best-effort，任何异常都不影响 turn 正常收尾
