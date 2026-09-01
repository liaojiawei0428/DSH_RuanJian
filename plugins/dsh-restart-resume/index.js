/**
 * dsh-restart-resume — 重启后自动续聊（host-only）。
 *
 * 解决的问题：AI 在任务中途重启 DSH 服务（装插件、改配置、更新版本）后，
 * 会话虽然会随新进程恢复，但 AI 的当前轮次已被终止，每次都要用户手动发
 * "重启完成了，继续"。本插件把这一步自动化：
 *
 *   1. 重启前：模型调用本插件注册的 `request_restart` 工具。工具以当前
 *      会话 id（exec.agent）+ 一条继续消息写标记文件，随后经 WMI 启动
 *      独立的重启执行者跑 start-dsh-web.ps1 -Restart（执行者不在宿主
 *      Job 内，宿主被脚本终止后它继续拉起新服务）。
 *   2. 重启后：新进程 boot 时 apply 读标记，通过宿主内的
 *      `sessionController.prompt` 以用户身份向原会话注入继续消息——
 *      与浏览器输入框发送走完全相同的官方路径（显式 resume 冷会话、
 *      队列入箱、日志、投影、UI 全部一致），AI 自动接续任务。
 *
 * prompt 的目标服务由官方 session-controller 包提供（服务名
 * `sessionController`，namespace `session`）；请求形状即
 * SessionPromptRequest 的运行时 JSON：requestId/sessionId/mode/content。
 *
 * STANDARD COMPLIANCE (PLUGIN-STANDARD.md):
 *  - P2 zero workspace imports: only node: builtins and injected services.
 *  - P3 minimal injections: `sessionController` 与 `tools` 是硬依赖——
 *    前者负责续聊注入，后者是工具注册入口，均在 inject 中声明等待就绪。
 *  - P5 registrations are effects: 工具注册走 ctx.effect；标记消费是
 *    一次性动作（非注册），以独立异步任务运行且全程捕获错误。
 *  - P6 fail loud: 脚本/标记路径等部署差异走 config 覆盖 + 明确报错；
 *    execute 失败作为工具错误返回。
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 默认继续消息：重启完成后注入会话的用户侧文本。 */
const DEFAULT_RESUME_MESSAGE =
  'DSH 服务已自动重启完成（restart-resume 插件注入）。会话与任务上下文均已保留，' +
  '请从中断处继续完成之前的任务，无需用户再次确认重启。'

/** 续聊标记的最长有效期：超过即视为陈旧残留，丢弃。 */
const MARKER_MAX_AGE_MS = 30 * 60 * 1000

/** 单次启动内 prompt 的重试预算：覆盖 llm/session 依赖晚于本插件就绪的窗口。 */
const RETRY_BUDGET_MS = 10 * 60 * 1000

/** 相邻两次 prompt 重试的间隔。 */
const RETRY_DELAY_MS = 2500

/**
 * Deployment-layout defaults derived from this file's own location, so any
 * drive letter works as long as the sibling layout holds:
 *   <root>/Deepseek_DSH   (official repo)
 *   <root>/DSH-ops        (this repo; this plugin lives at DSH-ops/plugins/…)
 */
const OPS_DIR = resolveOpsDir()

/** 默认重启脚本：与本插件同仓的启动链入口。 */
const RESTART_SCRIPT = join(OPS_DIR, 'start-dsh-web.ps1')

/** 默认标记文件：DSH 运行时数据区（不进 git，不属于用户配置）。 */
const MARKER_PATH = join(
  process.env.DSH_HOME && process.env.DSH_HOME.length > 0
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh'),
  'restart-resume.json',
)

/** Resolve the DSH-ops directory from this module's path (two levels up: plugins/<name>/index.js → DSH-ops). */
function resolveOpsDir() {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', '..')
}

/**
 * Resolve the pwsh 7 executable without hard-coding one machine's install
 * path. Order: DSH_PWSH_PATH override → every PATH entry → the two Program
 * Files default install locations（与 dsh-deepseek-balance 的同名逻辑一致）。
 * @returns the first existing executable path, or undefined.
 */
async function resolvePwsh() {
  const candidates = []
  const override = process.env.DSH_PWSH_PATH
  if (typeof override === 'string' && override.length > 0) candidates.push(override)
  for (const dir of String(process.env.PATH || '').split(';')) {
    if (dir.length > 0) candidates.push(join(dir, 'pwsh.exe'))
  }
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  candidates.push(join(pf, 'PowerShell\\7\\pwsh.exe'))
  candidates.push(join(pf86, 'PowerShell\\7\\pwsh.exe'))
  const seen = new Set()
  for (const candidate of candidates) {
    if (seen.has(candidate.path ?? candidate)) continue
    seen.add(candidate.path ?? candidate)
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch { /* try the next candidate */ }
  }
  return undefined
}

