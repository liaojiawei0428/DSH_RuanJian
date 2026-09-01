---
date: "2026-08-28T09:29:10.831Z"
symptom: "升级 DSH 0.1.2-alpha.1 后，会话头部两个胶囊（DeepSeek 余额、DSH 版本）从页面消失；Host API 200/ok:true、validate-plugins 全绿、boot manifest 含条目、/plugins combo 200，无任何报错。"
component: "dsh-deepseek-balance"
severity: "major"
status: "fixed"
root_cause: "0.1.2 的 web boot 对全部 client 模块并发激活：官方 client 插件靠模块导出 `inject: ['slots']` 获得 loader 的服务就绪门控（loader 持有 apply 直到 slots 服务被 provide）；自研 client.js 是旧版形态，只导出 `apply`（无 inject 声明），apply 在 ui-renderer provide('slots') 之前执行，`ctx.get('slots')` 返回 undefined，代码 `if (slots === undefined) return` 静默退出——两个胶囊都不注册。0.1.1-rc.2 时代顺序挂载恰好让 slots 先就绪，掩盖了缺失声明。佐证：client/modules slot-catalog 规则原文 \"declare `inject: ['slots']` in your returned plugin (object form) or the seat is withheld\"。"
fix: "plugins/dsh-deepseek-balance/client.js：新增 `exports.inject = ['slots']`（对象插件属性，loader 门控读取）；undefined 分支由静默 return 改为 console.warn。node --check 语法 OK，validate-plugins 4/4 PASS。服务重启使内容寻址 rev 更新后浏览器加载新 bundle。"
related_files:
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-deepseek-balance\\client.js"
---

排查路径：① 分发链全通（boot manifest 第46项含 balance、combo 200/10008 字节——注意 /plugins 路由带 token 必 404，须无 token 探测）→ 收敛执行期。② 对照官方 packages/session-query/session-log-export/src/client/index.ts：`export const inject = ['slots','locale']` + apply。③ 读 packages/client/web/src/boot.ts：loader.create 循环后 `await loader.await()` 并发激活，"Reject entries that ... still wait on missing services" 即 inject 门控。④ 读 packages/client/ui-renderer/src/client/registry.ts:134 `super(ctx, 'slots')` 确认服务 key 未变。⑤ ui-slots SlotCore.register：向未声明 slot 注册会 throw，但 slots.inject(key, factory) 会等待声明出现，非本根因。教训：validate-plugins 对 client 只做 node --check 语法解析，验证不了运行时挂载；审查结论必须区分语法层与渲染层。
