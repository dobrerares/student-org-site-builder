import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { hasBlockingIssues, validate, type Site } from "../src/index.js";

/**
 * Rich-text Site Health rules (ADR 0048, issue #100).
 *
 * The interesting property under test is not that findings appear, but that
 * they carry the right *weight*. ADR 0016's rule is "errors are blocking on
 * confirmation, never a hard block"; ADR 0048 carves out two exceptions and
 * nothing else. Getting that wrong in either direction is a real failure: a
 * missing image description that blocked export would make the tool
 * unusable, and unreadable content that did not would publish a page with
 * the author's words silently missing.
 */

function siteWith(doc: unknown, extra: Record<string, unknown> = {}): Site {
  const site = structuredClone(historipol) as unknown as Site;
  site.pages[0]!.blocks = [
    { id: "blk_rt", type: "richText", version: 2, data: { doc } },
  ] as unknown as Site["pages"][number]["blocks"];
  return Object.assign(site, extra);
}

function doc(...content: unknown[]): unknown {
  return { version: 1, content };
}

function para(text: string): unknown {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function imageNode(alt: string, path = "assets/abc.png"): unknown {
  return {
    type: "image",
    asset: {
      hash: "abc",
      path,
      metadataPath: "assets/abc.json",
      mime: "image/png",
      width: 100,
      height: 80,
      alt,
    },
  };
}

/**
 * A minimal but *valid* Article. `articlesById` parses through the Article
 * schema, so a structural stand-in with only `id` and `state` is silently
 * skipped — which would make every assertion below pass for the wrong reason.
 */
function article(overrides: Record<string, unknown>): unknown {
  return {
    id: "art_1",
    lang: "ro",
    slug: "o-stire",
    title: "O știre",
    publishedAt: "2026-01-01",
    state: "published",
    blocks: [],
    ...overrides,
  };
}

function linkPara(target: unknown): unknown {
  return {
    type: "paragraph",
    content: [{ type: "text", text: "vezi", marks: [{ type: "link", target }] }],
  };
}

describe("rich-text validation — emptiness", () => {
  test("an empty document is a warning, not an error", () => {
    const result = validate(siteWith(doc()));
    expect(result.warnings.map((w) => w.code)).toContain("block.richText.doc.empty");
    expect(result.errors).toEqual([]);
  });

  test("a document with prose raises nothing", () => {
    const result = validate(siteWith(doc(para("Text real."))));
    expect(result.warnings.map((w) => w.code)).not.toContain("block.richText.doc.empty");
  });
});

describe("rich-text validation — unsupported content", () => {
  test("an unknown node is an error that the export dialog cannot override", () => {
    const result = validate(siteWith(doc({ type: "futureCallout" })));
    const issue = result.errors.find((e) => e.code === "block.richText.content.unsupported");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBe(true);
    expect(hasBlockingIssues(result)).toBe(true);
    // The path points at the offending node so Site Health can jump to it.
    expect(issue?.path).toEqual(["pages", 0, "blocks", 0, "data", "doc", "content", 0]);
  });

  test("an unknown mark is reported with its own path", () => {
    const result = validate(
      siteWith(
        doc({
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "futureHighlight" }] }],
        }),
      ),
    );
    const issue = result.errors.find((e) => e.code === "block.richText.content.unsupported");
    expect(issue?.path).toEqual([
      "pages",
      0,
      "blocks",
      0,
      "data",
      "doc",
      "content",
      0,
      "content",
      0,
      "marks",
      0,
    ]);
  });

  test("supported content produces no blocking issue", () => {
    const result = validate(siteWith(doc(para("Totul e în regulă."))));
    expect(hasBlockingIssues(result)).toBe(false);
  });
});

describe("rich-text validation — images", () => {
  test("a missing image description is a warning, never a blocker", () => {
    const result = validate(siteWith(doc(imageNode(""))));
    const issue = result.warnings.find((w) => w.code === "block.richText.image.alt.missing");
    expect(issue).toBeDefined();
    expect(hasBlockingIssues(result)).toBe(false);
  });

  test("a whitespace-only description counts as missing", () => {
    const result = validate(siteWith(doc(imageNode("   "))));
    expect(result.warnings.map((w) => w.code)).toContain("block.richText.image.alt.missing");
  });

  test("missing image bytes block export, but only when the host can tell", () => {
    const site = siteWith(doc(imageNode("Descriere bună")));

    // Without the host predicate the check simply does not run: validation
    // cannot invent knowledge of the project's files.
    expect(validate(site).errors).toEqual([]);

    const present = validate(site, { assetPathExists: () => true });
    expect(present.errors).toEqual([]);

    const absent = validate(site, { assetPathExists: () => false });
    const issue = absent.errors.find((e) => e.code === "block.richText.image.bytes.missing");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBe(true);
  });
});

