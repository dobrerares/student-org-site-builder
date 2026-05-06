/**
 * Node-side entry for the a11y regression spec.
 *
 * `a11y.spec.ts` bundles this file via esbuild and dynamically imports the
 * resulting `.mjs`. We re-export the three symbols the spec needs:
 *
 *  - `generateA11yFixture` — the fixture generator under
 *    `packages/renderer/test/a11y-fixture.ts`.
 *  - `build` — the production build pipeline.
 *  - `KNOWN_THEME_IDS` — the renderer's dynamic theme registry.
 *
 * Keeping the imports as relative paths (rather than the in-bundler-only
 * `file://` URLs) is what lets esbuild resolve them; it mirrors the
 * `renderer-parity.entry.ts` pattern from #46.
 */
export { build } from "../packages/build/src/index.js";
export { KNOWN_THEME_IDS } from "../packages/renderer/src/index.js";
export { generateA11yFixture } from "../packages/renderer/test/a11y-fixture.js";
