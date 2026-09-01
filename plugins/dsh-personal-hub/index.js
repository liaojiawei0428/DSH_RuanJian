/**
 * dsh-personal-hub — host half.
 *
 * Owns the declarative manifest of the user's personal DSH layer and rebuilds
 * the web profile from it (`personal_hub_reapply`), so an official DSH upgrade
 * never strands personal plugins or config overrides.
 *
 * STANDARD COMPLIANCE (PLUGIN-STANDARD.md):
 *  - P2 zero workspace imports: only node: builtins; a linked install has no
 *    node_modules to resolve @deepseek-ai/* from.
 *  - P3 minimal injections: `tools` is the only hard dependency (this plugin
 *    is model-facing tooling); everything else is node-local.
 *  - P5 registrations are effects: every tool registration is effect-wrapped.
 *  - P6 fail loud at load for config errors; fail as a tool result at runtime.
 *  - D4 user-data writes: backup first, then write temp file + rename (atomic
 *    full-file replace, never line splicing).
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'personal-hub'

/** Hard service dependencies only; see P3 before adding one. */
export const inject = ['tools']

/** Default manifest location: `<ops root>/personal-hub/personal.json`. */
const DEFAULT_MANIFEST = path.join(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),
  'personal-hub',
  'personal.json',
)

/** Profile files the hub owns. Backed up before any write (D4). */
const PROFILE_FILES = ['package.json', 'cordis.patch.yml', 'cordis.yml']

/** Longest wait for one `pnpm install` inside the profile directory. */
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Plugin body.
 * @param ctx - host root context.
 * @param config - resolved plugin config: `{ manifestPath?: string }`.
 */
export function apply(ctx, config = {}) {
  const manifestPath = typeof config.manifestPath === 'string' && config.manifestPath.length > 0
    ? config.manifestPath
    : DEFAULT_MANIFEST

  ctx.effect(() => ctx.tools.register({
    name: 'personal_hub_status',
    description: 'Compare the personal-hub manifest against the live web profile '
      + '(dependencies, bundles, patch entries) and report drift. Read-only.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'drift', 'summary'],
        properties: {
          ok: { type: 'boolean' },
          drift: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.ok ? `无漂移：${value.summary}` : `漂移 ${value.drift.length} 项：\n${value.drift.join('\n')}` }],
    },
    async execute() {
      try {
        return statusReport(manifestPath)
      } catch (err) {
        return { ok: false, drift: [], summary: `status failed: ${err.message}` }
      }
    },
  }), 'register personal_hub_status')

  ctx.effect(() => ctx.tools.register({
    name: 'personal_hub_validate',
    description: 'Validate the personal-hub manifest: structure, plugin directories on disk, '
      + 'unique ids, and official-bundle separation. Read-only; reapply refuses to run when this fails.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'errors'],
        properties: {
          ok: { type: 'boolean' },
          errors: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.ok ? '清单校验通过' : `清单校验失败 ${value.errors.length} 项：\n${value.errors.join('\n')}` }],
    },
    async execute() {
      try {
        return validateManifest(manifestPath)
      } catch (err) {
        return { ok: false, errors: [`validate failed: ${err.message}`] }
      }
    },
  }), 'register personal_hub_validate')

  ctx.effect(() => ctx.tools.register({
    name: 'personal_hub_reapply',
    description: 'Rebuild the web profile from the personal-hub manifest: back up the profile '
      + 'files, rewrite package.json dependencies/bundles and the managed sections of '
      + 'cordis.patch.yml (official blocks preserved), then run pnpm install in the profile. '
      + 'Restart the DSH service afterwards to load the rebuilt layer.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'actions'],
        properties: {
          ok: { type: 'boolean' },
          actions: { type: 'array', items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `重新适配完成：\n${value.actions.map(a => `- ${a}`).join('\n')}\n下一步：重启 DSH 服务使新组合生效。`
          : `重新适配失败：${value.error}\n已执行步骤：\n${value.actions.map(a => `- ${a}`).join('\n')}`,
      }],
    },
    async execute() {
      try {
        return reapply(manifestPath)
      } catch (err) {
        return { ok: false, actions: [], error: err.message }
      }
    },
  }), 'register personal_hub_reapply')
}

