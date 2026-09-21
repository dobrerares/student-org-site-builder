/**
 * The offline single-file archive must carry the compiled builder CSS.
 *
 * Before issue #101 the archival esbuild path took `outputFiles[0]` as "the
 * JavaScript" and handed the inliner nothing else, so any generated
 * stylesheet was silently dropped — the gap recorded in the issue #99
 * research. The archival entry now imports `@sosb/ui/styles.css`, the
 * runner classifies esbuild's outputs by extension, and the inliner folds
 * the CSS into a `<style>` element.
 *
 * The archive is opened from `file://` with no network, so a surviving
 * external reference is a silent styling failure for the user rather than a
 * build error. Hence the "no remote URL" assertions.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { classifyOutputs, runArchivalBuild } from "../scripts/run-archival-build.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const uiCssPath = path.resolve(pkgRoot, "..", "ui", "src", "styles", "builder.generated.css");

describe("classifyOutputs", () => {
  test("separates JavaScript from CSS regardless of esbuild's output order", () => {
    const result = classifyOutputs([
      { path: "/out/entry.css", text: ".a{color:red}" },
      { path: "/out/entry.js", text: "console.log(1)" },
    ]);
    expect(result.js).toBe("console.log(1)");
    expect(result.css).toBe(".a{color:red}");
  });

  test("reports undefined rather than guessing when a kind is missing", () => {
    const result = classifyOutputs([{ path: "/out/entry.js", text: "x" }]);
    expect(result.css).toBeUndefined();
    expect(result.js).toBe("x");
  });

  test("concatenates when a build emits more than one stylesheet", () => {
    const result = classifyOutputs([
      { path: "/out/a.css", text: ".a{}" },
      { path: "/out/b.css", text: ".b{}" },
      { path: "/out/a.js", text: "1" },
    ]);
    expect(result.css).toContain(".a{}");
    expect(result.css).toContain(".b{}");
  });
});

describe("archival HTML includes the compiled builder stylesheet", () => {
  test("inlines the generated CSS and leaves no remote asset reference", async () => {
    const outDir = path.join(pkgRoot, "dist", "archival-css-test");
    const { outPath } = await runArchivalBuild({ outDir });
    const html = readFileSync(outPath, "utf8");

    // A distinctive rule from the compiled builder sheet. Taken from the
    // generated artefact itself so the assertion tracks the real output
    // rather than a hand-copied snippet that can drift.
    const generated = readFileSync(uiCssPath, "utf8");
    const marker = "--radius-sosb-md";
    expect(generated).toContain(marker);
    expect(html).toContain(marker);

    // The builder reset marker only exists in the Tailwind-compiled sheet.
    expect(html).toContain("data-sosb-ui");

    // Everything is inline: no stylesheet link survives, and nothing points
    // at a network origin that a `file://` archive could not reach.
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/<style[^>]*>[^<]*@import\s+url\(\s*["']?https?:/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:\/\//i);
  }, 180_000);
});
