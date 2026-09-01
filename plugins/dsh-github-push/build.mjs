#!/usr/bin/env node
/**
 * build.mjs — build the deployable product artifacts from src/.
 *
 * Host (`index.js`, repo root): esbuild-bundled ESM bundle. This plugin's host
 * half imports only `node:` builtins (PLUGIN-STANDARD P2), so there are no npm
 * dependencies to inline — the post-build assert below still fails the build
 * unless the product's only external imports are `node:` builtins.
 *
 * Client (`client.js`, repo root): CJS body wrapped in the DSH module-loader
 * handoff — identical envelope to the harness's own client bundles:
 *   window.__ModuleLoader__.load({ id, factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     ...bundle...
 *     return module.exports; } });
 * The shell seeds the module table with react/cordis (PLATFORM_MODULES), so
 * those specifiers stay external `require()` calls resolved by the injected
 * `require`. Everything else must inline.
 */

import esbuild from 'esbuild'
import { builtinModules } from 'node:module'
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

/** Specifiers the browser shell seeds into the shared module table. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/**
 * Atomic write: temp file in the same directory, then rename over the target.
 * @param {string} file
 * @param {string} contents
 */
async function atomicWrite(file, contents) {
  const tmp = `${file}.tmp-${process.pid}`
  await writeFile(tmp, contents, 'utf8')
  await rename(tmp, file).catch(async (err) => {
    await unlink(tmp).catch(() => {})
    throw err
  })
}

/**
 * Bare builtin specifier -> `node:` specifier, so any dynamic builtin
 * requires become static ESM imports of `node:*` — covered by the single
 * `node:*` external instead of surfacing as dynamic requires.
 */
const BUILTIN_ALIAS = Object.fromEntries(
  [...new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])]
    .filter(m => !m.startsWith('node:'))
    .map(m => [m, `node:${m}`]),
)

// ---- Host bundle -----------------------------------------------------------

const host = await esbuild.build({
  entryPoints: [join(root, 'src/index.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: 'external',
  outfile: join(root, 'index.js'),
  // Keep only node builtins external; every npm dep must inline (P2).
  external: ['node:*'],
  banner: {
    js: 'import { createRequire as __dshCreateRequire } from "node:module";'
      + ' import { fileURLToPath as __dshF2P } from "node:url";'
      + ' var require = __dshCreateRequire(import.meta.url);'
      + ' var __filename = __dshF2P(import.meta.url);'
      + ' var __dirname = __dshF2P(new URL(".", import.meta.url));',
  },
  alias: BUILTIN_ALIAS,
  logLevel: 'info',
})

// ---- Client bundle ---------------------------------------------------------

const client = await esbuild.build({
  entryPoints: [join(root, 'src/client.js')],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  sourcemap: 'external',
  outfile: join(root, 'client.js'),
  external: PLATFORM_MODULES,
  logLevel: 'info',
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
})

// ---- Product purity assert -------------------------------------------------

const product = await readFile(join(root, 'index.js'), 'utf8')
const bareImports = [...product.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)]
  .map(match => match[1])
  .filter(spec => !spec.startsWith('node:'))
if (bareImports.length > 0) {
  console.error(`build.mjs: product imports non-builtin specifiers (P2 violation): ${bareImports.join(', ')}`)
  process.exit(1)
}
const clientText = await readFile(join(root, 'client.js'), 'utf8')
if (!clientText.startsWith('window.__ModuleLoader__.load(') || !clientText.includes('return module.exports; } });')) {
  console.error('build.mjs: client.js lacks the __ModuleLoader__ handoff envelope')
  process.exit(1)
}

console.log(`build.mjs: host ${host.errors.length === 0 ? 'ok' : 'FAILED'}, client ${client.errors.length === 0 ? 'ok' : 'FAILED'}; product imports node-only, client envelope verified`)