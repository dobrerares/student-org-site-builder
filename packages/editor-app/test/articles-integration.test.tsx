/** @jsxImportSource react */
// @vitest-environment jsdom
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";
import { EditorApp } from "../src/editor-app.js";
import { ExportConfirmDialog } from "../src/export-confirm.js";
import { iframeSrcdocForArticle } from "../src/iframe-srcdoc.js";
import { resolvePreviewTarget } from "../src/preview-navigation.js";
import { createArticle, updateArticle } from "../src/articles-ops.js";

function baseSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org", email: "a@b.ro" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
    ],
  } as unknown as Site;
}

function siteWithArticle(): Site {
  const { site } = createArticle(baseSite(), {
    title: "Gala de final",
    lang: "ro",
    today: "2026-06-12",
  });
  return updateArticle(site, 0, { state: "published", summary: "Rezumat." });
}

afterEach(() => {
  cleanup();
});

describe("editor shell — Articles destination and workspace", () => {
  test("the editor opens on the Overview, with Articles one click away", () => {
    const { getByTestId, queryByTestId } = render(<EditorApp initial={baseSite()} />);
    expect(getByTestId("overview")).toBeTruthy();
    expect(queryByTestId("articles-screen")).toBeNull();
    expect(getByTestId("nav-overview").getAttribute("aria-current")).toBe("page");
  });

  test("the Articles destination lists articles", () => {
    const { getByTestId } = render(<EditorApp initial={siteWithArticle()} />);
    fireEvent.click(getByTestId("nav-articles"));
    expect(getByTestId("articles-screen")).toBeTruthy();
    expect(getByTestId("article-row-art_1")).toBeTruthy();
    expect(getByTestId("nav-articles").getAttribute("aria-current")).toBe("page");
  });

  test("opening an article mounts its workspace: title, state, Blocks, settings behind a row", () => {
    const { container, getByTestId } = render(<EditorApp initial={siteWithArticle()} />);
    fireEvent.click(getByTestId("nav-articles"));
    fireEvent.click(getByTestId("article-open-art_1"));

    expect((getByTestId("workspace-title") as HTMLInputElement).value).toBe("Gala de final");
    expect(getByTestId("workspace-state-published").getAttribute("aria-pressed")).toBe("true");
    expect(getByTestId("block-list")).toBeTruthy();
    // The preview beside it renders the Article itself.
    expect(
      container
        .querySelector<HTMLIFrameElement>('[data-testid="preview-pane"] iframe')
        ?.getAttribute("srcdoc"),
    ).toContain("Gala de final");

    fireEvent.click(getByTestId("workspace-settings-link"));
    expect(getByTestId("inspector").getAttribute("data-inspector-mode")).toBe("article-settings");
    expect(getByTestId("article-settings-form")).toBeTruthy();
    expect(getByTestId("drill-back").textContent).toContain("Gala de final");
  });

  test("the article workspace reuses the shared block inspector", () => {
    const { getByTestId } = render(<EditorApp initial={siteWithArticle()} />);
    fireEvent.click(getByTestId("nav-articles"));
    fireEvent.click(getByTestId("article-open-art_1"));
    const selectButton = getByTestId("block-list").querySelector(
      '[data-testid="block-row-select"]',
    );
    fireEvent.click(selectButton!);
    const inspector = getByTestId("inspector");
    expect(inspector.getAttribute("data-inspector-mode")).toBe("block");
    expect(inspector.getAttribute("data-block-type")).toBe("richText");
  });

  test("related articles is off by default and preserves settings when toggled", () => {
    const { getByTestId, queryByTestId } = render(<EditorApp initial={siteWithArticle()} />);
    fireEvent.click(getByTestId("nav-articles"));
    fireEvent.click(getByTestId("article-open-art_1"));
    const toggle = getByTestId("article-related-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(queryByTestId("article-related-configure")).toBeNull();

    fireEvent.click(toggle);
    fireEvent.click(getByTestId("article-related-configure"));
    expect(getByTestId("inspector").getAttribute("data-inspector-mode")).toBe("related");
    expect(getByTestId("article-list-inspector")).toBeTruthy();

    fireEvent.click(getByTestId("drill-back"));
    fireEvent.click(getByTestId("article-related-toggle"));
    expect(queryByTestId("article-related-configure")).toBeNull();
    // Switching back on restores the configuration rather than starting over.
    fireEvent.click(getByTestId("article-related-toggle"));
    expect(queryByTestId("article-related-configure")).not.toBeNull();
  });

  test("going back returns to the list", () => {
    const { getByTestId, queryByTestId } = render(<EditorApp initial={siteWithArticle()} />);
    fireEvent.click(getByTestId("nav-articles"));
    fireEvent.click(getByTestId("article-open-art_1"));
    fireEvent.click(getByTestId("workspace-back"));
    expect(getByTestId("articles-screen")).toBeTruthy();
    expect(queryByTestId("workspace")).toBeNull();
  });

  test("Create Article opens a Draft at once, and its address follows the title", () => {
    const { getByTestId, queryByTestId } = render(<EditorApp initial={baseSite()} />);
    fireEvent.click(getByTestId("nav-create-article"));

    expect(getByTestId("workspace")).toBeTruthy();
    expect((getByTestId("workspace-title") as HTMLInputElement).value).toBe("");
    expect(getByTestId("workspace-state-draft").getAttribute("aria-pressed")).toBe("true");
    // One Rich-text Block to start writing in.
    expect(getByTestId("block-list").querySelectorAll('[data-testid="block-row"]').length).toBe(1);
    expect(queryByTestId("article-create-dialog")).toBeNull();

    fireEvent.change(getByTestId("workspace-title"), { target: { value: "Gala de final" } });
    fireEvent.click(getByTestId("workspace-settings-link"));
    expect(
      (getByTestId("article-settings-form").querySelector("#article-slug") as HTMLInputElement)
        .value,
    ).toBe("gala-de-final");
  });

  test("the address stops following the title once the author edits it", () => {
    const { getByTestId } = render(<EditorApp initial={baseSite()} />);
    fireEvent.click(getByTestId("nav-create-article"));
    fireEvent.click(getByTestId("workspace-settings-link"));
    const slug = getByTestId("article-settings-form").querySelector(
      "#article-slug",
    ) as HTMLInputElement;
    fireEvent.change(slug, { target: { value: "gala-2026" } });
    fireEvent.blur(slug);
    fireEvent.click(getByTestId("drill-back"));

    fireEvent.change(getByTestId("workspace-title"), { target: { value: "Alt titlu" } });
    fireEvent.click(getByTestId("workspace-settings-link"));
    expect(
      (getByTestId("article-settings-form").querySelector("#article-slug") as HTMLInputElement)
        .value,
    ).toBe("gala-2026");
  });

  test("an articleList block on a page gets the hand-coded inspector", () => {
    const site = siteWithArticle();
    site.pages[0]!.blocks.push({
      id: "blk_list",
      type: "articleList",
      version: 1,
      data: { title: "Noutăți", mode: "byTag" },
    } as never);
    const { getByTestId, getAllByTestId } = render(<EditorApp initial={site} />);
    fireEvent.click(getByTestId("overview-page-acasa"));
    const selects = getAllByTestId("block-row-select");
    fireEvent.click(selects[selects.length - 1]!);
    expect(getByTestId("article-list-inspector")).toBeTruthy();
  });
});

describe("article preview", () => {
  test("uses the real renderer, so preview matches export", () => {
    const html = iframeSrcdocForArticle(siteWithArticle(), "stub", 0);
    expect(html).toContain('class="article"');
    expect(html).toContain("Gala de final");
    expect(html).toContain("Rezumat.");
  });

  test("previews a draft, which export deliberately omits", () => {
    const site = createArticle(baseSite(), {
      title: "Ciornă",
      lang: "ro",
      today: "2026-06-12",
    }).site;
    expect(iframeSrcdocForArticle(site, "stub", 0)).toContain("Ciornă");
  });
});

describe("preview navigation resolves article links", () => {
  const site = siteWithArticle();

  test("a page path resolves to a page", () => {
    expect(resolvePreviewTarget(site, "/")).toEqual({ kind: "page", index: 0 });
  });

  test("an article path resolves to an article", () => {
    expect(resolvePreviewTarget(site, "/articles/gala-de-final/")).toEqual({
      kind: "article",
      index: 0,
    });
  });

  test("a retired slug resolves like the redirect would", () => {
    const renamed = updateArticle(site, 0, { slug: "gala-2026", slugHistory: ["gala-de-final"] });
    expect(resolvePreviewTarget(renamed, "/articles/gala-de-final/")).toEqual({
      kind: "article",
      index: 0,
    });
  });

  test("an unknown path is a soft no-match", () => {
    expect(resolvePreviewTarget(site, "/nothing-here/")).toBeNull();
  });

  test("a relative link resolves against the article being previewed", () => {
    // An author-written link on the article page, two directories deep.
    expect(resolvePreviewTarget(site, "../../", { kind: "article", index: 0 })).toEqual({
      kind: "page",
      index: 0,
    });
  });

  test("a relative link from a page can reach an article", () => {
    expect(
      resolvePreviewTarget(site, "articles/gala-de-final/", { kind: "page", index: 0 }),
    ).toEqual({ kind: "article", index: 0 });
  });

  test("hashes and query strings do not defeat article matching", () => {
    expect(resolvePreviewTarget(site, "/articles/gala-de-final/#end")).toEqual({
      kind: "article",
      index: 0,
    });
  });
});

describe("export gate", () => {
  function siteWithBrokenSelection(): Site {
    const site = siteWithArticle();
    site.pages[0]!.blocks.push({
      id: "blk_list",
      type: "articleList",
      version: 1,
      data: { mode: "selected", articleIds: ["ghost"] },
    } as never);
    return site;
  }

  test("an ordinary error still offers the typed-phrase override", () => {
    const result = validate({ ...baseSite(), org: { name: "" } });
    const { getByTestId } = render(
      <ExportConfirmDialog result={result} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(getByTestId("export-confirm-input")).toBeTruthy();
    expect((getByTestId("export-confirm-button") as HTMLButtonElement).disabled).toBe(true);
  });

  test("a blocking issue removes the override entirely", () => {
    const result = validate(siteWithBrokenSelection());
    const { getByTestId, queryByTestId } = render(
      <ExportConfirmDialog result={result} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(queryByTestId("export-confirm-input")).toBeNull();
    const button = getByTestId("export-confirm-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("data-blocked")).toBe("true");
  });

  test("a blocked dialog says the project itself is still saved", () => {
    const result = validate(siteWithBrokenSelection());
    const { getByTestId } = render(
      <ExportConfirmDialog result={result} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(getByTestId("export-confirm-dialog").textContent).toContain("project is still saved");
  });

  test("warnings alone still export in one click", () => {
    const site = siteWithArticle();
    delete (site.org as { email?: string }).email;
    const result = validate(site);
    const { getByTestId } = render(
      <ExportConfirmDialog result={result} onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect((getByTestId("export-confirm-button") as HTMLButtonElement).disabled).toBe(false);
  });
});
