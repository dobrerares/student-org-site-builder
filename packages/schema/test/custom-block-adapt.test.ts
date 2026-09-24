/**
 * Author-controlled extension updates (ADR 0055; issue-106 plan): adapting
 * saved data to a changed declaration keeps every field that remains, starts
 * new fields empty, and names the content a removed field would take with it.
 */
import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import {
  adaptCustomBlockData,
  adaptSiteToDeclarations,
  parseCustomBlockDeclaration,
  type CustomBlockDeclaration,
  type Site,
} from "../src/index.js";
import { PARTNERS_DECLARATION } from "./fixtures/partners-declaration.js";

function decl(raw: unknown): CustomBlockDeclaration {
  const result = parseCustomBlockDeclaration(raw);
  if (!result.ok) throw new Error(result.message);
  return result.declaration;
}

const v1 = decl(PARTNERS_DECLARATION);

/** v2 adds a partner description, drops the intro, and turns `count` into text. */
const v2 = decl({
  ...PARTNERS_DECLARATION,
  version: 2,
  fields: [
    { name: "heading", kind: "text", label: "Heading", required: true },
    { name: "showHeadings", kind: "boolean", label: "Show group headings", default: true },
    { name: "count", kind: "text", label: "Count as text" },
    { name: "tagline", kind: "text", label: "Tagline" },
    { name: "compact", kind: "boolean", label: "Compact", default: false },
    {
      name: "groups",
      kind: "list",
      label: "Groups",
      item: {
        kind: "group",
        fields: [
          { name: "heading", kind: "text", label: "Group heading" },
          {
            name: "partners",
            kind: "list",
            label: "Partners",
            item: {
              kind: "group",
              fields: [
                { name: "name", kind: "text", label: "Name" },
                { name: "description", kind: "text", label: "Description" },
                { name: "image", kind: "image", label: "Logo" },
                { name: "link", kind: "link", label: "Link" },
              ],
            },
          },
        ],
      },
    },
  ],
});

const SAVED = {
  heading: "Our partners",
  intro: { version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] },
  showHeadings: false,
  layout: "roomy",
  count: 4,
  groups: [
    {
      heading: "Gold",
      partners: [
        {
          name: "Alpha",
          image: {
            hash: "h",
            path: "assets/h.png",
            metadataPath: "assets/h.json",
            mime: "image/png",
            width: 1,
            height: 1,
            alt: "Alpha",
          },
          link: { kind: "external", href: "https://alpha.example" },
        },
      ],
    },
  ],
  futureKey: { anything: true },
};

describe("adaptCustomBlockData", () => {
  test("keeps every remaining field's content, adds nothing to saved content", () => {
    const { data } = adaptCustomBlockData(v1, v2, SAVED);
    expect(data["heading"]).toBe("Our partners");
    expect(data["showHeadings"]).toBe(false);
    const groups = data["groups"] as {
      heading: string;
      partners: { name: string; image: unknown; link: unknown }[];
    }[];
    expect(groups[0]!.heading).toBe("Gold");
    expect(groups[0]!.partners[0]!.name).toBe("Alpha");
    expect(groups[0]!.partners[0]!.image).toEqual(SAVED.groups[0]!.partners[0]!.image);
    expect(groups[0]!.partners[0]!.link).toEqual(SAVED.groups[0]!.partners[0]!.link);
    // The new description starts empty (absent), not with sample content.
    expect("description" in groups[0]!.partners[0]!).toBe(false);
    expect("tagline" in data).toBe(false);
  });

  test("switch defaults apply only to fields the update introduces", () => {
    const { data } = adaptCustomBlockData(v1, v2, SAVED);
    expect(data["compact"]).toBe(false);
    expect(data["showHeadings"]).toBe(false);
    // A switch both versions declare that the author never set stays unset:
    // an appearance-only update must write nothing.
    const { heading, groups } = SAVED;
    const untouched = adaptCustomBlockData(v1, v1, { heading, groups });
    expect(untouched.data).toEqual({ heading, groups });
    // With no previous declaration nothing counts as new.
    expect("compact" in adaptCustomBlockData(undefined, v2, { heading }).data).toBe(false);
  });

  test("removed fields and kind changes are listed with their old label and a preview", () => {
    const { data, removed } = adaptCustomBlockData(v1, v2, SAVED);
    const summary = removed.map((r) => [r.path.join("."), r.label, r.preview]);
    expect(summary).toContainEqual(["intro", "Intro", "formatted text"]);
    expect(summary).toContainEqual(["layout", "Layout", "roomy"]);
    expect(summary).toContainEqual(["count", "Count", "4"]);
    expect("intro" in data).toBe(false);
    expect("layout" in data).toBe(false);
    expect("count" in data).toBe(false);
  });

  test("keys neither declaration knows are preserved (ADR 0002)", () => {
    const { data, removed } = adaptCustomBlockData(v1, v2, SAVED);
    expect(data["futureKey"]).toEqual({ anything: true });
    expect(removed.map((r) => r.path.join("."))).not.toContain("futureKey");
  });

  test("empty removed fields are not reported", () => {
    const { removed } = adaptCustomBlockData(v1, v2, { heading: "x", layout: "", groups: [] });
    expect(removed).toEqual([]);
  });

  test("an appearance-only update changes nothing", () => {
    const { data, removed } = adaptCustomBlockData(v1, v1, SAVED);
    expect(data).toEqual(SAVED);
    expect(removed).toEqual([]);
  });

  test("without an old declaration nothing is removed except values the new kind cannot hold", () => {
    const { data, removed } = adaptCustomBlockData(undefined, v2, SAVED);
    expect(data["intro"]).toEqual(SAVED.intro);
    expect(data["layout"]).toBe("roomy");
    expect(removed.map((r) => r.path.join("."))).toEqual(["count"]);
  });
});

describe("adaptSiteToDeclarations", () => {
  test("adapts every Block of the type across Pages and Articles and stamps the version", () => {
    const site = structuredClone(historipol) as unknown as Site;
    site.pages[0]!.blocks.push({ id: "b1", type: "org.example/partners", version: 1, data: SAVED });
    site.articles = [
      {
        id: "a1",
        lang: site.defaultLanguage,
        slug: "a",
        title: "Draft article",
        state: "draft",
        publishedAt: "2026-01-01",
        blocks: [
          { id: "b2", type: "org.example/partners", version: 1, data: { intro: SAVED.intro } },
        ],
      } as unknown as NonNullable<Site["articles"]>[number],
    ];
    const result = adaptSiteToDeclarations(site, [v2], [v1]);
    expect(result.changedBlocks).toBe(2);
    expect(result.site.pages[0]!.blocks.at(-1)!.version).toBe(2);
    expect(result.site.articles![0]!.blocks[0]!.version).toBe(2);
    expect(result.removed.map((r) => [r.blockId, r.document.title, r.path.join(".")])).toEqual(
      expect.arrayContaining([
        ["b1", site.pages[0]!.navLabel, "intro"],
        ["b2", "Draft article", "intro"],
      ]),
    );
    // The input is untouched.
    expect(site.pages[0]!.blocks.at(-1)!.version).toBe(1);
  });

  test("returns the same Site object when nothing changes", () => {
    const site = structuredClone(historipol) as unknown as Site;
    site.pages[0]!.blocks.push({ id: "b1", type: "org.example/partners", version: 1, data: SAVED });
    expect(adaptSiteToDeclarations(site, [v1], [v1]).site).toBe(site);
  });
});
