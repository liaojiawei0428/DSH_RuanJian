---
date: "2026-09-05T02:00:52.062Z"
symptom: "personal-hub 共享清单硬编码本机绝对路径，其他机器（同一套 DSH 但目录不同）拉取后执行 personal_hub_reapply 会用错误路径重写 profile，或 status 报假漂移"
component: "dsh-personal-hub"
severity: "major"
status: "fixed"
root_cause: "personal-hub 共享清单把机器特定的绝对路径（profileDir/pluginsDir/pythonPath/pwshPath）当作声明数据提交进 git 跨机同步，而 reapply 是\"按清单整体重写 profile\"的破坏性操作，清单不可移植时在其他机器上会把错误路径写入那台机器的 profile。"
fix: "dsh-personal-hub 清单两层化：共享层 personal.json 去机器路径（profileDir/pluginsDir 运行时派生），机器特定覆盖移入 gitignore 的 personal.local.json 深合并；提交 87f8e0e 已推送。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-personal-hub\\index.js"
  - "E:\\DSH\\DSH-ops\\personal-hub\\personal.json"
  - "E:\\DSH\\DSH-ops\\.gitignore"
dsh_commit: "d347e70390"
---

用户澄清"同一套 DSH 环境≠同一目录路径"后复查发现：跨机同步的共享清单 personal.json 硬编码了本机绝对路径（profileDir=C:/Users/Administrator/...、pluginsDir=E:/DSH/...、tool-python 的 pythonPath、pwsh-sandbox 的 pwshPath）。其他机器若路径不同，git 拉取清单后执行 personal_hub_reapply 会把这台机器的路径写进那台机器的 profile（dependencies link 指向不存在目录、patch 指向错误解释器），profile 直接写坏；即使不 reapply，personal_hub_status 也会因路径不匹配报假漂移。此前"漂移 3 项"修复时只补了插件列表，未意识到路径可移植性问题。修复采用两层清单：共享层只保留机器无关的组合意图（插件列表/官方 bundles/patch 注释），profileDir 运行时派生（$DSH_HOME 或 ~/.dsh + profiles/web）、pluginsDir 从插件自身仓库布局派生（与 restart-resume 的 resolveOpsDir 同法），统一转正斜杠保证 link: 规格与线上字节一致；机器特定值移入同目录 personal.local.json（gitignore，plugins 按 name、extraPatches 按 id 深合并，覆盖值优先；非法 JSON fail-loud）。验证：独立 node 脚本以假 ctx 真实加载插件跑合并逻辑 validate+status 零漂移；validate-plugins 闸门 9/9 PASS；request_restart 重启加载新代码后 personal_hub_validate/status 复检零漂移；git ls-files 确认本机覆盖层未被跟踪、check-ignore 命中；已推送 d5219be..87f8e0e。其他机器拉取后无需改共享清单，路径自动派生正确，仅当 pwsh/python 非标准安装时自建 personal.local.json 填本机路径。
