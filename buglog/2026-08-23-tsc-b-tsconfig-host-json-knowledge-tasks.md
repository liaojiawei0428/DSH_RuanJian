---
date: "2026-08-23T08:03:40.763Z"
symptom: "tsc -b tsconfig.host.json 对 knowledge/tasks/wake-filter 三个插件报 TS2322：textOutput() 返回的 schema/render 与 ValueSchemaSpec 不兼容（required: boolean、args 类型不匹配）。"
component: "memory-assistant-plugins"
severity: "minor"
status: "fixed"
root_cause: "defineTool 的 output.schema 依赖 contextual typing 推断字面量类型；共享函数返回值失去上下文类型，schema 属性（required/type）被宽化，且无法推导 render 的 args 参数类型。"
fix: "删除 packages/ma/lib 的 textOutput 共享函数，五个工具插件的内联 output（schema + render 直接写在 defineTool 参数中），与已验证的 memory 插件写法一致。"
related_files:
  - "packages/ma/lib/src/index.ts"
  - "packages/ma/knowledge/src/index.ts"
  - "packages/ma/tasks/src/index.ts"
  - "packages/ma/wake-filter/src/index.ts"
---

在批量实现 knowledge/tasks/wake-filter 三个记忆助手工具插件时，为复用工具输出 schema 在 @memory-assistant/dsh-ma-lib 中抽象了 textOutput() 共享函数。tsc -b tsconfig.host.json 报错：共享函数返回值的 schema 丢失字面量类型（required: boolean、type: string 被宽化），且 render 的 args 参数与 defineTool 期望的"解析后参数类型"不兼容（ValueSchemaSpec / Promise<never> 不匹配）。尝试了 as const 与泛型 <A> 两种修复方向：as const 解决了 required 宽化，但泛型参数 A 传入的是参数 schema 对象字面量类型而非解析后参数类型，render 参数仍不兼容。最终判定共享输出 schema 与框架的类型推导模式（contextual typing 内联）不兼容，删除共享 textOutput，五个工具全部改为与 memory 插件一致的内联 output 写法，类型检查通过（TSC EXIT=0），全量构建与运行时冒烟测试（callBridge 链路上真实引擎数据）均通过。教训：DSH defineTool 的 output.schema 依赖 contextual typing，不要在共享函数中抽象输出 schema。
