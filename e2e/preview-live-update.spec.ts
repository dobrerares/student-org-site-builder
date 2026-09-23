import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Frame, Page } from "@playwright/test";

import { openSection } from "./builder-helpers.js";

/**
 * The preview updates in place while you type.
 *
 * This is the binding, in-a-real-browser check for the behaviour the unit
 * tests describe from either side (`preview-morph.test.ts` drives the diff in
 * jsdom; `preview-in-place-update.test.tsx` asserts the host posts instead of
 * rewriting `srcdoc`). Neither can prove the thing users actually feel: that
 * the preview does not jump back to the top on every keystroke.
 *
 * Before this change the editor rebuilt the iframe document from its `srcdoc`
 * on every render, so typing one character into a form scrolled a long
 * preview back to the top and collapsed anything the user had opened.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "packages",
  "editor-app",
  "test",
  "fixtures",
  "minimal-site.json",
);

/**
 * The fixture page is one hero tall — nothing to scroll. Pad it with prose
 * blocks so the preview is several viewports long and a lost scroll position
 * is unmistakable.
 */
function tallSite(): Record<string, unknown> {
  const site = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    pages: { blocks: unknown[] }[];
  };
  const blocks = site.pages[0]!.blocks;
  // A real FAQ block, so the disclosure state under test is the one the
  // renderer actually emits. `firstOpen: false` means every answer starts
  // closed and any open one is the user's own doing.
  blocks.push({
    id: "blk_faq",
    type: "faq",
    version: 1,
    data: {
      title: "Întrebări frecvente",
      firstOpen: false,
      items: [
        { question: "Cine se poate înscrie?", answer: "Orice student." },
        { question: "Există costuri?", answer: "Nu." },
      ],
    },
  });
  for (let i = 0; i < 25; i++) {
    blocks.push({
      id: `blk_prose_${i}`,
      type: "richText",
      version: 1,
      data: {
        markdown: `## Secțiunea ${i}\n\nText de umplutură pentru a face pagina lungă. `.repeat(6),
      },
    });
  }
  return site as unknown as Record<string, unknown>;
}

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "editor-app.entry.tsx");
  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no browser output");
  return out.text;
}

async function mountEditor(page: Page): Promise<Frame> {
  await page.setViewportSize({ width: 1280, height: 900 });
  const bundle = await bundleForBrowser();
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, tallSite());

  // Site settings is where the tests below type, and it keeps a preview
  // beside the form (issue #102).
  await openSection(page, "settings");
  await expect(page.getByTestId("preview-pane")).toBeVisible();

  // The preview document is a srcdoc child frame.
  await expect.poll(() => page.frames().length).toBeGreaterThan(1);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (frame === undefined) throw new Error("preview frame never appeared");
  await frame.waitForSelector("main");
  return frame;
}

/** Replace the organisation name in Site settings. */
async function typeOrgName(page: Page, value: string): Promise<void> {
  const input = page.locator('[data-field="org.name"]');
  await expect(input).toBeVisible();
  await input.fill(value);
}

test("typing does not reset the preview's scroll position", async ({ page }) => {
  const frame = await mountEditor(page);

  // Mark the live document. If the iframe is torn down and rebuilt, the mark
  // goes with it — which is exactly the regression this test exists to catch.
  await frame.evaluate(() => {
    (window as unknown as Record<string, unknown>)["__sosbAliveMarker"] = "original";
    window.scrollTo(0, 900);
  });
  await expect.poll(() => frame.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const scrolledTo = await frame.evaluate(() => window.scrollY);

  await typeOrgName(page, "Organizație Editată");

  // The edit reached the preview…
  await expect.poll(() => frame.title()).toContain("Organizație Editată");

  // …without rebuilding the document…
  expect(
    await frame.evaluate(() => (window as unknown as Record<string, unknown>)["__sosbAliveMarker"]),
  ).toBe("original");

  // …and without moving the user away from what they were looking at.
  expect(await frame.evaluate(() => window.scrollY)).toBe(scrolledTo);
});

test("an FAQ the user opened stays open while they type", async ({ page }) => {
  const frame = await mountEditor(page);

  // Open the second answer — a state only the user's click can produce, and
  // one the freshly-rendered HTML has no way to know about.
  const answer = frame.locator("details").nth(1);
  await answer.locator("summary").click();
  await expect.poll(() => answer.evaluate((el: HTMLDetailsElement) => el.open)).toBe(true);

  await typeOrgName(page, "Alt Nume");
  await expect.poll(() => frame.title()).toContain("Alt Nume");

  // The morph must not clobber user-toggled state…
  expect(await answer.evaluate((el: HTMLDetailsElement) => el.open)).toBe(true);
  // …nor force-open the ones the user left closed.
  expect(
    await frame
      .locator("details")
      .nth(0)
      .evaluate((el: HTMLDetailsElement) => el.open),
  ).toBe(false);
});

test("switching theme reloads the preview document", async ({ page }) => {
  const frame = await mountEditor(page);
  await frame.evaluate(() => {
    (window as unknown as Record<string, unknown>)["__sosbAliveMarker"] = "original";
  });

  // A theme swaps the whole stylesheet: morphing into it would carry over
  // state that no longer means anything, so the preview reloads instead.
  await openSection(page, "theme");
  await page.locator('[data-theme-id="civic"] input[type="radio"]').check();

  await expect
    .poll(async () => {
      const next = page.frames().find((f) => f !== page.mainFrame());
      if (next === undefined) return undefined;
      return next.evaluate(
        () => (window as unknown as Record<string, unknown>)["__sosbAliveMarker"],
      );
    })
    .toBeUndefined();
});
