import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import minimalSite from "./fixtures/minimal-site.json" with { type: "json" };
import {
  linkTargetsFor,
  makePageIdFactory,
  matchesQuery,
  resolveTarget,
} from "../src/rich-text/link-targets.js";

/**
 * The link picker's catalogue and, more importantly, its identity
 * assignment.
 *
 * `Page.id` is optional because ADR 0002 forbids inventing fields when a
 * project is merely opened. That makes "when does a Page get an id?" a real
 * design question, and the answer — at the moment an author links at it —
 * is the part worth pinning down.
 */

function siteWith(pages: unknown[], articles?: unknown[]): Site {
  const site = structuredClone(minimalSite) as unknown as Site;
  site.pages = pages as Site["pages"];
  if (articles !== undefined) (site as unknown as { articles: unknown[] }).articles = articles;
  return site;
}

function page(slug: string, navLabel: string, extra: Record<string, unknown> = {}): unknown {
  return { slug, lang: "ro", navLabel, navOrder: 0, showInNav: true, blocks: [], ...extra };
}

describe("linkTargetsFor", () => {
  test("lists Pages then Articles for the requested language only", () => {
    const site = siteWith(
      [
        page("acasa", "Acasă"),
        page("despre", "Despre"),
        { ...(page("about", "About") as object), lang: "en" },
      ],
      [
        { id: "a1", lang: "ro", slug: "stire", title: "O știre", state: "published" },
        { id: "a2", lang: "en", slug: "news", title: "News", state: "published" },
      ],
    );
    const options = linkTargetsFor(site, "ro");
    expect(options.map((o) => o.kind)).toEqual(["page", "page", "article"]);
    expect(options.map((o) => o.label)).toEqual(["Acasă", "Despre", "O știre"]);
  });

  test("shows the URL a visitor would see as the secondary line", () => {
    const site = siteWith(
      [page("despre", "Despre")],
      [{ id: "a1", lang: "ro", slug: "stire", title: "O știre", state: "published" }],
    );
    const options = linkTargetsFor(site, "ro");
    expect(options[0]?.hint).toBe("/despre/");
    expect(options[1]?.hint).toBe("/articles/stire/");
  });

  test("includes Drafts, flagged", () => {
    // Linking ahead of publication is a normal way to work; issue #100 asks
    // for a warning, not a prohibition.
    const site = siteWith(
      [page("acasa", "Acasă")],
      [{ id: "a1", lang: "ro", slug: "ciorna", title: "Ciornă", state: "draft" }],
    );
    const draft = linkTargetsFor(site, "ro").find((o) => o.kind === "article");
    expect(draft?.isDraft).toBe(true);
  });

  test("a project with no Articles simply lists Pages", () => {
    const site = siteWith([page("acasa", "Acasă")]);
    expect(linkTargetsFor(site, "ro")).toHaveLength(1);
  });
});

describe("matchesQuery", () => {
  const option = {
    key: "page:0",
    kind: "page" as const,
    label: "Despre noi",
    hint: "/despre/",
    lang: "ro",
    isDraft: false,
    index: 0,
  };

  test("is case- and diacritic-insensitive", () => {
    // An author typing "stiri" should find "Știri". Requiring the right
    // diacritics to search a list you are looking at is not a search box.
    expect(matchesQuery({ ...option, label: "Știri" }, "stiri")).toBe(true);
    expect(matchesQuery(option, "DESPRE")).toBe(true);
  });

  test("matches the URL as well as the title", () => {
    expect(matchesQuery(option, "/despre/")).toBe(true);
  });

  test("an empty query matches everything", () => {
    expect(matchesQuery(option, "")).toBe(true);
  });

  test("a non-match is a non-match", () => {
    expect(matchesQuery(option, "contact")).toBe(false);
  });
});

describe("resolveTarget — lazy Page identity", () => {
  test("stamps an id on a Page that has none, and returns the updated Site", () => {
    const site = siteWith([page("acasa", "Acasă"), page("despre", "Despre")]);
    const option = linkTargetsFor(site, "ro")[1]!;

    const { site: next, target } = resolveTarget(site, option, makePageIdFactory(site));

    expect(target).toEqual({ kind: "page", pageId: "page_1" });
    expect(next.pages[1]?.id).toBe("page_1");
    // The original is untouched: the caller decides when to commit.
    expect(site.pages[1]).not.toHaveProperty("id");
    expect(next).not.toBe(site);
  });

  test("reuses an existing id rather than minting a second one", () => {
    const site = siteWith([page("acasa", "Acasă", { id: "page_7" })]);
    const option = linkTargetsFor(site, "ro")[0]!;
    const { site: next, target } = resolveTarget(site, option, makePageIdFactory(site));
    expect(target).toEqual({ kind: "page", pageId: "page_7" });
    // Nothing changed, so nothing needs committing.
    expect(next).toBe(site);
  });

  test("never mints an id that another Page already uses", () => {
    const site = siteWith([page("acasa", "Acasă", { id: "page_1" }), page("despre", "Despre")]);
    const option = linkTargetsFor(site, "ro")[1]!;
    const { target } = resolveTarget(site, option, makePageIdFactory(site));
    expect(target).toEqual({ kind: "page", pageId: "page_2" });
  });

  test("Article targets use the id the Article already has", () => {
    // Articles carry a permanent id from creation (issue #97), so there is
    // nothing to assign — only to read.
    const site = siteWith(
      [page("acasa", "Acasă")],
      [{ id: "art_42", lang: "ro", slug: "stire", title: "O știre", state: "published" }],
    );
    const option = linkTargetsFor(site, "ro").find((o) => o.kind === "article")!;
    const { site: next, target } = resolveTarget(site, option, makePageIdFactory(site));
    expect(target).toEqual({ kind: "article", articleId: "art_42" });
    expect(next).toBe(site);
  });
});

describe("makePageIdFactory", () => {
  test("produces readable, sequential, collision-free ids", () => {
    // Project files get diffed and read by hand; `page_3` is kinder there
    // than a UUID, and uniqueness is checked rather than assumed.
    const site = siteWith([page("a", "A", { id: "page_2" })]);
    const next = makePageIdFactory(site);
    expect([next(), next(), next()]).toEqual(["page_1", "page_3", "page_4"]);
  });
});
