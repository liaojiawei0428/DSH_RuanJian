---
date: "2026-08-28T09:48:44.122Z"
symptom: "personal_hub_status 工具调用总走 catch 分支，报 manifest not found: E:\\DSH\\DSH-ops\\plugins\\personal-hub\\personal.json"
component: "dsh-personal-hub"
severity: "major"
status: "fixed"
root_cause: "DEFAULT_MANIFEST 推导用两次 path.dirname(fileURLToPath(import.meta.url))——fileURLToPath 得到的是文件路径（index.js），两次 dirname 只到 plugins 目录，少一级。"
fix: "改为三次 path.dirname（文件→插件目录→plugins→ops 根）。验证：mock ctx 下 status 报\"无漂移，清单 5 插件 + 3 条 patch 覆盖\"。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
---

发现过程：personal_hub_status 工具注册成功但首次调用返回 catch 分支（"漂移 0 项："即 ok:false 且 drift 为空）。用 mock ctx（effect 直调 + tools.register 捕获）加载插件并直接调用 execute，得到 summary: "manifest not found: E:\\DSH\\DSH-ops\\plugins\\personal-hub\\personal.json"，精确暴露推导少一级。修复为三次 dirname。后续验证 status 无漂移、reapply 全流程通过。
