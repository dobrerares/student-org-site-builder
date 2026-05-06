import { describe, expect, test } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { runArchivalBuild } from "../scripts/run-archival-build.js";

/**
 * AC #3 — `pnpm build:archival` produces a single `builder.html` ≤ 3MB.
 *
 * The CLI script (`scripts/build-archival.mjs`) is a one-liner that calls
 * `runArchivalBuild()`. Testing the function directly (not via a child
 * process) gives byte-equal coverage of the path the user runs without the
 * brittleness of an exec-style shell call.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, "..");
const outPath = path.join(pkgRoot, "dist", "archival", "builder.html");

describe("runArchivalBuild end-to-end", () => {
  test("produces dist/archival/builder.html ≤ 3MB with no external local script refs", async () => {
    await runArchivalBuild({ outDir: path.join(pkgRoot, "dist", "archival") });

    expect(existsSync(outPath)).toBe(true);
    const stat = statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(3 * 1024 * 1024);

    const html = readFileSync(outPath, "utf8");
    expect(html.startsWith("<!doctype html>") || html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");

    // No external `src=` for local paths. We allow `data:` URIs, and
    // we allow https:// (cross-origin refs are not auto-inlined).
    const localScriptRef = /<script[^>]+\bsrc=["'](?!data:|https?:|\/\/)[^"']+["']/i;
    expect(html).not.toMatch(localScriptRef);

    const localStylesheetRef =
      /<link[^>]+rel=["']?stylesheet[^>]*href=["'](?!data:|https?:|\/\/)[^"']+["']/i;
    expect(html).not.toMatch(localStylesheetRef);
  }, 180_000);
});