/** Read + structurally validate the manifest; throws with a readable message on failure. */
function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`)
  const raw = readFileSync(manifestPath, 'utf8')
  let manifest
  try {
    manifest = JSON.parse(raw)
  } catch (err) {
    throw new Error(`manifest is not valid JSON (${manifestPath}): ${err.message}`)
  }
  return manifest
}

/**
 * Full validation pass shared by the validate tool and reapply's precondition.
 * @returns `{ ok, errors }`; `errors` is empty when ok.
 */
function validateManifest(manifestPath) {
  const errors = []
  let manifest
  try {
    manifest = readManifest(manifestPath)
  } catch (err) {
    return { ok: false, errors: [err.message] }
  }

  if (!Array.isArray(manifest.officialBundles) || manifest.officialBundles.length === 0) {
    errors.push('officialBundles must be a non-empty array')
  }
  if (typeof manifest.profileDir !== 'string' || manifest.profileDir.length === 0) {
    errors.push('profileDir must be a non-empty string')
  } else if (!existsSync(path.join(manifest.profileDir, 'package.json'))) {
    errors.push(`profileDir has no package.json: ${manifest.profileDir}`)
  }
  if (typeof manifest.pluginsDir !== 'string' || manifest.pluginsDir.length === 0) {
    errors.push('pluginsDir must be a non-empty string')
  }
  if (!Array.isArray(manifest.plugins)) {
    errors.push('plugins must be an array')
    return { ok: false, errors }
  }

  const seen = new Set()
  const official = new Set(manifest.officialBundles ?? [])
  for (const entry of manifest.plugins) {
    if (typeof entry?.name !== 'string' || !/^dsh-[a-z0-9-]+$/.test(entry.name)) {
      errors.push(`plugin name must match dsh-<role>: ${JSON.stringify(entry?.name)}`)
      continue
    }
    if (seen.has(entry.name)) errors.push(`duplicate plugin name: ${entry.name}`)
    seen.add(entry.name)
    if (official.has(entry.name)) errors.push(`${entry.name} is also listed in officialBundles`)
    const pluginDir = path.join(manifest.pluginsDir, entry.name)
    if (!existsSync(path.join(pluginDir, 'package.json'))) errors.push(`plugin directory missing package.json: ${pluginDir}`)
    else if (!existsSync(path.join(pluginDir, 'index.js'))) errors.push(`plugin directory missing index.js: ${pluginDir}`)
    if (entry.patch !== undefined) {
      if (entry.patch === null || typeof entry.patch !== 'object' || Array.isArray(entry.patch)) errors.push(`${entry.name}: patch must be an object`)
      else if (entry.patch.config !== undefined && (entry.patch.config === null || typeof entry.patch.config !== 'object')) errors.push(`${entry.name}: patch.config must be an object`)
    }
  }
  if (manifest.extraPatches !== undefined) {
    if (!Array.isArray(manifest.extraPatches)) errors.push('extraPatches must be an array')
    else {
      for (const patch of manifest.extraPatches) {
        if (typeof patch?.id !== 'string' || patch.id.length === 0) errors.push('every extraPatches entry needs a string id')
        if (typeof patch?.name !== 'string' || patch.name.length === 0) errors.push('every extraPatches entry needs a string name')
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Split cordis.patch.yml into units with strict comment ownership so repeated
 * reapplies converge instead of accumulating orphan comments:
 *  - header  = everything before the first blank line (the file's top block);
 *  - a block = the immediately-preceding run of `#` comment lines (its
 *    preamble, no blank line between) plus everything from its `- id:` line;
 *  - comments separated from any `- id:` by a blank line are orphans and are
 *    dropped on rebuild (self-healing; comments are not machine contract).
 */
function parsePatchBlocks(text) {
  const lines = text.split(/\r?\n/)
  let headEnd = 0
  while (headEnd < lines.length && lines[headEnd].trim().length > 0) headEnd++
  const header = lines.slice(0, headEnd)
  const blocks = []
  let current = null
  let pending = []
  for (const line of lines.slice(headEnd)) {
    const m = /^- id:\s*(\S+)\s*$/.exec(line)
    if (m !== null) {
      if (current !== null) blocks.push(current)
      current = { id: m[1], preamble: [...pending], lines: [line] }
      pending = []
    } else if (current !== null) {
      current.lines.push(line)
    } else if (line.trim().length > 0) {
      pending.push(line)
    } else {
      pending = []
    }
  }
  if (current !== null) blocks.push(current)
  return { header, blocks }
}

/** Read one managed block's `name:` and `config:` sub-entry back into an object. */
function blockIdentity(block) {
  let blockName
  const configEntries = []
  let inConfig = false
  for (const line of block.lines) {
    if (line.startsWith('  config:')) { inConfig = true; continue }
    if (inConfig) {
      const m = /^\s{4}([A-Za-z0-9_-]+):\s*(.+?)\s*$/.exec(line)
      if (m !== null) configEntries.push([m[1], unquoteYaml(m[2])])
      else if (line.trim().length > 0 && !line.startsWith('    ')) inConfig = false
    } else if (line !== block.lines[0]) {
      const m = /^\s{2}name:\s*(.+?)\s*$/.exec(line)
      if (m !== null) blockName = unquoteYaml(m[1])
    }
  }
  return { name: blockName, config: Object.fromEntries(configEntries) }
}

