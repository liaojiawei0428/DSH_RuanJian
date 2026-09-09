#!/usr/bin/env node
/**
 * validate-plugins.mjs — pre-restart gate for linked DSH profile plugins.
 *
 * The 13:05 incident class: a plugin whose ctx.tools.register() call throws
 * (e.g. an output schema outside the registry's JSON Schema dialect) fails the
 * loader loudly and the server process dies before binding its port. The
 * composition dump cannot catch it — it renders the tree without executing
 * apply(). This gate executes each linked plugin's REAL registration path
 * against a mock context and validates every registered tool with the REAL
 * core validator imported from the built harness, so a broken plugin is
 * rejected here, while the old server is still running and untouched.
 *
 * Checks per plugin (dependencies with a `link:` protocol in the profile's
 * package.json):
 *   1. the module imports cleanly (syntax, missing files);
 *   2. apply() runs against a mock ctx without throwing;
 *   3. every ctx.tools.register() definition passes the core
 *      assertSupportedJsonSchema on its output schema — the exact validator
 *      production runs;
 *   4. every file the package's `exports` map declares exists on disk;
 *   5. the package declares `dsh.bundle.patch` and the patch file exists —
 *      production boot fails loud with "declares no dsh.bundle" when the
 *      manifest lacks it (2026-08-31 演练残留事故: gate green, boot dead);
 *
 * Exit 0 = all plugins safe to load; exit 1 = at least one failure, with the
 * per-plugin reason printed and nothing mutated anywhere.
 */

import { access } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Where the built core validator lives: derived from this script's own
 * location (DSH-ops) — the official repo is the sibling <root>/Deepseek_DSH,
 * so any drive letter works. Override via DSH_TOOLS_LIB when needed.
 */
const OPS_DIR = dirname(fileURLToPath(import.meta.url))
const TOOLS_LIB = process.env.DSH_TOOLS_LIB
  ?? join(dirname(OPS_DIR), 'Deepseek_DSH/packages/core/tools/lib/index.js').replaceAll('\\', '/')
/** Profile directory whose linked plugins to validate; resolved per machine. */
const PROFILE_DIR = process.argv[2]
  ?? (process.env.DSH_HOME !== undefined ? resolve(process.env.DSH_HOME, 'profiles/web') : resolve(homedir(), '.dsh/profiles/web'))

/** Resolve the `exports` file list of a package.json manifest.
 * @param manifest - parsed package.json.
 * @returns export-relative file paths declared by the manifest.
 */
function declaredExportFiles(manifest) {
  const files = []
  const pushEntry = (entry) => {
    if (typeof entry === 'string') files.push(entry)
    else if (typeof entry === 'object' && entry !== null) {
      for (const key of ['types', 'default']) {
        if (typeof entry[key] === 'string') files.push(entry[key])
      }
    }
  }
  const exportsField = manifest.exports
  if (typeof exportsField === 'string') {
    pushEntry(exportsField)
  } else if (typeof exportsField === 'object' && exportsField !== null) {
    for (const subpath of Object.values(exportsField)) pushEntry(subpath)
  }
  return [...new Set(files)].filter(file => !file.startsWith('./src'))
}

/** Build the mock host context that records registrations and validates tools.
 *
 * The mock REPLICATES the Cordis inject guard: at runtime, accessing
 * `ctx.<service>` without declaring that service in the plugin's `inject`
 * array throws "cannot get property '<name>' without inject" and fails the
 * whole loader (server dies before binding its port). The original mock used
 * plain properties, so an inject violation passed the gate and only exploded
 * at server load — the 2026-08-31 restart-resume incident. Framework builtins
 * (get/effect/on/logger) never require declaration.
 *
 * @param assertSchema - the real assertSupportedJsonSchema from the core.
 * @param injectNames - services the plugin declares in `export const inject`.
 * @returns a mock ctx plus the collected section/tool records.
 */
