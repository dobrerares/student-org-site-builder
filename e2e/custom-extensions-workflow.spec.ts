import { test, expect, type Download, type Frame, type Page } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { openFirstPage, openSection } from "./builder-helpers.js";
import { ZipDriver } from "../packages/vfs/src/zip-driver.js";

/**
 * The developer → user workflow, end to end, with the shipped example Theme
 * (issue #110's prototype validation; the evidence is indexed in
 * docs/custom-extensions-acceptance.md).
 *
 * A developer packages `examples/themes/practice` (executable shell, hero
 * override, a public-site script). An author, in the real `<EditorApp>` in
 * headless Chromium, imports it, adds Blocks the Theme designs and picks its
 * variants, edits content, previews the page statically and then with the
 * Theme's script running in the isolated interactive preview (ADR 0056),
 * exports the Site, exports the Theme package on its own, and finally opens
 * both in a fresh editor. Every output is checked from the bytes that left
 * the browser, not from editor state.
 *
 * Screenshots for the docs are written under
 * docs/screenshots/custom-extensions/ only on demand:
 *
 *     SOSB_SCREENSHOTS=1 pnpm exec playwright test custom-extensions-workflow
 *
 * The Partners Custom Block is added and edited through generated fields,
 * including a real logo upload and a Page link stored by identity (ADR 0055).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const EXAMPLE_DIR = path.join(repoRoot, "examples", "themes", "practice");
const THEME_ID = "org.example.practice";
const PARTNERS_TYPE = "org.example/partners";
const PARTNERS_SELECTOR = `[data-block="${PARTNERS_TYPE}"]`;
const LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const fixturePath = path.join(
  repoRoot,
  "packages",
  "editor-app",
  "test",
  "fixtures",
  "minimal-site.json",
);
const SHOTS = process.env["SOSB_SCREENSHOTS"] === "1";
const shotDir = path.join(repoRoot, "docs", "screenshots", "custom-extensions");

/** The example package as the developer would zip it. */
function readPackage(): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (name === "screenshots" || name === "README.md") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(path.relative(EXAMPLE_DIR, full).split(path.sep).join("/"), readFileSync(full));
    }
  };
  walk(EXAMPLE_DIR);
  return out;
}

async function packageZip(files: Map<string, Uint8Array>): Promise<Buffer> {
  const driver = new ZipDriver();
  for (const [file, bytes] of files) await driver.write(file, bytes);
  return Buffer.from(driver.toZipBytes());
}

async function unzip(download: Download): Promise<ZipDriver> {
  const file = await download.path();
  if (file === null) throw new Error("the download produced no file");
  return ZipDriver.fromZipBytes(new Uint8Array(readFileSync(file)));
}

/** Two pages, so the Theme's shell has a navigation to intercept. */
function workflowSite(): Record<string, unknown> {
  const site = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    org: { name: string };
    pages: Record<string, unknown>[];
  };
  const home = site.pages[0]!;
  site.pages.push({
    ...structuredClone(home),
    slug: "despre",
    navLabel: "Despre",
    navOrder: 1,
    blocks: [
      {
        id: "blk_hero_despre",
        type: "hero",
        version: 1,
        data: { title: "Despre noi", subtitle: "Cine suntem." },
      },
    ],
  });
  return site as unknown as Record<string, unknown>;
}

async function bundleForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "editor-app.entry.tsx")],
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

async function mount(page: Page, bundle: string, site: Record<string, unknown>): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 950 });
  // Image hashing uses crypto.subtle, so give the editor a secure loopback
  // origin. Playwright fulfils the document; no server or network is needed.
  const url = "http://127.0.0.1/custom-extensions-workflow";
  await page.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto(url);
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, site);
  await expect(page.getByTestId("editor-app")).toBeVisible();
}

/** The preview document currently mounted in the pane, in the given mode. */
async function previewFrame(page: Page, mode: "static" | "interactive"): Promise<Frame> {
  const iframe = page.locator(`[data-testid="preview-pane"] iframe[data-preview-mode="${mode}"]`);
  await expect(iframe).toHaveCount(1);
  const handle = await iframe.elementHandle();
  const frame = await handle?.contentFrame();
  if (frame === null || frame === undefined) throw new Error("the preview frame is not attached");
  await frame.waitForSelector("main");
  return frame;
}

