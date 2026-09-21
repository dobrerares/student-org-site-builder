#!/usr/bin/env node
/**
 * Compile `src/styles/builder.css` (Tailwind v4 source) into the committed
 * `src/styles/builder.generated.css` artifact, and mirror it into
 * `src/styles/builder-css.generated.ts` as an injectable string.
 *
 * Two outputs, because the builder has two very different delivery paths:
 *
 *   - `builder.generated.css` is what bundlers import (Vite dev server,
 *     the esbuild archival bundle, the Electron renderer). The archival
 *     runner collects esbuild's CSS output and inlines it into the
 *     single-file HTML.
 *   - `builder-css.generated.ts` is a plain string module with a
 *     side-effect `<style>` injector, matching the existing
 *     `editor-app-css.ts` idiom. Importing `@sosb/ui` from a context with
 *     no CSS pipeline (vitest, a consumer that only has a TS toolchain)
 *     still gets the styles.
 *
 * Run after changing any Tailwind class names in the builder packages:
 *   pnpm --filter @sosb/ui run build:css
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const input = path.join(pkgRoot, "src", "styles", "builder.css");
const cssOut = path.join(pkgRoot, "src", "styles", "builder.generated.css");
const tsOut = path.join(pkgRoot, "src", "styles", "builder-css.generated.ts");

const cli = path.join(pkgRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");

execFileSync(process.execPath, [cli, "--input", input, "--output", cssOut, "--minify"], {
  cwd: pkgRoot,
  stdio: "inherit",
});

const css = readFileSync(cssOut, "utf8").trim();

const banner = `/**
 * GENERATED FILE — do not edit.
 *
 * Produced by \`pnpm --filter @sosb/ui run build:css\` from
 * \`src/styles/builder.css\`. See that file for the source of truth.
 */`;

writeFileSync(
  tsOut,
  `${banner}

const STYLE_ELEMENT_ID = "sosb-ui-style";

export const BUILDER_CSS = ${JSON.stringify(css)};

/** Inject the compiled builder stylesheet once, idempotently. */
export function injectBuilderCss(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) return;
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = BUILDER_CSS;
  document.head.prepend(styleEl);
}
`,
  "utf8",
);

console.log(
  `@sosb/ui: wrote ${path.relative(pkgRoot, cssOut)} and ${path.relative(pkgRoot, tsOut)} (${css.length} bytes of CSS)`,
);
