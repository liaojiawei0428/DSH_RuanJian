/**
 * dsh-plugin-guide — host half (placeholder).
 *
 * This plugin is client-only: all behavior lives in client.js, which embeds
 * Chinese names and purpose descriptions into the official plugin inventory
 * page's card details. The Node half exists only to satisfy the package's main
 * export; it contributes nothing.
 *
 * STANDARD COMPLIANCE (PLUGIN-STANDARD.md):
 *  - P2 zero workspace imports: only node: builtins and injected services;
 *    a linked install has no node_modules to resolve @deepseek-ai/* from.
 *  - P3 minimal injections: none — nothing on the Host plane is consumed.
 *  - P5 registrations are effects; this half registers nothing.
 */

export const name = 'plugin-guide'

/** Hard service dependencies only; see P3 before adding one. */
export const inject = []

/**
 * Plugin body.
 * @param ctx - host root context.
 * @param config - resolved plugin config from the composition row.
 */
export function apply(ctx, config = {}) {
  // Intentionally empty: see the file header.
}
