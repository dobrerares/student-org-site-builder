# Self-hosted theme fonts — design

**Status:** Design — pending implementation plan
**Owner:** rdobre
**Date:** 2026-06-14
**Part of:** the theme identity refresh (`2026-06-14-themes-identity-refresh-design.md`). This subsystem must land before the per-theme identity recasts, which reference these font families.

## What & why

The re-cast theme identities (Activist · Tech · Editorial · Calm · Scholarly) are defined partly by **type**: Archivo, Space Grotesk, Fraunces, Source Serif 4, Inter. The renderer today is **system-font-stacks only** — it loads no web fonts, so those families silently fall back to whatever the visitor has installed. To render the designed identities, the fonts must become loadable.

We **self-host** them (not the Google Fonts CDN). All five are free/OFL Google fonts; "self-host" means we ship the same woff2 files from the site's own `assets/`. Decision rationale (all four independently decisive for this project):

1. **GDPR** — a CDN `<link>` exposes every visitor's IP to Google on every generated student-org site; a 2022 Munich ruling held this unlawful without consent. Self-hosting keeps visitor data on the org's domain. This is the headline reason for an EU/Romanian tool.
2. **Offline / archival** — the archival single-file build and the electron app must run with no network; the archival inliner deliberately does not fetch cross-origin URLs.
3. **CSP** — the editor CSP is `font-src 'self' data:` (no Google origins); self-hosted/data-URI fonts already pass, a CDN would be blocked.
4. **Determinism** — self-hosted bytes are a compile-time constant; the byte-identical-output invariant holds.

Scope decision: **full fidelity** — self-host all five families, **gated per theme** so each generated site ships only its theme's families (per-page weight stays small regardless of how many we bundle).

## Locked decisions

| Decision | Choice |
| --- | --- |
| Delivery | Self-host woff2 (not Google CDN) |
| Scope | All five identity families, full fidelity |
| Per-page | Gated emission — a site emits `@font-face` only for the families its resolved theme/site tokens actually use |
| Subsetting | Use `@fontsource/*` pre-subset woff2 (OFL, version-pinned devDeps). They ship Google's `latin` + `latin-ext` subsets; `latin-ext` covers the Romanian Ș/Ț (U+0218–021B). `pnpm gen:fonts` copies the needed weight×subset files out of `node_modules` and base64-codegens them — no Python; CI consumes committed bytes. (A custom `pyftsubset` pass is a documented fallback if a smaller combined subset is ever wanted.) |
| Renderer byte access | woff2 → committed base64 string constants via a `pnpm gen:fonts` codegen step (committed output, like goldens) — keeps the renderer dependency- and Node-builtin-free |
| Dist transport | Widen `DistFolder` to `Map<string, string \| Uint8Array>` (centralized — Option A) so fonts flow through build → zip/electron/archival uniformly |
| Emission seam | `@font-face` emitted first in `composeCss` (renderer `index.tsx`), `src: url()` resolved through the existing `resolveAssetUrl` |
| Budget | New `fonts` metric in `measureBudgets`; woff2 bytes do **not** count against the 15KB CSS-gzipped budget |

## Architecture

The renderer has **zero precedent for a non-inline sub-resource** today (all CSS/JS is inline strings; the only binary path into a site is the VFS user-upload copy in `zip/export.ts`). This subsystem introduces the first renderer-owned static asset. The asset indirection that exists — `AssetUrlForPath = (path) => string | undefined`, `resolveAssetUrl(path, fn) = fn?.(path) ?? path` — is reused for the `@font-face src` so the three output modes differ only by resolver, exactly as images already do.

### 1. Fonts in the repo + codegen

- woff2 sourced from `@fontsource/*` packages (OFL, version-pinned devDependencies): `@fontsource/archivo`, `@fontsource/space-grotesk`, `@fontsource/fraunces`, `@fontsource/source-serif-4`, `@fontsource/inter`. These ship Google's per-subset woff2 split into `latin` and `latin-ext`; the `latin-ext` subset's unicode-range includes **U+0218–021B** (the Romanian Ș/ș/Ț/ț comma-below glyphs — distinct from the cedilla forms). Each weight therefore ships as **two** files/`@font-face` (latin + latin-ext), each carrying its Google unicode-range, so the browser fetches latin-ext only when the page uses those codepoints.
- `pnpm gen:fonts` copies the needed `<weight>` × {`latin`,`latin-ext`} woff2 from `node_modules/@fontsource/*/files/` into `packages/renderer/src/fonts/woff2/`, recording each file's unicode-range. No Python; CI consumes the committed bytes. Document the source package versions + copied file list in `packages/renderer/src/fonts/README.md` for reproducibility.
- `pnpm gen:fonts` reads the committed woff2 and writes `packages/renderer/src/fonts/font-bytes.generated.ts` — `export const FONT_WOFF2_BASE64: Record<string, string>` keyed by file name. Committed; a test asserts it is in sync with the woff2 (regenerate-and-diff), mirroring the goldens discipline.
- `.gitattributes` already marks `*.woff2 binary` — no change needed.

