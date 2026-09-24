/**
 * The example Theme's Partners Custom Block (ADR 0055), end to end: the
 * declaration in `blocks/partners/block.json` loads into the registry and
 * validation, and `render.js` designs it in both variants through the
 * sandbox, the helpers and the tree validator. The output is pinned to
 * golden files, because a change to the sandbox bootstrap, the helper
 * marshalling (`linkUrl`, structured `richText`) or the tree validator can
 * alter it while every unit test still passes.
 *
 * Regenerate deliberately with `vitest -u` after a change to the example, and
 * read the diff.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { ThemeBundle } from "@sosb/renderer";
import { buildWithReport } from "@sosb/build";
import {
  buildCustomBlockRegistry,
  defaultCustomBlockData,
  validate,
  type BlockEnvelope,
  type Site,
} from "@sosb/schema";
import { loadThemePackageFromDirectoryAsync } from "../src/node.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

const loaded = await loadThemePackageFromDirectoryAsync(EXAMPLE_DIR);
const { bundle } = loaded;
const opened: ThemeBundle[] = [bundle];
afterAll(() => {
  for (const b of opened) b.render?.dispose();
});

const declaration = bundle.customBlocks?.find((d) => d.type === "org.example/partners");
if (declaration === undefined) throw new Error("the example declares no Partners block");

const registry = buildCustomBlockRegistry([
  { packageId: bundle.id, packageVersion: bundle.version, declarations: bundle.customBlocks ?? [] },
]);

/** The sample Site's partner logos, reused as Custom Block partners. */
function sampleLogos(site: Site): { name: string; logo: unknown; url: string }[] {
  const block = site.pages[0]!.blocks.find((b) => b.type === "partnerLogos");
  return (block?.data as { partners: { name: string; logo: unknown; url: string }[] }).partners;
}

function partnersBlock(site: Site, variant: "grid" | "band"): BlockEnvelope {
  const logos = sampleLogos(site);
  return {
    id: "blk_partners",
    type: "org.example/partners",
    version: declaration!.version,
    variant,
    data: {
      ...defaultCustomBlockData(declaration!),
      heading: "Partenerii noștri",
      intro: {
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Vezi și " },
              {
                type: "text",
                text: "pagina despre noi",
                marks: [{ type: "link", target: { kind: "page", pageId: "page_about" } }],
              },
              { type: "text", text: "." },
            ],
          },
        ],
      },
      groups: [
        {
          heading: "Parteneri principali",
          partners: [
            {
              name: logos[0]!.name,
              image: logos[0]!.logo,
              link: { kind: "external", href: logos[0]!.url },
            },
            {
              name: logos[1]!.name,
              image: logos[1]!.logo,
              link: { kind: "page", pageId: "page_about" },
            },
          ],
        },
        {
          heading: "Parteneri media",
          partners: [
            // No logo → initials; a Page that no longer exists → no link.
            { name: "Radio Campus", link: { kind: "page", pageId: "page_gone" } },
            { name: "Ziarul Studențesc" },
          ],
        },
      ],
    },
  };
}

function practiceSite(variant: "grid" | "band"): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: bundle.id, version: bundle.version, shellVariant: "standard" };
  site.pages[1]!.id = "page_about";
  site.pages[0]!.blocks.push(partnersBlock(site, variant));
  return site;
}

describe("examples/themes/practice — the Partners Custom Block", () => {
  test("declares the type, at version 1, with translated labels", () => {
    expect(loaded.manifest.blocks).toEqual(["blocks/partners/block.json"]);
    expect(declaration!.version).toBe(1);
    expect(declaration!.label).toEqual({ default: "Partners", ro: "Parteneri", en: "Partners" });
    expect(bundle.render?.blockTypes).toContain("org.example/partners");
    expect(bundle.blockVariants["org.example/partners"]?.map((v) => v.id)).toEqual([
      "grid",
      "band",
    ]);
  });

  test("the registry makes it available and validation checks its content rules", () => {
    expect(registry.lookup("org.example/partners")?.status).toBe("available");
    const site = practiceSite("grid");
    const result = validate(site, { customBlocks: registry });
    expect(result.errors.filter((i) => i.code.startsWith("block.custom"))).toEqual([]);
    // The missing Page link is a warning — it renders as unlinked text.
    expect(result.warnings.map((i) => i.code)).toContain("block.custom.link.missing");
    // A Block of the type with nothing filled in only warns about the required heading.
    const empty = practiceSite("grid");
    empty.pages[0]!.blocks.at(-1)!.data = defaultCustomBlockData(declaration!);
    const emptyResult = validate(empty, { customBlocks: registry });
    expect(emptyResult.errors).toEqual([]);
    expect(emptyResult.warnings.map((i) => i.code)).toContain("block.custom.field.required");
  });

  test("renders the grid variant: logos, initials, a Page link, and a missing Page unlinked", () => {
    const html = renderSite(practiceSite("grid"), bundle.id, { pageIndex: 0, theme: bundle });
    expect(html).toContain('data-block="org.example/partners"');
    expect(html).toContain('data-variant="grid"');
    expect(html).toContain('class="partners__group-title">Parteneri principali</h3>');
    expect(html).toContain('href="/despre/"');
    expect(html).toContain('class="partners__placeholder">RC</span>');
    // The partner whose Page is gone has no anchor at all.
    expect(html).not.toContain("page_gone");
    expect(html).toMatch(/<li><figure class="partners__item"><span[^>]*>RC<\/span>/);
    // The intro's Page link resolves through the same routing as prose.
    expect(html).toContain('<a href="/despre/">pagina despre noi</a>');
  });

  test("golden: grid", async () => {
    const html = renderSite(practiceSite("grid"), bundle.id, { pageIndex: 0, theme: bundle });
    await expect(html).toMatchFileSnapshot("__golden__/practice-partners-grid.html");
  });

  test("golden: band", async () => {
    const html = renderSite(practiceSite("band"), bundle.id, { pageIndex: 0, theme: bundle });
    expect(html).toContain('data-variant="band"');
    await expect(html).toMatchFileSnapshot("__golden__/practice-partners-band.html");
  });

  test("an empty Block renders nothing, and build() reports no omission for a designed type", () => {
    const site = practiceSite("grid");
    site.pages[0]!.blocks.at(-1)!.data = {};
    const html = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    // No root element is stamped (the stylesheet still mentions the type).
    expect(html).not.toContain('data-block-id="blk_partners"');
    const { omittedBlocks } = buildWithReport(practiceSite("band"), {
      themes: [bundle],
      skipValidation: true,
    });
    expect(omittedBlocks).toEqual([]);
  });

  test("determinism: a second realm renders the same bytes", async () => {
    const again = await loadThemePackageFromDirectoryAsync(EXAMPLE_DIR);
    opened.push(again.bundle);
    const site = practiceSite("grid");
    const first = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    const second = renderSite(site, again.bundle.id, { pageIndex: 0, theme: again.bundle });
    expect(second).toBe(first);
    expect(renderSite(site, bundle.id, { pageIndex: 0, theme: bundle })).toBe(first);
  });
});