/** Undo the single-quoted YAML scalar form this plugin writes. */
function unquoteYaml(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  return trimmed
}

/** Render one manifest patch entry as a managed YAML block (single-quoted scalars). */
function renderManagedBlock(entry, comment) {
  const lines = [`# ${comment}`, `- id: ${entry.id}`]
  const nameText = typeof entry.name === 'string' ? entry.name : String(entry.name)
  lines.push(`  name: '${nameText.replace(/'/g, "''")}'`)
  if (entry.config !== undefined && entry.config !== null && Object.keys(entry.config).length > 0) {
    lines.push('  config:')
    for (const [key, value] of Object.entries(entry.config)) {
      lines.push(`    ${key}: '${String(value).replace(/'/g, "''")}'`)
    }
  }
  return lines
}

/**
 * Managed ids: personal plugins that declare a `patch` field (even `{}`) plus
 * every extraPatches entry. Plugins without a patch declaration need no
 * cordis.patch.yml presence — the bundle name alone mounts the row.
 */
function managedIds(manifest) {
  const ids = new Map()
  for (const plugin of manifest.plugins) {
    if (plugin.patch === undefined) continue
    ids.set(plugin.name.replace(/^dsh-/, ''), { kind: 'plugin', name: plugin.name, patch: plugin.patch })
  }
  for (const patch of manifest.extraPatches ?? []) {
    ids.set(patch.id, { kind: 'extra', name: patch.name, patch: patch.config !== undefined ? { config: patch.config } : {} })
  }
  return ids
}

/**
 * Rebuild cordis.patch.yml: managed ids are regenerated from the manifest in
 * manifest order (plugins first, then extraPatches); every foreign block keeps
 * its preamble and body byte-for-byte; orphan comments are dropped.
 */
function rebuildPatchYaml(existingText, manifest) {
  const { header, blocks } = parsePatchBlocks(existingText)
  const managed = managedIds(manifest)
  const foreign = blocks.filter(block => !managed.has(block.id))
  const managedLines = []
  for (const [id, entry] of managed) {
    if (managedLines.length > 0 || foreign.length > 0) managedLines.push('')
    const patch = { id, name: entry.name, ...entry.patch }
    const comment = typeof patch.comment === 'string' && patch.comment.length > 0
      ? patch.comment
      : `personal-hub managed (${entry.kind}; regenerate via personal_hub_reapply)`
    managedLines.push(...renderManagedBlock(patch, comment))
  }
  const kept = foreign.map(block => [...block.preamble, ...block.lines].join('\n').trimEnd())
  const parts = []
  const headerText = header.join('\n').trimEnd()
  if (headerText.length > 0) parts.push(headerText)
  if (kept.length > 0) parts.push(kept.join('\n\n'))
  if (managedLines.length > 0) parts.push(managedLines.join('\n'))
  return parts.join('\n\n') + '\n'
}

