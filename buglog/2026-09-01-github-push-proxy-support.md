---
date: "2026-09-01T15:53:53.423Z"
symptom: "GitHub 绑定探测超时无法推送（直连 443 不通），且绑定路径非 git 仓库"
component: "dsh-github-push"
severity: "major"
status: "fixed"
root_cause: "本机无代理配置且直连 GitHub 443 被网络环境阻断；绑定路径指向非 git 仓库目录导致探测失败"
fix: "git.js/ops.js/rpc.js/store.js/client.js：runGit 支持 proxy 透传，新增 settings RPC 端点与网络设置 UI，绑定路径改为 git 仓库目录，代理设为 127.0.0.1:7688"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\git.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\ops.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\rpc.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\store.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\client.js"
  - "C:\\Users\\Administrator\\.dsh\\github-push\\state.json"
---

用户添加 GitHub 绑定后无法工作：git ls-remote 直连 github.com:443 失败（Failed to connect to github.com port 443，超时 21 秒，无代理配置，本机 VPN 代理在 127.0.0.1:7688）。同时用户绑定的本地路径 E:\DSH 不是 git 仓库（.git 在子目录 DSH-ops/Deepseek_DSH）。修复：1) git.js runGit 增加 proxy 选项（HTTP(S)_PROXY/http_proxy/https_proxy 透传，仅显式传入时覆盖环境）；2) ops.js probeRepo/lsRemoteHash/pushRepo 透传 proxy 给网络调用；3) rpc.js 增加 settings.get/settings.set 端点、proxyFor() 解析（插件设置优先，回退 shell 环境变量）、state 快照携带 settings、所有 git 调用接入 proxy；4) store.js normalizeState 增加 settings 字段 + getSetting/setSetting；5) client.js 增加「网络设置」区块（代理地址输入+保存，纵向布局无滚动条）；6) 按用户选择把绑定路径改为 E:/DSH/DSH-ops、代理写入 http://127.0.0.1:7688（先备份再原子改写 state.json）。验证：经代理 ls-remote 成功、探测正常（isRepo:true main 26 处改动）、不再超时。目标仓库 DSH_RuanJian 为空仓库（size=0、无分支，pushed_at=今天），首次推送将创建 main 分支。产品 index.js 18.5kb→20.3kb、client 22.8kb→24.6kb；闸门 9/9、回归 4/4 全绿。