/**
 * Write the resume marker and launch the detached restart script. The marker
 * is written BEFORE spawning: the host process (and this tool call) dies the
 * moment the script kills the old service, so the marker must already be on
 * disk by then.
 * @param markerPath - resume marker file.
 * @param restartScript - start-dsh-web.ps1 path.
 * @param entry - `{ sessionId, requestId, message }` to persist.
 * @returns `{ started: true, pid }` or `{ started: false, error }`.
 */
async function launchRestart(markerPath, restartScript, entry) {
  const pwsh = await resolvePwsh()
  if (pwsh === undefined) {
    return { started: false, error: '未找到 pwsh 7（已尝试 DSH_PWSH_PATH、PATH、Program Files）' }
  }
  await writeFile(markerPath, JSON.stringify({
    sessionId: entry.sessionId,
    requestId: entry.requestId,
    message: entry.message,
    requestedAt: Date.now(),
  }, null, 2), 'utf8')
  return await new Promise((resolve) => {
    let child
    try {
      // 宿主进程持有 Job Object（KILL_ON_JOB_CLOSE）：直接 spawn 的重启脚本
      // 是宿主子进程、自动加入该 Job，会在杀死宿主的瞬间被内核连带终止
      // （2026-08-31 12:37 事故：switch.log 停在"强制停止当前服务"后戛然
      // 而止）。因此由一个短命中继 pwsh 通过 WMI（WmiPrvSE 服务）创建重启
      // 执行者——执行者的父进程是服务而非宿主，不在宿主 Job 内，宿主死亡
      // 波及不到它。中继只活到 WMI 调用返回，无需脱离 Job。
      // detached 依旧不可用：pwsh 7.6 在 DETACHED_PROCESS（无控制台）下启动
      // 即静默退出（同日对照实验：detached exit 0，CREATE_NO_WINDOW 存活）。
      const actor = `"${pwsh}" -NoProfile -ExecutionPolicy Bypass -File "${restartScript}" -Restart`
      const relay = '$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create '
        + `-Arguments @{ CommandLine = '${actor}' }; exit $r.ReturnValue`
      child = spawn(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', relay], {
        stdio: 'ignore',
        windowsHide: true,
        cwd: OPS_DIR,
      })
    } catch (e) {
      resolve({ started: false, error: String(e && e.message ? e.message : e) })
      return
    }
    const timer = setTimeout(
      () => resolve({ started: false, error: '中继进程 15 秒未退出（WMI 服务卡住？）' }),
      15000,
    )
    timer.unref()
    child.once('spawn', () => { child.unref() })
    child.once('error', (e) => { clearTimeout(timer); resolve({ started: false, error: String(e && e.message ? e.message : e) }) })
    child.once('close', (code) => {
      clearTimeout(timer)
      // WMI Win32_Process.Create 的 ReturnValue：0=成功，2=拒绝访问，
      // 9=路径未找到，21=参数无效。
      if (code === 0) resolve({ started: true, pid: child.pid })
      else resolve({ started: false, error: `WMI 创建重启进程失败（中继 exit ${code}）` })
    })
  })
}

/**
 * Consume the resume marker in the freshly booted process: send the continue
 * message into the original session through the official prompt path, then
 * delete the marker. Retries inside this boot cover services that become
 * ready later than us; a missing target session is permanent and drops the
 * marker loud. An expired marker is stale residue from an old attempt.
 * @param ctx - the mounting Cordis context (sessionController already injected).
 * @param markerPath - resume marker file.
 */
async function consumeMarker(ctx, markerPath) {
  const bootAt = Date.now()
  const neverAbort = new AbortController().signal
  for (;;) {
    let marker
    try {
      marker = JSON.parse(await readFile(markerPath, 'utf8'))
    } catch (e) {
      if (e !== null && typeof e === 'object' && e.code === 'ENOENT') return
      ctx.logger.error(`restart-resume: 续聊标记读取失败（删除以防循环）: ${String(e && e.message ? e.message : e)}`)
      await rm(markerPath, { force: true })
      return
    }
    if (Date.now() - Number(marker.requestedAt ?? 0) > MARKER_MAX_AGE_MS) {
      await rm(markerPath, { force: true })
      ctx.logger.warn('restart-resume: 续聊标记已过期（>30 分钟），丢弃')
      return
    }
    try {
      await ctx.sessionController.prompt({
        requestId: String(marker.requestId ?? randomUUID()),
        sessionId: String(marker.sessionId),
        mode: 'queue',
        content: [{ type: 'text', text: String(marker.message ?? DEFAULT_RESUME_MESSAGE) }],
      }, neverAbort)
      await rm(markerPath, { force: true })
      ctx.logger.info(`restart-resume: 已向会话 ${String(marker.sessionId)} 注入继续消息，任务自动接续`)
      return
    } catch (e) {
      const text = String(e && e.message ? e.message : e)
      if (text.includes('session/not-found') || text.includes('not found')) {
        await rm(markerPath, { force: true })
        ctx.logger.error(`restart-resume: 目标会话不存在，标记已删除: ${text}`)
        return
      }
      if (Date.now() - bootAt > RETRY_BUDGET_MS) {
        ctx.logger.error(`restart-resume: 续聊消息重试超预算（保留标记供下次启动消费）: ${text}`)
        return
      }
      await new Promise((resolveDelay) => { setTimeout(resolveDelay, RETRY_DELAY_MS) })
    }
  }
}