/** Compare the manifest against the live profile files; returns drift lines. */
function statusReport(manifestPath) {
  const manifest = readManifest(manifestPath)
  const drift = []
  const packageJsonPath = path.join(manifest.profileDir, 'package.json')
  const live = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

  const expectedDeps = Object.fromEntries(manifest.plugins.map(p => [p.name, `link:${manifest.pluginsDir}/${p.name}`]))
  const liveDeps = live.dependencies ?? {}
  for (const [name, target] of Object.entries(expectedDeps)) {
    if (liveDeps[name] === undefined) drift.push(`dependencies 缺少 ${name}（应为 ${target}）`)
    else if (liveDeps[name] !== target) drift.push(`dependencies ${name} = ${liveDeps[name]}，应为 ${target}`)
  }
  for (const name of Object.keys(liveDeps)) {
    if (expectedDeps[name] === undefined) drift.push(`dependencies 多出非清单项 ${name}`)
  }

  const expectedBundles = [...(manifest.officialBundles ?? []), ...manifest.plugins.map(p => p.name)]
  const liveBundles = live.dsh?.profile?.bundles ?? []
  if (JSON.stringify(liveBundles) !== JSON.stringify(expectedBundles)) {
    drift.push(`bundles = [${liveBundles.join(', ')}]，应为 [${expectedBundles.join(', ')}]`)
  }

  const patchText = readFileSync(path.join(manifest.profileDir, 'cordis.patch.yml'), 'utf8')
  const { blocks } = parsePatchBlocks(patchText)
  const managed = managedIds(manifest)
  const byId = new Map(blocks.map(b => [b.id, b]))
  for (const [id, entry] of managed) {
    const block = byId.get(id)
    if (block === undefined) { drift.push(`cordis.patch.yml 缺少托管条目 id ${id}`); continue }
    const actual = blockIdentity(block)
    if (actual.name !== entry.name) drift.push(`patch 条目 ${id} name = ${actual.name}，应为 ${entry.name}`)
    const want = entry.patch.config ?? {}
    for (const [key, value] of Object.entries(want)) {
      if (actual.config[key] !== String(value)) drift.push(`patch 条目 ${id} config.${key} = ${actual.config[key]}，应为 ${value}`)
    }
    for (const key of Object.keys(actual.config)) {
      if (want[key] === undefined) drift.push(`patch 条目 ${id} config.${key} 不在清单中`)
    }
  }
  for (const block of blocks) {
    if (!managed.has(block.id)) drift.push(`cordis.patch.yml 存在非托管条目 id ${block.id}（保留，不计为错误，仅供知悉）`)
  }

  return { ok: drift.length === 0, drift, summary: `清单 ${manifest.plugins.length} 个插件 + ${managed.size} 条 patch 覆盖，profile ${manifest.profileDir}` }
}

/** Atomic full-file replace (D4): write `<file>.personal-hub-tmp`, rename over the target. */
function atomicWrite(filePath, content) {
  const tmp = `${filePath}.personal-hub-tmp`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, filePath)
}

/** Backup the owned profile files; returns the backup directory. */
function backupProfile(profileDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(homedir(), '.dsh', 'backups', `${stamp}-personal-hub`)
  mkdirSync(backupDir, { recursive: true })
  for (const file of PROFILE_FILES) {
    const source = path.join(profileDir, file)
    if (existsSync(source)) copyFileSync(source, path.join(backupDir, file))
  }
  return backupDir
}

/** One reapply pass: validate → backup → rewrite → pnpm install. */
function reapply(manifestPath) {
  const actions = []
  const validation = validateManifest(manifestPath)
  if (!validation.ok) return { ok: false, actions, error: `清单校验未通过：\n${validation.errors.join('\n')}` }
  const manifest = readManifest(manifestPath)
  const profileDir = manifest.profileDir

  const backupDir = backupProfile(profileDir)
  actions.push(`已备份 profile 文件到 ${backupDir}`)

  const packageJsonPath = path.join(profileDir, 'package.json')
  const livePackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  livePackage.dependencies = Object.fromEntries(manifest.plugins.map(p => [p.name, `link:${manifest.pluginsDir}/${p.name}`]))
  livePackage.dsh = { ...(livePackage.dsh ?? {}), profile: { ...(livePackage.dsh?.profile ?? {}), bundles: [...manifest.officialBundles, ...manifest.plugins.map(p => p.name)] } }
  atomicWrite(packageJsonPath, JSON.stringify(livePackage, null, 2) + '\n')
  actions.push('package.json 已按清单重写（dependencies + dsh.profile.bundles）')

  const patchPath = path.join(profileDir, 'cordis.patch.yml')
  const patchText = readFileSync(patchPath, 'utf8')
  atomicWrite(patchPath, rebuildPatchYaml(patchText, manifest))
  actions.push('cordis.patch.yml 托管条目已按清单重生成（官方块原样保留）')

  const install = spawnSync('pnpm install --reporter append-only', {
    cwd: profileDir,
    encoding: 'utf8',
    timeout: INSTALL_TIMEOUT_MS,
    env: { ...process.env },
    // The command string is a hardcoded literal; a shell is the portable way
    // to reach pnpm.cmd on Windows (post CVE-2024-27980 a bare spawnSync of a
    // .cmd fails with EINVAL).
    shell: true,
  })
  if (install.error !== undefined) {
    return { ok: false, actions, error: `pnpm install 启动失败：${install.error.message}` }
  }
  if (install.status !== 0) {
    const tail = `${install.stdout ?? ''}\n${install.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n')
    return { ok: false, actions, error: `pnpm install 退出码 ${install.status}：\n${tail}` }
  }
  actions.push('pnpm install 完成')

  const after = statusReport(manifestPath)
  actions.push(after.ok ? '复检无漂移' : `复检仍有漂移：\n${after.drift.join('\n')}`)
  return { ok: after.ok, actions }
}