async function expectPartners(frame: Frame): Promise<void> {
  const block = frame.locator(PARTNERS_SELECTOR);
  await expect(block.locator("h2")).toHaveText("Împreună pentru comunitate");
  await expect(block.locator("h3")).toHaveText("Parteneri principali");
  await expect(block.locator("figcaption")).toHaveText("Asociația Exemplu");
  await expect(block.locator("a")).toHaveAttribute("href", "/despre/");
  const logo = block.locator("img");
  await expect(logo).toHaveAttribute("alt", "Sigla partenerului");
  // Lazy images need to enter the viewport before their bytes are decoded.
  await logo.scrollIntoViewIfNeeded();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: false });
}

async function importTheme(page: Page, name: string, buffer: Buffer): Promise<void> {
  await openSection(page, "theme");
  await page
    .getByTestId("theme-import-input")
    .setInputFiles({ name, mimeType: "application/zip", buffer });
  await expect(page.locator(`[data-theme-option][data-theme-id="${THEME_ID}"]`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("theme-import-error")).toHaveCount(0);
}

test("a developer's Theme package goes through import, editing, both previews, export and re-import", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  // The partner link the preview opens must not leave the machine.
  await context.route("https://partner.example/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Partner</title>" }),
  );
  const files = readPackage();
  const developerZip = await packageZip(files);
  const bundle = await bundleForBrowser();
  await mount(page, bundle, workflowSite());

  // --- 1. The author imports the package and switches the Site to it. ---
  await importTheme(page, `${THEME_ID}-1.2.0.sosb-theme.zip`, developerZip);
  const option = page.locator(`[data-theme-option][data-theme-id="${THEME_ID}"]`);
  await option.locator('input[type="radio"]').check();
  await expect(option).toHaveAttribute("data-active", "true");
  await expect(
    page.locator(`[data-theme-packages-list] [data-theme-id="${THEME_ID}"]`),
  ).toBeVisible();
  await shot(page, "01-theme-imported");

  // --- 2. Blocks the Theme designs: a variant on the hero, a new Block. ---
  await openFirstPage(page);
  await page.getByTestId("block-add").click();
  await page.locator('[data-testid="add-block-entry"][data-block-type="ctaBanner"]').click();
  await expect(page.getByTestId("add-block-dialog")).toHaveCount(0);
  await expect(page.getByTestId("block-row")).toHaveCount(2);

  // The new banner: its link is the external link the preview will open.
  await page.getByTestId("block-row").nth(1).getByTestId("block-row-select").click();
  await expect(page.getByTestId("inspector")).toBeVisible();
  await page.locator('[data-field="title"]').fill("Alătură-te nouă");
  await page.locator('[data-field="button.label"]').fill("Partenerul nostru");
  await page.locator('[data-field="button.url"]').fill("https://partner.example/");
  await page.getByTestId("block-variant-control").locator("select").selectOption("outline");
  await page.locator('[data-action="drill-back"]').click();

  // The hero: the Theme's Spotlight design, and an edited title.
  await page.getByTestId("block-row").nth(0).getByTestId("block-row-select").click();
  await expect(page.getByTestId("inspector")).toBeVisible();
  await page.getByTestId("block-variant-control").locator("select").selectOption("spotlight");
  await page.locator('[data-field="title"]').fill("Practice, live");
  await shot(page, "02-page-workspace");

  // Add the declared Custom Block and author its nested fields, not fixture data.
  await page.locator('[data-action="drill-back"]').click();
  await page.getByTestId("block-add").click();
  await page.locator(`[data-testid="add-block-entry"][data-block-type="${PARTNERS_TYPE}"]`).click();
  await expect(page.getByTestId("block-row")).toHaveCount(3);
  await page.getByTestId("block-row").nth(2).getByTestId("block-row-select").click();
  await page.locator('input[data-field="heading"]').fill("Împreună pentru comunitate");
  await page.locator('fieldset[data-field="groups"] > button[data-action="add"]').click();
  await page.locator('input[data-field="groups.0.heading"]').fill("Parteneri principali");
  await page
    .locator('fieldset[data-field="groups.0.partners"] > button[data-action="add"]')
    .click();
  await page.locator('input[data-field="groups.0.partners.0.name"]').fill("Asociația Exemplu");
  const logoPicker = page.locator('fieldset[data-field="groups.0.partners.0.image"]');
  await logoPicker.getByTestId("asset-picker-add").click();
  await logoPicker.getByTestId("asset-picker-file-input").setInputFiles({
    name: "partner-logo.png",
    mimeType: "image/png",
    buffer: LOGO,
  });
  await expect(logoPicker.getByTestId("asset-picker-thumbnail")).toBeVisible();
  await page
    .locator('input[data-field="groups.0.partners.0.image.alt"]')
    .fill("Sigla partenerului");
  await page.locator('select[data-field="groups.0.partners.0.link.kind"]').selectOption("page:1");
  await expect(page.getByTestId("link-target-select")).toHaveValue("page:1");

  // --- 3. The static preview: the executable shell, no public script. ---
  const staticFrame = await previewFrame(page, "static");
  await expect(staticFrame.locator("[data-site-nav]")).toHaveCount(1);
  await expect(staticFrame.locator('[data-block="hero"][data-variant="spotlight"]')).toHaveCount(1);
  await expect(staticFrame.locator('[data-block="ctaBanner"][data-variant="outline"]')).toHaveCount(
    1,
  );
  await expect(staticFrame.locator("h1")).toContainText("Practice, live");
  expect(await staticFrame.locator("script[data-sosb-theme-script]").count()).toBe(0);
  // The menu button ships hidden and stays hidden: no script reveals it.
  await expect(staticFrame.locator("[data-site-nav] .site-nav__toggle")).toBeHidden();
  await expect(staticFrame.locator("[data-site-nav]")).not.toHaveAttribute(
    "data-nav-enhanced",
    "true",
  );
  await expect(page.locator('[data-testid="preview-pane"] iframe')).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups",
  );
  await expectPartners(staticFrame);
  await shot(page, "03-static-preview");

  // --- 4. The interactive preview: the script runs, sealed off. ---
  await page.getByTestId("preview-interactive-toggle").check();
  await expect(page.getByTestId("preview-interactive-status")).toHaveAttribute("data-state", "on");
  await expect(page.getByTestId("preview-interactive-network")).toHaveText(
    "It contacts no other websites.",
  );
  await expect(page.locator('[data-testid="preview-pane"] iframe')).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-popups allow-popups-to-escape-sandbox",
  );
  const live = await previewFrame(page, "interactive");
  // public.js ran: it reveals the menu button and marks the header.
  await expect(live.locator('[data-site-nav][data-nav-enhanced="true"]')).toHaveCount(1);
  await expect(live.locator("script[data-sosb-theme-script]")).toHaveCount(1);
  const src = await live.locator("script[data-sosb-theme-script]").getAttribute("src");
  expect(src?.startsWith("data:text/javascript;base64,")).toBe(true);

  await expectPartners(live);
  await shot(page, "07-partners-interactive");

  // Isolation: an opaque origin with no way to the editor or its storage.
  const probe = await live.evaluate(() => {
    const out = { origin: location.origin, parent: "", storage: "", top: "" };
    try {
      void parent.document.title;
      out.parent = "reachable";
    } catch (error) {
      out.parent = (error as Error).name;
    }
    try {
      localStorage.getItem("x");
      out.storage = "reachable";
    } catch (error) {
      out.storage = (error as Error).name;
    }
    out.top = window.top === window ? "top" : "framed";
    return out;
  });
  expect(probe).toEqual({
    origin: "null",
    parent: "SecurityError",
    storage: "SecurityError",
    top: "framed",
  });
  // The editor is untouched by the script, and no blob: URL was needed.
  await expect(page.getByTestId("top-bar")).toBeVisible();
  expect(await live.evaluate(() => document.documentElement.outerHTML)).not.toContain("blob:");

  // External links still open in a new tab through the nav interceptor.
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    live.locator('[data-block="ctaBanner"] a[href="https://partner.example/"]').click(),
  ]);
  expect(popup.url()).toBe("https://partner.example/");
  await popup.close();

  // Internal links move the preview, as on the public website.
  await live.locator(`${PARTNERS_SELECTOR} a[href="/despre/"]`).click();
  await expect(page.getByTestId("preview-target-title")).toHaveText("Despre");
  const despre = await previewFrame(page, "interactive");
  await expect(despre.locator("h1")).toContainText("Despre noi");
  await expect(despre.locator('[data-site-nav][data-nav-enhanced="true"]')).toHaveCount(1);
  await shot(page, "04-interactive-preview");

  // Back to the static preview; the next edit morphs in place again.
  await page.getByTestId("preview-return").click();
  await page.getByTestId("preview-interactive-toggle").uncheck();
  await expect(page.getByTestId("preview-interactive-status")).toHaveCount(0);
  await expect(page.locator('[data-testid="preview-pane"] iframe')).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups",
  );

  // --- 5. Export the Site: the editable archive with its Theme, plus the built website. ---
  await page.locator('[data-action="export"]').click();
  const confirm = page.getByTestId("export-confirm-button");
  await expect(confirm).toBeVisible();
  await shot(page, "05-export-readiness");
  const [siteDownload] = await Promise.all([page.waitForEvent("download"), confirm.click()]);
  const archive = await unzip(siteDownload);
  const entries = await archive.list();
  expect(entries).toEqual(
    expect.arrayContaining([
      "data.json",
      `themes/${THEME_ID}/theme.json`,
      `themes/${THEME_ID}/render.js`,
      `themes/${THEME_ID}/public.js`,
      "dist/index.html",
      "dist/despre/index.html",
      `dist/assets/theme/${THEME_ID}/public.js`,
    ]),
  );
  const data = JSON.parse(new TextDecoder().decode(await archive.read("data.json"))) as {
    theme: { id: string };
    pages: {
      id?: string;
      slug: string;
      blocks: {
        type: string;
        variant?: string;
        data: {
          title?: string;
          heading?: string;
          groups?: {
            heading: string;
            partners: {
              name: string;
              image: { path: string; alt: string };
              link: { kind: string; pageId: string };
            }[];
          }[];
        };
      }[];
    }[];
  };
  expect(data.theme.id).toBe(THEME_ID);
  expect(data.pages[0]!.blocks[0]!.variant).toBe("spotlight");
  expect(data.pages[0]!.blocks[0]!.data.title).toBe("Practice, live");
  const partners = data.pages[0]!.blocks.find((block) => block.type === PARTNERS_TYPE);
  expect(partners?.data.heading).toBe("Împreună pentru comunitate");
  expect(partners?.data.groups).toHaveLength(1);
  const group = partners!.data.groups![0]!;
  expect(group.heading).toBe("Parteneri principali");
  expect(group.partners).toHaveLength(1);
  const partner = group.partners[0]!;
  expect(partner.name).toBe("Asociația Exemplu");
  const aboutId = data.pages.find((entry) => entry.slug === "despre")?.id;
  expect(aboutId).toEqual(expect.any(String));
  expect(partner.link).toEqual({ kind: "page", pageId: aboutId });
  expect(partner.image.alt).toBe("Sigla partenerului");
  expect(entries).toContain(partner.image.path);
  expect(entries).toContain(`dist/${partner.image.path}`);
  expect(Buffer.from(await archive.read(`dist/${partner.image.path}`))).toEqual(
    Buffer.from(await archive.read(partner.image.path)),
  );
  const home = new TextDecoder().decode(await archive.read("dist/index.html"));
  const builtPartners = await page.evaluate(
    ({ html, selector }) => {
      const block = new DOMParser().parseFromString(html, "text/html").querySelector(selector);
      return {
        heading: block?.querySelector("h2")?.textContent,
        group: block?.querySelector("h3")?.textContent,
        name: block?.querySelector("figcaption")?.textContent,
        href: block?.querySelector("a")?.getAttribute("href"),
        image: block?.querySelector("img")?.getAttribute("src"),
        alt: block?.querySelector("img")?.getAttribute("alt"),
      };
    },
    { html: home, selector: PARTNERS_SELECTOR },
  );
  expect(builtPartners).toEqual({
    heading: "Împreună pentru comunitate",
    group: "Parteneri principali",
    name: "Asociația Exemplu",
    href: "/despre/",
    image: partner.image.path,
    alt: "Sigla partenerului",
  });
  // The Theme's hero design wraps every word of the title in its own span.
  expect(home.replace(/<[^>]+>/g, "")).toContain("Practice, live");
  expect(home).toContain(
    `<script defer src="assets/theme/${THEME_ID}/public.js" data-sosb-theme-script></script>`,
  );
  const about = new TextDecoder().decode(await archive.read("dist/despre/index.html"));
  expect(about).toContain(`src="../assets/theme/${THEME_ID}/public.js"`);
  // The built website carries the script verbatim, never the design module,
  // and none of the preview-only scripts.
  expect(Buffer.from(await archive.read(`dist/assets/theme/${THEME_ID}/public.js`))).toEqual(
    Buffer.from(files.get("public.js")!),
  );
  expect(entries.filter((e) => e.startsWith("dist/") && e.endsWith("render.js"))).toEqual([]);
  expect(home).not.toContain("data-sosb-preview-nav");
  expect(home).not.toContain("data-sosb-preview-morph");
  expect(home).not.toContain("blob:");
  expect(home).not.toContain("data:text/javascript");

  // --- 6. Export the Theme package on its own: no Site content, structurally. ---
  await openSection(page, "theme");
  const [themeDownload] = await Promise.all([
    page.waitForEvent("download"),
    page
      .locator(`[data-theme-packages-list] [data-theme-id="${THEME_ID}"]`)
      .getByRole("button", { name: "Export" })
      .click(),
  ]);
  expect(themeDownload.suggestedFilename()).toBe(`${THEME_ID}-1.2.0.sosb-theme.zip`);
  const standalone = await unzip(themeDownload);
  expect((await standalone.list()).sort()).toEqual([...files.keys()].sort());
  for (const [file, bytes] of files) {
    expect(Buffer.from(await standalone.read(file))).toEqual(Buffer.from(bytes));
  }

  // --- 7. A fresh Site: the standalone package imports and renders. ---
  const fresh = await context.newPage();
  await mount(fresh, bundle, workflowSite());
  await importTheme(fresh, themeDownload.suggestedFilename(), Buffer.from(standalone.toZipBytes()));
  await fresh
    .locator(`[data-theme-option][data-theme-id="${THEME_ID}"] input[type="radio"]`)
    .check();
  await openFirstPage(fresh);
  const freshFrame = await previewFrame(fresh, "static");
  await expect(freshFrame.locator("[data-site-nav]")).toHaveCount(1);
  await expect(fresh.getByTestId("preview-interactive")).toBeVisible();
  await fresh.getByTestId("block-add").click();
  await fresh
    .locator(`[data-testid="add-block-entry"][data-block-type="${PARTNERS_TYPE}"]`)
    .click();
  await expect(fresh.getByTestId("block-row")).toHaveCount(2);
  await fresh.getByTestId("block-row").nth(1).getByTestId("block-row-select").click();
  // Standalone sharing brings the declaration and design, never Site content.
  await expect(fresh.locator('input[data-field="heading"]')).toHaveValue("");
  await fresh.locator('input[data-field="heading"]').fill("Partenerii noului site");
  await expect(freshFrame.locator(`${PARTNERS_SELECTOR} h2`)).toHaveText("Partenerii noului site");

  // --- 8. And the exported Site archive reopens whole in another fresh editor. ---
  const reopened = await context.newPage();
  await mount(reopened, bundle, workflowSite());
  const [chooser] = await Promise.all([
    reopened.waitForEvent("filechooser"),
    reopened.locator('[data-action="import"]').click(),
  ]);
  await chooser.setFiles({
    name: siteDownload.suggestedFilename(),
    mimeType: "application/zip",
    buffer: Buffer.from(archive.toZipBytes()),
  });
  await openFirstPage(reopened);
  await expect(reopened.getByTestId("block-row")).toHaveCount(3);
  const reopenedFrame = await previewFrame(reopened, "static");
  await expect(reopenedFrame.locator("h1")).toContainText("Practice, live");
  await expect(reopenedFrame.locator('[data-block="hero"][data-variant="spotlight"]')).toHaveCount(
    1,
  );
  await expect(reopenedFrame.locator("[data-site-nav]")).toHaveCount(1);
  await expectPartners(reopenedFrame);
  await reopened.getByTestId("block-row").nth(2).getByTestId("block-row-select").click();
  await expect(reopened.locator('input[data-field="heading"]')).toHaveValue(
    "Împreună pentru comunitate",
  );
  await expect(reopened.locator('input[data-field="groups.0.partners.0.name"]')).toHaveValue(
    "Asociația Exemplu",
  );
  await expect(reopened.getByTestId("link-target-select")).toHaveValue("page:1");
  await expect(reopened.getByTestId("asset-picker-thumbnail")).toBeVisible();
  await shot(reopened, "08-partners-reimported");
  await openSection(reopened, "theme");
  await expect(
    reopened.locator(`[data-theme-packages-list] [data-theme-id="${THEME_ID}"]`),
  ).toBeVisible();
  await expect(
    reopened.locator(`[data-theme-option][data-theme-id="${THEME_ID}"]`),
  ).toHaveAttribute("data-active", "true");
  await openFirstPage(reopened);
  await shot(reopened, "06-reimported-fresh-site");
});