function mockContext(assertSchema, injectNames) {
  const records = { sections: [], tools: [], routes: [], contexts: [], events: [] }
  const declared = new Set(injectNames)
  const services = {
    shell: { sandboxMode: undefined, resolve: request => request, run: async () => { throw new Error('mock: not executed') } },
    tools: {
      register: definition => {
        const output = definition.output
        if (output === undefined || typeof output !== 'object' || typeof output.render !== 'function') {
          throw new Error(`tool "${definition.name}": output { schema, render } is required`)
        }
        try {
          // Raw registrations skip the DSL compiler, so the compiled parameter
          // schema itself must already satisfy the enforced subset (production
          // renders it verbatim into the model's tool prompt).
          assertSchema(definition.parameters)
          assertSchema(output.schema)
        } catch (error) {
          throw new Error(`tool "${definition.name}": ${error.message}`)
        }
        records.tools.push(definition.name)
      },
    },
    // The dsh web runtime always mounts the connection service (RPC channel
    // registry); mock it so plugins declaring `inject: ['connection']` exercise
    // their real registration path here instead of failing on `undefined`.
    connection: {
      rpc: {
        handle: channel => {
          records.routes.push(channel)
          return () => {}
        },
      },
    },
    webServer: { register: route => { records.routes.push(route.path) } },
    systemPrompt: {
      section: section => { records.sections.push(section) },
      context: provider => { records.contexts.push(provider) },
    },
    // Declared-but-unimplemented services resolve to undefined, mirroring a
    // service that is not mounted in this reduced environment; plugins must
    // already tolerate that at runtime (the ctx.get pattern).
    sessionController: undefined,
  }
  const ctx = new Proxy({}, {
    get(_target, prop) {
      const name = String(prop)
      if (name === 'get') {
        // Real `ctx.get` reads the global service store and returns undefined
        // for a service that is not mounted. Mirror that against the mock
        // store so a plugin's optional-service branch is exercised here
        // instead of being skipped by an unconditional undefined.
        return serviceName => services[String(serviceName)]
      }
      if (name === 'inject') {
        // Real `ctx.inject(names, callback)` runs the callback once every
        // named service is present, with a context where those services are
        // declared (the official lazy-injection pattern for optional
        // services). Mirror that: when the mocks cover the names, invoke the
        // callback with the names temporarily declared.
        return (names, callback) => {
          const list = (Array.isArray(names) ? names : [names]).map(String)
          const ready = list.every(serviceName => services[serviceName] !== undefined)
          if (!ready) return () => {}
          const added = []
          for (const serviceName of list) {
            if (!declared.has(serviceName)) { declared.add(serviceName); added.push(serviceName) }
          }
          try {
            callback(ctx)
          } finally {
            for (const serviceName of added) declared.delete(serviceName)
          }
          return () => {}
        }
      }
      if (name === 'effect') {
        // The registration-time effect idiom (host halves wrap route/
        // subscription registrations in ctx.effect(() => disposer)); the mock
        // invokes the body once and discards the disposer — nothing real is
        // mounted.
        return body => {
          const dispose = body()
          return typeof dispose === 'function' ? dispose : () => {}
        }
      }
      if (name === 'on') {
        // Event subscriptions return the Cordis disposer; never fired here.
        return event => {
          records.events.push(event)
          return () => {}
        }
      }
      if (name === 'logger') return { error() {}, warn() {}, info() {} }
      if (!declared.has(name)) {
        throw new Error(`cannot get property '${name}' without inject`)
      }
      return services[name]
    },
  })
  return { ctx, records }
}

/**
 * Syntax-check a browser-half client file with `node --check` (parse without
 * execute — the browser module loader globals do not exist here). The check
 * honors the package's `"type": "module"`.
 * @param file - absolute path of the client entry.
 * @returns undefined when the file parses, else the failure detail.
 */
function checkClientSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status === 0) return undefined
  const detail = (result.stderr ?? '').split('\n').filter(line => line.length > 0).slice(0, 3).join(' | ')
  return detail.length > 0 ? detail : `node --check exited ${result.status}`
}

// ---- Main ------------------------------------------------------------------

