/**
 * dsh-plugin-guide — browser half (client bundle).
 *
 * Embeds Chinese plugin names and one-line purpose descriptions into the
 * official plugin inventory page: every card's expandable details block gains
 * two rows ("中文名" / "功能说明") that clone the official `dl.details` row
 * structure, so they inherit the page's own layout and theme. Plugins missing
 * from the built-in dictionary are left untouched.
 *
 * Mechanism: the official inventory tab renders through React with no slot
 * inside the card details, so this plugin watches the DOM with a
 * MutationObserver and appends the rows whenever a card's details block
 * (`li[data-plugin-module] … div[id^="plugin-details-"] dl`) appears — including
 * on every re-expand, because React rebuilds the details node each time. The
 * observer callback is coalesced into one microtask scan and rows are marked
 * via `dataset` so re-scans are no-ops.
 *
 * This file is a hand-written client bundle in the platform's module-loader
 * format: `window.__ModuleLoader__.load({ id, factory })`. It consumes no
 * Cordis service, so `inject` stays empty and apply runs immediately; the
 * observer and its teardown belong to the plugin fiber through ctx.effect.
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-guide',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    /**
     * Chinese display dictionary keyed by the normalized module short name
     * (same normalization as the official inventory tab: strip `@deepseek-ai/`,
     * `cordis:`, `cordis-plugin-` and `dsh-(host-|client-)?` prefixes).
     * Each value is [中文名, 一句话功能说明]. Missing keys degrade gracefully.
     */
    const GUIDE = {
      // ---- Host 基础设施 ----
      'timer': ['定时器服务', '统一的超时、延时与周期任务调度入口'],
      'hmr': ['热更新桥', '插件包更新后免重启替换生效'],
      'llm': ['大模型能力', 'LLM 抽象能力层：模型调用统一入口'],
      'deepseek-llm-api-extensions': ['DeepSeek API 扩展', 'DeepSeek 专属 API 能力扩展（前缀续写等）'],
      'llm-deepseek': ['DeepSeek 提供方', 'DeepSeek 官方 API 模型接入'],
      'llm-pi-ai': ['Pi.AI 提供方', '第三方 Pi.AI 模型接入'],
      'llm-retry': ['调用重试', '模型调用失败自动重试与退避'],
      'typert': ['类型图核心', '接口类型图谱生成与运行时注册表'],
      'typert-loader': ['类型图加载器', '类型图谱的加载与装配'],
      'typert-gateway': ['RPC 网关', '基于 Typert 的 RPC 网关装配'],
      'webserver': ['Web 服务器', '页面与 API 的 HTTP 服务'],
      'web-startup': ['Web 启动', 'Web 面启动装配流程'],
      'web-runtime': ['Web 运行时', 'Web 面运行期装配'],
      'client-hmr': ['客户端热更新', '浏览器端 HMR 接收器'],
      'storage': ['存储抽象', '键值/文档存储统一接口'],
      'storage-json': ['JSON 存储', 'JSON 文件存储实现'],
      'storage-domain': ['存储域', '按域隔离的存储命名空间'],
      // ---- 会话 ----
      'session': ['会话核心', '会话对象与生命周期管理核心'],
      'session-log-deepseek': ['会话日志编码', 'DeepSeek 格式的会话日志编码'],
      'session-persistence-jsonl': ['会话持久化', '会话日志以 JSONL 落盘保存'],
      'session-query-sqlite': ['会话查询', 'SQLite 索引的会话历史查询'],
      'session-projection': ['会话投影', '会话日志到界面状态的投影'],
      'session-projection-cache': ['投影缓存', '会话投影结果的缓存加速'],
      'session-telemetry-otel': ['遥测上报', 'OpenTelemetry 遥测数据上报'],
      'session-title': ['会话标题', '自动为会话生成标题'],
      'session-title-llm': ['标题生成', '用大模型为会话起标题'],
      'session-checkpoint-policy': ['检查点策略', '会话检查点的保存时机裁决'],
      'session-stats': ['会话统计', '会话用量统计信息'],
      'session-controller': ['会话控制面', '会话控制 API 装配'],
      'session-reference': ['会话引用', '@ 引用其他会话的解析'],
      'session-log-download': ['日志下载', '会话日志导出下载'],
      'settings-controller': ['设置控制面', '用户设置 API 控制面'],
      'workspace': ['工作区', '工作区对象与生命周期管理'],
      'workspace-controller': ['工作区控制面', '工作区 API 控制面'],
      'workspace-projection': ['工作区投影', '工作区状态到界面的投影'],
      // ---- 智能体与循环 ----
      'agent': ['智能体核心', 'Agent 抽象与编排核心'],
      'agent-loop': ['智能体循环', '模型与工具交互的执行主循环'],
      'agent-default-model': ['默认模型', '为智能体会话选择默认模型'],
      'agent-instructions': ['智能体指令', 'AGENTS.md 等指令文件的发现与注入'],
      'agent-presets': ['预置组合', '内置 agent 预置组合定义'],
      'subagent-model-selection-settings': ['子代理模型设置', '子代理模型选择设置项'],
      // ---- 工具链 ----
      'tools': ['工具中枢', '模型工具注册表'],
      'system-prompt': ['系统提示词', '系统提示词段落组装'],
      'tool-bash': ['Bash 工具', '模型可调用的 bash 命令执行'],
      'tool-pwsh': ['PowerShell 工具', '模型可调用的 pwsh 命令执行'],
      'tool-fs': ['文件工具', '模型的文件读取、写入与编辑入口'],
      'tool-fs-search': ['文件搜索工具', 'glob 路径匹配与 grep 内容搜索'],
      'tool-web': ['网络工具', '网页搜索与抓取的模型入口'],
      'tool-jobs': ['任务工具', '后台任务的模型操作入口'],
      'tool-skill': ['技能工具', '模型加载技能内容的入口'],
      'tool-todo': ['任务清单工具', '维护当前工作的任务计划清单'],
      'tool-goal': ['目标工具', '会话级完成目标的读写'],
      'tool-ralph': ['Ralph 循环', '新鲜代理迭代循环执行'],
      'tool-str-replace-editor': ['文本编辑工具', '字符串替换式精确文件编辑'],
      'tool-subagent': ['子代理委派', '委派独立任务给子代理'],
      'tool-subagent-fork': ['会话分叉', '派生继承当前会话的子代理'],
      'tool-subagent-report': ['子代理报告', '读取子代理的最终结果'],
      'tool-subagent-control': ['子代理控制', '中断子代理当前轮次'],
      'tool-subagent-list-agents': ['子代理清单', '列出可续聊的子代理'],
      'tool-workflow': ['工作流工具', '多代理编排工作流执行'],
      'code-runtime': ['代码运行时', 'Python 等代码执行运行时'],
      'web': ['网络能力', '网页搜索与抓取能力层'],
      'web-search-deepseek': ['网页搜索', 'DeepSeek 搜索提供方'],
      'web-fetch-http': ['网页抓取', 'HTTP 抓取提供方'],
      'subprocess': ['子进程', '子进程执行与进程树管理'],
      'sandbox': ['沙箱', '命令与文件操作的沙箱框架'],
      'sandbox-policy': ['沙箱策略', '沙箱模式选择与策略裁决'],
      'bash-sandbox': ['Bash 沙箱', 'bash 命令的沙箱执行实现'],
      'pwsh-sandbox': ['PowerShell 沙箱', 'pwsh 命令的沙箱执行实现'],
      'fs-sandbox': ['文件沙箱', '文件访问的沙箱约束'],
      'fs-observation-policy': ['文件观察策略', '文件系统读观察策略（如先读后写）'],
      'approval': ['审批', '敏感操作的审批请求流'],
      'permission': ['权限', '工具权限模式与会话级权限控制'],
      'shell-env': ['Shell 环境', 'shell 环境变量与工作目录管理'],
      'timeout-policy': ['超时策略', '工具执行超时裁决'],
      'spill-local': ['本地溢出', '工具大结果的本地落盘'],
      'spill-policy': ['溢出策略', '工具大结果转存规则'],
      'tool-result-pruner': ['结果修剪', '工具历史结果的修剪与省略'],
      'repeat-tool-reminder': ['重复提醒', '重复调用同一工具时的提醒'],
      'token-meter': ['用量计量', 'token 用量统计'],
      'compaction-basic': ['上下文压缩', '压缩历史释放上下文窗口'],
      // ---- 技能 / 命令 / 交互 ----
      'skill': ['技能注册', '技能提供方注册表'],
      'skill-filesystem': ['文件技能', '从文件系统目录加载技能'],
      'skill-badge': ['技能徽标', '技能元数据徽标'],
      'commands': ['命令', '斜杠命令注册表'],
      'command-feedback': ['反馈命令', '消息点赞点踩命令'],
      'command-goal': ['目标命令', '目标相关斜杠命令'],
      'command-compact': ['压缩命令', '手动触发上下文压缩'],
      'user-questions': ['用户提问', '向用户发起澄清提问'],
      'goal': ['目标', '会话级持久完成目标'],
      'goal-round-driver': ['目标轮驱动', '目标自动续轮推进'],
      'plan-mode': ['计划模式', '先出计划获批再实施'],
      'message-feedback': ['消息反馈', '会话消息的点赞点踩'],
      'jobs': ['后台任务', '后台任务队列与生命周期管理'],
      'settings': ['设置服务', '用户设置的读写与变更分发'],
      'credentials': ['凭据管理', 'API 密钥等凭据的安全存取'],
      'attachment-local': ['本地附件', '本地文件作为会话附件'],
      'directory-picker': ['目录选择器', '服务端目录浏览选择'],
      'subagent': ['子代理', '子代理生命周期与注册'],
      'subagent-spawn-in-process': ['进程内子代理', '同进程派生子代理实现'],
      'subagent-fork-in-process': ['进程内分叉', '会话分叉子代理实现'],
      'workflow-worker-thread': ['工作流线程', 'worker 线程运行工作流脚本'],
      // ---- 清单 / 装配 ----
      'plugin-inventory': ['插件清单服务', '宿主插件清单盘点（设置页数据源）'],
      'plugin-package-inventory-deepseek': ['插件包盘点', '插件包级清单盘点服务'],
      'cordis-host-runner': ['动态插件(宿主)', '动态插件的宿主半边运行时'],
      'cordis-client-runner': ['动态插件(浏览器)', '动态插件的浏览器半边运行时'],
      'modules': ['客户端模块表', '动态 bundle 模块的装载与供应'],
      'connection': ['连接层', '页面与宿主的传输世代与 RPC 通道'],
      'api-remotes': ['远程接口', '宿主服务的浏览器端类型化调用'],
      // ---- Client UI ----
      'ui-theme': ['主题', '主题 token 与全局样式'],
      'locale': ['多语言', '语言字典与 t 翻译函数'],
      'ui-layout': ['页面布局', '整体框架布局'],
      'ui-renderer': ['渲染器', '插件 UI 的 React 渲染集成'],
      'ui-session': ['会话区基础', '会话区基础 UI 装配'],
      'ui-sidebar': ['侧栏', '左侧会话与工作区侧栏'],
      'ui-settings': ['设置框架', '设置区框架与分区'],
      'ui-settings-general': ['通用设置', '通用偏好设置页'],
      'ui-settings-models': ['模型设置', '模型与凭据设置页'],
      'ui-settings-plugin-inventory': ['插件清单页', '已挂载插件的盘点展示页'],
      'ui-settings-plugins': ['插件设置页', '可配置插件的设置卡片'],
      'ui-conversation': ['对话区', '消息流与输入框'],
      'ui-approval': ['审批界面', '审批请求卡片'],
      'ui-chat': ['消息渲染', '消息气泡与富文本渲染'],
      'ui-brand-official': ['品牌标识', '官方品牌标记'],
      'ui-attachment': ['附件界面', '附件上传与展示'],
      'ui-tool': ['工具卡片', '模型工具调用卡片'],
      'ui-cordis': ['动态插件面板', '动态插件 Run 卡片与面板'],
      'ui-workflow-run': ['工作流卡片', '工作流执行过程展示'],
      'ui-deliverables': ['交付物', '会话产出文件展示'],
      'ui-workspace': ['工作区界面', '工作区界面'],
      'ui-input-trigger': ['输入触发', '输入框触发器（@ 引用等）'],
      'ui-commands': ['命令菜单', '斜杠命令菜单'],
      'ui-skill': ['技能界面', '技能展示'],
      'ui-subagent': ['子代理界面', '子代理面板'],
      'ui-reference': ['引用渲染', '@ 引用的消息内渲染'],
      'ui-schedule': ['定时任务', '计划任务界面'],
      'ui-jobs': ['任务界面', '后台任务展示'],
      'ui-goal': ['目标界面', '目标状态展示'],
      'ui-message-feedback': ['反馈按钮', '消息反馈按钮'],
      'ui-model-selection': ['模型选择', '会话模型切换'],
      'ui-permission': ['权限界面', '权限模式设置行'],
      'ui-agent-preset': ['预置切换', 'agent 预置选择器'],
      'ui-plan': ['计划界面', '计划模式界面'],
      'ui-user-questions': ['提问界面', '用户提问卡片'],
      'ui-trajectory': ['执行轨迹', '执行轨迹展示'],
      // ---- 个人插件 ----
      'locale-language': ['界面语言', '通用设置里的界面语言切换行（个人插件）'],
      'deepseek-balance': ['余额胶囊', '会话头部显示 DeepSeek 账户余额与版本胶囊（个人插件）'],
      'tool-python': ['Python 工具', '模型可调用的 Python 代码执行（个人插件）'],
      'bug-log': ['BUG 知识库', '持久化 bug 记录的检索与记录工具（个人插件）'],
      'personal-hub': ['个人配置器', '个人插件层的声明式清单管理与漂移修复（个人插件）'],
      'plugin-guide': ['插件说明', '本插件：在插件清单卡片里注入中文说明（个人插件）'],
    }

    /** Normalize a module specifier the same way the official inventory tab does. */
    function shortName(moduleName) {
      const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
      return unscoped
        .replace(/^cordis:/, '')
        .replace(/^cordis-plugin-/, '')
        .replace(/^dsh-(?:host-|client-)?/, '')
    }

    /**
     * Append the two Chinese rows into one card's details list, cloning the
     * official row structure (`div > dt + dd`) so the page's own layout and
     * theme apply. Skips cards without a details block, entries not in the
     * dictionary, and details blocks already enhanced (dataset marker).
     */
    function enhanceCard(card) {
      const moduleName = card.getAttribute('data-plugin-module')
      if (moduleName === null || moduleName === '') return
      const guide = GUIDE[shortName(moduleName)]
      if (guide === undefined) return
      const details = card.querySelector('div[id^="plugin-details-"] dl')
      if (details === null || details.dataset.dspgGuide === '1') return
      details.dataset.dspgGuide = '1'

      const nameRow = document.createElement('div')
      const nameDt = document.createElement('dt')
      nameDt.textContent = '中文名'
      const nameDd = document.createElement('dd')
      nameDd.textContent = guide[0]
      nameRow.append(nameDt, nameDd)

      const descRow = document.createElement('div')
      const descDt = document.createElement('dt')
      descDt.textContent = '功能说明'
      const descDd = document.createElement('dd')
      descDd.textContent = guide[1]
      descRow.append(descDt, descDd)

      details.append(nameRow, descRow)
    }

    /** Enhance every inventory card currently in the document. */
    function scanAll(root) {
      const cards = root.querySelectorAll('li[data-plugin-module]')
      for (const card of cards) enhanceCard(card)
    }

    let scanScheduled = false
    /** Coalesce observer bursts into one microtask scan (also breaks the echo loop). */
    function scheduleScan() {
      if (scanScheduled) return
      scanScheduled = true
      queueMicrotask(() => {
        scanScheduled = false
        scanAll(document.body)
      })
    }

    /** Browser-half entry: watch the page and enhance inventory cards as they render. */
    function apply(ctx) {
      const observer = new MutationObserver(scheduleScan)
      observer.observe(document.body, { childList: true, subtree: true })
      ctx.effect(() => () => { observer.disconnect() }, 'dsh-plugin-guide: observer')
      scanAll(document.body)
    }

    exports.inject = []
    exports.apply = apply
    return module.exports
  },
})