describe("rich-text validation — link targets", () => {
  test("a Page target that resolves raises nothing", () => {
    const site = siteWith(doc(linkPara({ kind: "page", pageId: "page_1" })));
    site.pages[0]!.id = "page_1";
    const result = validate(site);
    expect(result.warnings.map((w) => w.code)).not.toContain("block.richText.link.missing");
  });

  test("a deleted Page target warns and never blocks", () => {
    const result = validate(siteWith(doc(linkPara({ kind: "page", pageId: "page_gone" }))));
    const issue = result.warnings.find((w) => w.code === "block.richText.link.missing");
    expect(issue).toBeDefined();
    // ADR 0048 revises issue #97's blanket blocking rule for prose links.
    expect(hasBlockingIssues(result)).toBe(false);
    expect(result.errors).toEqual([]);
  });

  test("a Draft Article target gets its own, more helpful finding", () => {
    const site = siteWith(doc(linkPara({ kind: "article", articleId: "art_1" })));
    (site as unknown as { articles: unknown[] }).articles = [article({ state: "draft" })];
    const codes = validate(site).warnings.map((w) => w.code);
    expect(codes).toContain("block.richText.link.draft");
    expect(codes).not.toContain("block.richText.link.missing");
  });

  test("an Unlisted Article is a legitimate target", () => {
    const site = siteWith(doc(linkPara({ kind: "article", articleId: "art_1" })));
    (site as unknown as { articles: unknown[] }).articles = [article({ state: "unlisted" })];
    const codes = validate(site).warnings.map((w) => w.code);
    expect(codes).not.toContain("block.richText.link.draft");
    expect(codes).not.toContain("block.richText.link.missing");
  });

  test("external links are not link-resolved", () => {
    const result = validate(
      siteWith(doc(linkPara({ kind: "external", href: "https://anosr.ro" }))),
    );
    expect(result.warnings.map((w) => w.code)).not.toContain("block.richText.link.missing");
  });

  test("an external address the Renderer would refuse is a schema error, never silent", () => {
    // A hand-edited project file is the realistic source. The document schema
    // accepts exactly what the Renderer links, so the text node does not fall
    // back to the loose unknown-node shape: the Block fails to parse and the
    // author sees where. An ordinary, overridable error — not a blocker.
    const result = validate(
      siteWith(doc(linkPara({ kind: "external", href: "javascript:alert(1)" }))),
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((e) => e.path.slice(0, 4).join(".") === "pages.0.blocks.0")).toBe(
      true,
    );
    expect(hasBlockingIssues(result)).toBe(false);
  });

  test("addresses the legacy Markdown renderer accepted stay valid after migration", () => {
    // `[text](#anchor)` migrates to an external target the link dialog's
    // typed-input rule would not accept, yet it renders as a link. The schema
    // follows the Renderer, so migrated content raises nothing.
    const result = validate(siteWith(doc(linkPara({ kind: "external", href: "#sus" }))));
    expect(result.errors).toEqual([]);
  });
});

describe("rich-text validation — the Draft carve-out", () => {
  function siteWithArticle(state: string, doc: unknown): Site {
    const site = structuredClone(historipol) as unknown as Site;
    site.pages[0]!.blocks = [] as unknown as Site["pages"][number]["blocks"];
    (site as unknown as { articles: unknown[] }).articles = [
      article({
        state,
        blocks: [{ id: "blk_rt", type: "richText", version: 2, data: { doc } }],
      }),
    ];
    return site;
  }

  const unreadable = doc({ type: "futureCallout" });

  test("unsupported content inside a Draft is reported but does not block export", () => {
    // Issue #100: "Problems confined to Draft articles do not block public
    // export." A Draft is never emitted, so nothing inside it can make
    // public output wrong.
    const result = validate(siteWithArticle("draft", unreadable));
    const issue = result.errors.find((e) => e.code === "block.richText.content.unsupported");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBeUndefined();
    expect(hasBlockingIssues(result)).toBe(false);
  });

  test("the same content in a Published Article does block", () => {
    const result = validate(siteWithArticle("published", unreadable));
    expect(hasBlockingIssues(result)).toBe(true);
  });

  test("an Unlisted Article counts as public content", () => {
    // Unlisted is "hidden from discovery", not "not published" — the page is
    // emitted and reachable, so broken content there is broken in public.
    const result = validate(siteWithArticle("unlisted", unreadable));
    expect(hasBlockingIssues(result)).toBe(true);
  });

  test("missing image bytes follow the same rule", () => {
    const withImage = doc(imageNode("Descriere"));
    const draft = validate(siteWithArticle("draft", withImage), {
      assetPathExists: () => false,
    });
    expect(draft.errors.some((e) => e.code === "block.richText.image.bytes.missing")).toBe(true);
    expect(hasBlockingIssues(draft)).toBe(false);

    const published = validate(siteWithArticle("published", withImage), {
      assetPathExists: () => false,
    });
    expect(hasBlockingIssues(published)).toBe(true);
  });
});
