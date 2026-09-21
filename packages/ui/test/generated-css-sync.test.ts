/**
 * Drift guard for the committed builder stylesheet.
 *
 * `src/styles/builder.generated.css` and its `.ts` mirror are build output
 * that lives in git, so every toolchain (tsc, vitest, Vite, esbuild,
 * Electron) sees identical bytes without a mandatory codegen step. The
 * price of committing build output is that it can go stale.
 *
 * It goes stale more easily than it looks: `builder.css` `@source`s the
 * `src` trees of `@sosb/editor-app`, `@sosb/wizard` and
 * `@sosb/browser-shell`, so adding or renaming a Tailwind class in *any* of
 * those packages changes this output. The failure is silent — the class
 * gets no rule and the control renders unstyled — which is exactly the kind
 * of thing a test should catch instead of a user.
 *
 * Mirrors `packages/renderer/test/fonts-registry.test.ts`, which guards the
 * font codegen the same way.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { BUILDER_CSS } from "../src/styles/builder-css.generated.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");

describe("builder CSS codegen sync", () => {
  test("committed generated files match `build:css --check`", () => {
    // Exits non-zero if either artifact has drifted from a fresh compile.
    const out = execFileSync(process.execPath, [path.join("scripts", "build-css.mjs"), "--check"], {
      cwd: pkgRoot,
      encoding: "utf8",
    });
    expect(out).toContain("OK");
  }, 120_000);

  test("the .ts mirror carries the same bytes as the .css artifact", () => {
    const css = readFileSync(
      path.join(pkgRoot, "src", "styles", "builder.generated.css"),
      "utf8",
    ).trim();
    expect(BUILDER_CSS).toBe(css);
  });

  test("the compiled sheet actually contains builder rules", () => {
    // A guard against the check passing trivially because both artifacts
    // are empty.
    expect(BUILDER_CSS.length).toBeGreaterThan(1000);
    expect(BUILDER_CSS).toContain("--radius-sosb-md");
    expect(BUILDER_CSS).toContain("data-sosb-ui");
  });
});