/** Cordis plugin name. */
export const name = 'restart-resume'

/**
 * Required services: the official Session API controller（浏览器发消息的
 * 同一宿主内服务）。Restart 后由它把继续消息送回原会话。
 */
export const inject = ['tools', 'sessionController']

/**
 * Register the request_restart tool and consume any pending resume marker.
 * @param ctx - host root context with the sessionController service.
 * @param config - optional overrides: markerPath, restartScript, resumeMessage.
 */
export function apply(ctx, config = {}) {
  const markerPath = typeof config.markerPath === 'string' && config.markerPath.length > 0
    ? config.markerPath
    : MARKER_PATH
  const restartScript = typeof config.restartScript === 'string' && config.restartScript.length > 0
    ? config.restartScript
    : RESTART_SCRIPT
  const defaultResumeMessage = typeof config.resumeMessage === 'string' && config.resumeMessage.length > 0
    ? config.resumeMessage
    : DEFAULT_RESUME_MESSAGE

  ctx.effect(() => ctx.tools.register({
    name: 'request_restart',
    description: '重启 DSH 服务并安排自动续聊。在任务中途需要重启服务（安装/更新插件、改配置、版本更新）时调用它，'
      + '代替手动执行 start-dsh-web.ps1。它会：写入续聊标记 → 经 WMI 启动独立重启进程（不受宿主进程死亡影响）→ 服务重启完成后'
      + '自动以用户身份向本会话发送继续消息，任务全程无人值守。调用后必须立即结束当前回复、不要再调用任何工具（服务即将停止）；'
      + '重启完成后你会自动收到继续消息并从那里继续任务。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        message: {
          type: 'string',
          description: '重启完成后自动发送给本会话的继续消息；默认提醒模型从中断处继续任务。可写明重启原因与接下来要做的事。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['queued', 'note'],
        properties: {
          queued: { type: 'boolean', description: '重启执行者是否已成功启动。' },
          pid: { type: 'number', description: 'WMI 中继进程 id（queued 为 true 时存在；重启执行者由它经 Win32_Process.Create 启动）。' },
          note: { type: 'string', description: '给模型的下一步指引。' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.note }],
    },
    async execute(args, exec) {
      // exec.agent 是官方 agent loop 注入的 Agent 对象（core/tools ToolExecutionInput），
      // 会话 id 在 .id 上；兼容个别 consumer 直接给字符串的形状。
      const agentObj = exec !== undefined && exec.agent !== null && typeof exec.agent === 'object'
        ? exec.agent
        : undefined
      const sessionId = typeof agentObj?.id === 'string' && agentObj.id.length > 0
        ? agentObj.id
        : typeof exec?.agent === 'string' && exec.agent.length > 0
          ? exec.agent
          : undefined
      if (sessionId === undefined) {
        throw new Error('无法确定当前会话（exec.agent 缺失）；请在主任务会话中调用本工具')
      }
      const message = typeof args.message === 'string' && args.message.trim().length > 0
        ? args.message
        : defaultResumeMessage
      const launched = await launchRestart(markerPath, restartScript, {
        sessionId,
        requestId: randomUUID(),
        message,
      })
      if (!launched.started) {
        throw new Error(`重启脚本启动失败：${launched.error}（续聊标记已写入，之后任意一次成功重启都会自动消费）`)
      }
      return {
        queued: true,
        pid: launched.pid,
        note: '重启已排队：服务将在数秒内停止并由独立进程（经 WMI 启动，不受宿主进程死亡影响）重新拉起（日志见 dsh-switch.log）。'
          + '请立即结束当前回复，不要再调用任何工具。服务重启完成后，本会话会自动收到一条继续消息，'
          + '届时请从中断处继续完成任务。',
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'request_restart: 重启服务并自动续聊',
      kind: 'execute',
      content: [{
        type: 'text',
        text: typeof args.message === 'string' && args.message.length > 0 ? args.message : '使用默认继续消息',
      }],
    }),
  }), 'dsh-restart-resume: request_restart tool')

  void consumeMarker(ctx, markerPath)
}
