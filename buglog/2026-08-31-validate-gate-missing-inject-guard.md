---
date: "2026-08-31T05:12:55.009Z"
symptom: "插件漏写 inject 声明时闸门 PASS 但服务加载失败：闸门 mock ctx 的服务属性是普通对象，不模拟 Cordis 运行时守卫，同类缺陷未来仍会漏检"
component: "DSH-ops/validate-plugins.mjs"
severity: "major"
status: "fixed"
root_cause: "闸门 stub gap：validate-plugins.mjs 的 mockContext 未复刻 Cordis 的 inject 守卫（ctx.<service> 属性访问要求 inject 声明，违者 loader 抛错且服务 fail-fast 拒绝启动），导致 stub 绿、运行时红。"
fix: "validate-plugins.mjs 的 mockContext 用 Proxy 复刻 Cordis inject 守卫：非框架内置属性访问若未在插件 inject 数组声明即抛 \"cannot get property '<name>' without inject\"；调用点从 module.inject 读取声明清单传入。"
related_files:
  - "E:\\DSH\\DSH-ops\\validate-plugins.mjs"
  - "E:\\DSH\\DSH-ops\\plugins\\dsh-restart-resume\\index.js"
---

发现过程：复盘 dsh-restart-resume 导致服务启动失败事件时检查闸门源码，mockContext 的 ctx 是普通对象，ctx.tools 等服务属性直接可访问，完全没有复刻 Cordis 的 inject 守卫——这正是当时"闸门全绿、服务起不来"漏检的机制。启动失败链路：插件 apply() 里 ctx.tools.register(...) 但未声明 export const inject = ['tools',...] → 真实 Cordis loader 的守卫抛 cannot get property "tools" without inject → failed to apply loader entry → DSH 以 fail-fast 语义拒绝启动（link 插件是组合的一部分，任一插件 apply 抛错则服务进程在绑端口前死亡）→ start-dsh-web.ps1 30 秒轮询超时，3 次尝试全灭。修复：mockContext 改为 Proxy 实现——框架内置（get/effect/on/logger）免声明；其余任何属性访问都要求出现在插件的 export const inject 数组中，否则抛与 Cordis 一致的错误；已声明但 mock 未实现的服务（如 sessionController）解析为 undefined。验证：7 个现有插件回归全 PASS；临时坏插件（无 inject 访问 ctx.tools）阳性测试被拦，报错与运行时逐字一致。局限：闸门只能拦"apply() 同步阶段"的缺陷；apply 异步延迟抛错、运行时才触发的问题（如启动消费标记的路径）仍需真实重启验证，README 开发循环已写明。
