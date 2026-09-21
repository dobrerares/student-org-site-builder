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
 * Usage:
 *
 *   pnpm --filter @sosb/ui run build:css            # regenerate
 *   node scripts/build-css.mjs --check              # verify, write nothing
 *
 * `--check` exists because `builder.css` `@source`s the *other* packages'
 * `src` trees. Renaming or adding a Tailwind class anywhere in
 * `editor-app`, `wizard` or `browser-shell` changes this output, and the
 * failure mode is silent: the class simply has no rule and the control
 * renders unstyled. `packages/ui/test/generated-css-sync.test.ts` runs the
 * check so CI catches the drift instead of a user.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const input = path.join(pkgRoot, "src", "styles", "builder.css");
const cssOut = path.join(pkgRoot, "src", "styles", "builder.generated.css");
const tsOut = path.join(pkgRoot, "src", "styles", "builder-css.generated.ts");

const cli = path.join(pkgRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");

const checkOnly = process.argv.includes("--check");

/** Run the Tailwind CLI, writing compiled CSS to `target`. */
function compile(target) {
  execFileSync(process.execPath, [cli, "--input", input, "--output", target, "--minify"], {
    cwd: pkgRoot,
    stdio: checkOnly ? "pipe" : "inherit",
  });
  return readFileSync(target, "utf8").trim();
}

/** The `.ts` mirror, derived purely from the compiled CSS. */
function tsModule(css) {
  const banner = `/**
 * GENERATED FILE — do not edit.
 *
 * Produced by \`pnpm --filter @sosb/ui run build:css\` from
 * \`src/styles/builder.css\`. See that file for the source of truth.
 */`;

  return `${banner}

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
`;
}

if (checkOnly) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "sosb-ui-css-"));
  try {
    const fresh = compile(path.join(tmpDir, "builder.generated.css"));
    const stale = [];

    let committedCss = null;
    try {
      committedCss = readFileSync(cssOut, "utf8").trim();
    } catch {
      stale.push(`${path.relative(pkgRoot, cssOut)} is missing`);
    }
    if (committedCss !== null && committedCss !== fresh) {
      stale.push(
        `${path.relative(pkgRoot, cssOut)} differs from a fresh compile ` +
          `(${committedCss.length} committed bytes vs ${fresh.length} fresh)`,
      );
    }

    let committedTs = null;
    try {
      committedTs = readFileSync(tsOut, "utf8");
    } catch {
      stale.push(`${path.relative(pkgRoot, tsOut)} is missing`);
    }
    if (committedTs !== null && committedTs !== tsModule(fresh)) {
      stale.push(`${path.relative(pkgRoot, tsOut)} does not match the compiled CSS`);
    }

    if (stale.length > 0) {
      console.error(
        `@sosb/ui: generated CSS is stale.\n  - ${stale.join("\n  - ")}\n` +
          `Run \`pnpm --filter @sosb/ui run build:css\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log("@sosb/ui: generated CSS is up to date — OK");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
} else {
  const css = compile(cssOut);
  writeFileSync(tsOut, tsModule(css), "utf8");
  console.log(
    `@sosb/ui: wrote ${path.relative(pkgRoot, cssOut)} and ${path.relative(pkgRoot, tsOut)} (${css.length} bytes of CSS)`,
  );
}
