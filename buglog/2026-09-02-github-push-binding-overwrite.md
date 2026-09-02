---
date: "2026-09-02T07:36:16.824Z"
symptom: "新增仓库绑定后原有绑定被整体覆盖（id 不变内容被换）"
component: "dsh-github-push"
severity: "major"
status: "fixed"
root_cause: "upsertBinding 同 id 覆盖语义 + 新增 id 毫秒碰撞：新绑定可被旧记录 id 复用覆盖，或同毫秒新增互相覆盖"
fix: "store.js 拆分 createBinding/updateBinding + mintBindingId 抗碰撞；rpc.js 按 id 有无分流；client.js 编辑态警告文案"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\store.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\rpc.js"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-github-push\\src\\client.js"
---

用户报告：新增仓库把原有绑定覆盖掉（原 dsh→E:/DSH/DSH-ops 绑定消失，banmufanghua 顶替了它且 id 仍是 bmtiu6ocw）。根因两处：(1) store.upsertBinding 是合并语义——input.id 命中已有记录时 Object.assign(existing, input) 整条覆盖，UI 编辑态/新增态同走此路，一旦 id 复用即覆盖；(2) rpc 层新增 id 用 Date.now().toString(36)，同毫秒两次新增会碰撞出相同 id，第二次直接覆盖第一条。排查：读 state.json 确认旧绑定 id 未变但内容被替换；读 store.js/rpc.js/client.js 完整走查 upsert 链路。修复：store 拆分 createBinding（id 在此铸造、mintBindingId=毫秒36进制+8位随机后缀、while 查重防碰撞、只 push 永不覆盖）与 updateBinding（仅更新已存在 id，缺失抛错防静默变 create）；rpc.upsertBinding 按 input.id 有无严格分流，编辑态带 id 才走 update；client 编辑态加醒目警告文案「正在编辑已有绑定，保存将更新此记录（不会新建）」+ 保存按钮区分「保存/保存更改」。验证：node ESM 行为测试——两次 create id 唯一、update 只改目标、update 缺失 id 抛错、20 次同毫秒快速 create 全唯一、await 写链后重载保留全部记录；gate 9/9、regression 4/4、build ok。多会话绑定独立性已由 setTarget(sessionId→bindingId) map 支持，无需改动。