### 2. The registry (renderer-internal)

`packages/renderer/src/fonts/registry.ts`:
```ts
interface FontFaceDef {
  family: string;            // e.g. "Space Grotesk"
  weight: number;            // 400, 600, 700, 800
  style: "normal" | "italic";
  file: string;              // key into FONT_WOFF2_BASE64 and the canonical path tail
  unicodeRange: string;      // the subset range string
}
const FONT_FACE_REGISTRY: Record<string /*family*/, FontFaceDef[]>;
const FONT_ASSET_PREFIX = "assets/fonts/";   // canonical output path tail: assets/fonts/<file>
```

### 3. Gated `@font-face` emission

In `composeCss(site, themeId, assetUrlForPath?)` (renderer `index.tsx`), emit a new first segment:
```
const faces = emitFontFaces(usedFamiliesFor(site, themeId), assetUrlForPath);
return `${faces}${root}\n${themeCssFor(themeId)}`;
```
- `usedFamiliesFor` resolves the **same** font tokens the token emitter resolves (theme defaults/baseline + `site.theme.tokens` overrides, last-wins, mirroring `pushScalarTokens`), takes the **first quoted family** of the resolved `--font-headline` and `--font-body` stacks, and keeps only families present in `FONT_FACE_REGISTRY`. Result is a pure function of resolved tokens → a family a user overrode away is not shipped.
- For each used family's defs (sorted by family, weight, style for byte-stability) emit:
  `@font-face { font-family:"X"; font-style:..; font-weight:..; font-display:swap; src:url(<resolved>) format("woff2"); unicode-range:..; }`
  where `<resolved> = resolveAssetUrl(FONT_ASSET_PREFIX + def.file, assetUrlForPath)`.
- Deploy passes no resolver → literal `assets/fonts/<file>.woff2`. Preview passes the blob resolver → blob URL.

### 4. Three-mode delivery

- **Deploy:** widen `DistFolder` to `Map<string, string | Uint8Array>` ([build/src/index.ts](../../packages/build/src/index.ts)). `build()` injects the used families' woff2 bytes at `assets/fonts/<file>.woff2` (bytes decoded from `FONT_WOFF2_BASE64`). `zip/export.ts` already writes `dist/<path>` from the build map → fonts ride along to `dist/assets/fonts/...`. The in-body `src="assets/fonts/..."` resolves over HTTP on the host.
- **Preview:** seed the editor's `displayUrlForAssetPath` cache (editor-app) with blob URLs for the renderer-owned font files at mount, so `assets/fonts/<file>.woff2` resolves to a blob (no 404 in the srcdoc iframe).
- **Archival/electron:** extend `buildArchival` ([browser-shell](../../packages/browser-shell/src/archival/build-archival.ts)) with (a) a `woff2 → font/woff2` MIME entry and (b) a CSS-`url()` inliner pass that rewrites `src:url(assets/fonts/x.woff2)` inside the inline `<style>` to `data:font/woff2;base64,...` from the asset map. The editor CSP already allows `data:` fonts.

### 5. Budget