let assertSupportedJsonSchema
try {
  ;({ assertSupportedJsonSchema } = await import(pathToFileURL(TOOLS_LIB).href))
} catch (error) {
  console.error(`validate-plugins: cannot load core validator from ${TOOLS_LIB}`)
  console.error(`  (run "pnpm run build" in the DSH repo first, or set DSH_TOOLS_LIB)`)
  console.error(`  ${error.code ?? error.message}`)
  process.exit(1)
}
const profilePath = resolve(PROFILE_DIR)
const manifestPath = join(profilePath, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
// Validate exactly the set the server will load: plugins linked in
// dependencies but removed from dsh.profile.bundles (disable-plugin.mjs /
// auto-isolation) do not load, so they must not keep the gate red — the
// startup fallback relies on the gate going green right after an isolation.
const bundles = manifest.dsh?.profile?.bundles
const links = Object.entries(manifest.dependencies ?? {})
  .filter(([, spec]) => typeof spec === 'string' && spec.startsWith('link:'))
  .map(([name, spec]) => ({ name, dir: spec.slice('link:'.length) }))
  .filter(link => {
    if (Array.isArray(bundles) && !bundles.includes(link.name)) {
      console.log(`SKIP ${link.name}: disabled (not in dsh.profile.bundles) — not loaded, not validated`)
      return false
    }
    return true
  })

if (links.length === 0) {
  console.log('validate-plugins: no active linked plugins declared; nothing to check')
  process.exit(0)
}

// Per-link install checks are only meaningful once the profile has been
// installed at least once: a profile without node_modules at all (throwaway
// test profiles) cannot have its per-plugin symlinks judged. Production
// profiles always have the directory, so the half-install case stays covered.
let profileInstalled = true
try {
  await access(join(profilePath, 'node_modules'))
} catch {
  profileInstalled = false
}

let failed = 0
for (const link of links) {
  // G4 drill reserve: fault-injection drill plugins (gate-demo-badN) must
  // never stay in the production bundle list — drills have repeatedly been
  // left installed and each one took DSH down (2026-08-31 bad2/bad3/bad4).
  // Reject by name before any other check so a leftover drill cannot hide
  // behind an otherwise-compliant package. DSH_DRILL=1 is the explicit drill
  // opt-in: the launcher does NOT set it in any automatic path, so a drill
  // can only pass the gate when a human/AI deliberately exports it for the
  // duration of a supervised drill.
  if (/^dsh-gate-demo-/i.test(link.name) || /^gate-demo-/i.test(link.name)) {
    if (process.env.DSH_DRILL === '1') {
      console.log(`WARN ${link.name}: drill mode (DSH_DRILL=1) — reserve-name bypass active; NEVER set DSH_DRILL outside a supervised drill (G4)`)
    } else {
      failed += 1
      console.error(`FAIL ${link.name}: drill-reserve name — fault-injection drill plugins must not stay in dsh.profile.bundles; remove the link and clean up the drill (G4)`)
      continue
    }
  }
  const pluginManifestPath = join(link.dir, 'package.json')
  let pluginManifest
  try {
    pluginManifest = JSON.parse(await readFile(pluginManifestPath, 'utf8'))
  } catch (error) {
    failed += 1
    console.error(`FAIL ${link.name}: cannot read ${pluginManifestPath}: ${error.message}`)
    continue
  }

  // The production boot resolves each bundle to its patch layer through
  // package.json `dsh.bundle.patch` (app-boot loadProfile) and fails loud with
  // "declares no dsh.bundle" when the declaration is missing — a bundle-less
  // package in the list is a misconfiguration, not "no patches". The gate
  // mirrors that check so the drill/residue class (link added to the profile
  // but manifest lacking the bundle declaration) is rejected before restart
  // instead of after the third attempt.
  const bundlePatch = pluginManifest.dsh?.bundle?.patch
  if (typeof bundlePatch !== 'string' || bundlePatch.length === 0) {
    failed += 1
    console.error(`FAIL ${link.name}: declares no dsh.bundle.patch in its package.json — boot dies with "declares no dsh.bundle"; add "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`)
    continue
  }
  try {
    await access(join(link.dir, bundlePatch))
  } catch {
    failed += 1
    console.error(`FAIL ${link.name}: dsh.bundle.patch file ${bundlePatch} missing on disk — boot dies in loadOverlayPatches`)
    continue
  }

  // Declared export files must exist (a stale link or missing build output
  // otherwise surfaces only at server load).
  let missingFiles = []
  for (const file of declaredExportFiles(pluginManifest)) {
    try {
      await access(join(link.dir, file))
    } catch {
      missingFiles.push(file)
    }
  }
  if (missingFiles.length > 0) {
    failed += 1
    console.error(`FAIL ${link.name}: declared exports missing on disk: ${missingFiles.join(', ')}`)
    continue
  }

  // The link must be materialized by pnpm install (node_modules/<name> in the
  // profile): the server resolves bundles through that symlink, and when it
  // is missing startup dies with "cannot resolve profile bundle" even though
  // every file exists at link.dir. The gate reads link.dir directly and would
  // otherwise pass a half-installed plugin (2026-08-31 演练事故: gate green,
  // server dead until manual cleanup).
  if (profileInstalled) {
    try {
      await access(join(profilePath, 'node_modules', link.name))
    } catch {
      failed += 1
      console.error(`FAIL ${link.name}: link not installed — profile node_modules/${link.name} is missing; run pnpm install in the profile directory (or personal_hub_reapply) before restart`)
      continue
    }
  }

  const entry = pluginManifest.main ?? 'index.js'
  const entryUrl = pathToFileURL(join(link.dir, entry)).href
  try {
    const module = await import(entryUrl)
    if (typeof module.apply !== 'function') {
      throw new Error('module does not export an apply() function')
    }
    const injectNames = Array.isArray(module.inject)
      ? module.inject.filter(entry => typeof entry === 'string')
      : []
    const { ctx, records } = mockContext(assertSupportedJsonSchema, injectNames)
    try {
      module.apply(ctx, {})
    } catch (error) {
      throw new Error(`apply() threw during registration: ${error.message}`)
    }
    // Browser half: a plugin that exports './client' ships a client entry the
    // browser module loader executes at page load; a syntax error there breaks
    // the page, so parse-check it with the same Node that runs the server.
    const clientEntry = pluginManifest.exports?.['./client']
    const clientFile = typeof clientEntry === 'string' ? clientEntry : clientEntry?.default
    if (typeof clientFile === 'string') {
      const clientFailure = checkClientSyntax(join(link.dir, clientFile))
      if (clientFailure !== undefined) {
        throw new Error(`client entry ${clientFile} fails to parse: ${clientFailure}`)
      }
    }
    const tools = records.tools.length > 0 ? records.tools.join(', ') : '(no tools)'
    console.log(`PASS ${link.name}: loads, apply() registers [${tools}], schemas valid`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${link.name}: ${error.message}`)
  }
}

if (failed > 0) {
  console.error(`validate-plugins: ${failed} plugin(s) would break server load — restart aborted, old server untouched`)
  process.exit(1)
}
console.log(`validate-plugins: all ${links.length} active linked plugin(s) safe to load`)
// Explicit exit: imported plugin modules may leave active handles (timers,
// listeners) in the event loop, and waiting for it to drain would hang the
// gate — and with it every restart script that invokes it.
process.exit(0)