[budget.ts](../../packages/build/src/budget.ts): add a `fonts` metric to `measureBudgets`/`BudgetReport` summing `assets/fonts/*.woff2` `byteLength` per page (mirrors the planned `hero` metric), with a per-page cap (~120KB, enough for one theme's families × weights) and a `skipped` state when a page self-hosts none. woff2 bytes are **excluded** from the CSS-gzipped budget (binary, separately cacheable). Because the dist now carries `Uint8Array`, `measureBudgets` must use `.byteLength` for non-string values. Update the `_lighthouse-budget.json` goldens + `dist-snapshot` goldens; raise/justify the policy in an ADR (ADR 0033 calls budget thresholds a "PRD-level conversation").

### 6. Families & weights

Subset only the weights the identities use (each weight = one woff2 file). The per-theme font wiring (setting `--font-headline`/`--font-body`) is done **in this plan** so fonts go live and are tested end-to-end; the palette/density/shape/structural recast is the separate next plan.

| Family | Weights | Used by (headline / body) |
| --- | --- | --- |
| Archivo | 700, 800 | Activist headline |
| Space Grotesk | 500, 700 | Tech headline |
| Fraunces | 600 (opsz set) | Editorial headline |
| Source Serif 4 | 600, 700 | Scholarly headline |
| Inter | 400, 500, 600 | Tech/Editorial/Scholarly body, Calm headline+body |

(Exact weights confirmed against each theme's resolved tokens during plan-writing; trim any unused weight.)

## Test plan

- **Gated-emission golden:** a self-hosting theme renders `@font-face` for its families only, with `src:url(assets/fonts/...)`, `font-display:swap`, and the Romanian `unicode-range`.
- **Negative regression:** a system-font theme (or a font-override that drops the family) emits **zero** `@font-face` and ships **zero** font bytes.
- **Codegen sync test:** `FONT_WOFF2_BASE64` matches the committed woff2 (regenerate-and-compare).
- **Diacritic coverage:** assert the subset includes U+0218/U+0219 (and U+021A/U+021B); keep existing Romanian golden/Lighthouse coverage green.
- **Determinism/parity:** byte-identical output Node vs browser (existing parity test) holds with fonts.
- **Three-mode:** deploy golden shows `assets/fonts/...woff2` artefact present in the dist; archival test shows the woff2 inlined as `data:font/woff2`; preview resolves to a blob (jsdom/unit where feasible).
- **Budget:** `fonts` metric counts woff2 bytes, CSS-gzipped budget unaffected by font bytes; regenerate `_lighthouse-budget.json` + `dist-snapshot` goldens.

## Decomposition (implementation PRs)

1. **PR-F1 — Fonts + codegen:** add the `@fontsource/*` devDeps; `pnpm gen:fonts` copies the needed weight×subset woff2 into the repo and writes `font-bytes.generated.ts` (committed base64); the `FONT_FACE_REGISTRY`; the sync test. No rendering change yet.
2. **PR-F2 — Dist binary + emission:** widen `DistFolder` to `string | Uint8Array`; `emitFontFaces` + `usedFamiliesFor` gated emission in `composeCss`; `build()` injects font bytes for used families; `measureBudgets` handles `Uint8Array` + the new `fonts` metric. Deploy path works end-to-end; goldens regenerated.
3. **PR-F3 — Preview + archival:** seed the editor preview resolver with font blobs; extend `buildArchival` with woff2 MIME + the CSS-`url()` inliner. Preview + offline parity.
4. **PR-F4 — Wire themes + catalog:** set each theme's `--font-headline`/`--font-body` to its identity families; reconcile the catalog `ThemeFonts` lists with the loadable families (close the existing "catalog names fonts it never loads" gap). Per-theme font goldens.

## Out of scope

- The palette/density/shape/structural per-theme recast (the next plan).
- Variable-font axes beyond the fixed weights above (Fraunces opsz is pinned to one optical size).
- User-uploaded custom fonts (only the curated five are self-hosted; user font-token overrides outside the registry continue to render as plain family stacks, unchanged).
- A per-deployment CDN toggle (rejected — self-host only).

## ADR

Add ADR 0046 (self-hosted theme fonts) recording: self-host over CDN (GDPR/offline/CSP/determinism), the `DistFolder` binary widening, the gated `@font-face` model, and the budget-policy addition (fonts metric, woff2 excluded from CSS budget).

## References

- Recon (2026-06-14): asset resolution funnels through `resolveAssetUrl`; `DistFolder` is text-only; no renderer-owned static assets exist; editor CSP already permits `font-src 'self' data:`; `.gitattributes` pre-marks woff2 binary; no font tooling in repo.
- Constraints: ADR 0003/0032 (single inline `<style>`, pure deterministic renderer), ADR 0033 (byte budgets), ADR 0004 (no Node Buffer in browser paths).
- Feedback memory: `feedback_theme_identity_via_fundamentals.md` (type is a fundamental, in-scope; keep the self-hosted set curated, not pizzaz).
