/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * The link picker behind a Custom Block `link` field (ADR 0055): a Page is
 * stored by identity — stamped on first use, like the rich-text link dialog
 * — a deleted Page is "missing" and repairable, an address is typed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { RichTextLinkTarget, Site } from "@sosb/schema";

import { LinkTargetField } from "../src/link-target-field.js";
import minimal from "./fixtures/minimal-site.json" with { type: "json" };

function siteWithPages(): Site {
  const site = structuredClone(minimal) as unknown as Site;
  site.pages.push({
    slug: "despre",
    lang: "ro",
    navLabel: "Despre",
    navOrder: 1,
    showInNav: true,
    blocks: [],
  });
  site.articles = [
    {
      id: "art_pub",
      lang: "ro",
      slug: "salut",
      title: "Salut",
      state: "published",
      publishedAt: "2026-01-01",
      blocks: [],
    },
    {
      id: "art_draft",
      lang: "ro",
      slug: "ciorna",
      title: "Ciornă",
      state: "draft",
      publishedAt: "2026-01-01",
      blocks: [],
    },
  ] as unknown as Site["articles"];
  return site;
}

function mount(value: RichTextLinkTarget | undefined, site = siteWithPages()) {
  const changes: (RichTextLinkTarget | undefined)[] = [];
  const sites: Site[] = [];
  const view = render(
    <LinkTargetField
      value={value}
      onChange={(next) => changes.push(next)}
      context={{ site, lang: "ro", onApplySite: (next) => sites.push(next) }}
      dottedPath="link"
      label="Link"
    />,
  );
  const select = view.container.querySelector<HTMLSelectElement>(
    '[data-testid="link-target-select"]',
  )!;
  return { ...view, changes, sites, select };
}

describe("LinkTargetField", () => {
  afterEach(cleanup);

  test("lists no link, a web address, then this language's Pages and Articles", () => {
    const { select } = mount(undefined);
    const groups = [...select.querySelectorAll("optgroup")].map((g) => g.label);
    expect(groups).toEqual(["Pages", "Articles"]);
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels).toEqual([
      "No link",
      "A web address",
      "Acasă",
      "Despre",
      "Salut",
      "Ciornă (draft)",
    ]);
    expect(select.value).toBe("");
  });

  test("choosing a Page stores its identity, stamping an id on the Page first", () => {
    const { select, changes, sites } = mount(undefined);
    fireEvent.change(select, { target: { value: "page:1" } });
    expect(sites).toHaveLength(1);
    const stamped = sites[0]!.pages[1]!.id;
    expect(stamped).toMatch(/^page_\d+$/);
    expect(changes).toEqual([{ kind: "page", pageId: stamped }]);
  });

  test("a Page with an id is selected back by that id, whatever its slug", () => {
    const site = siteWithPages();
    site.pages[1]!.id = "page_about";
    site.pages[1]!.slug = "renamed";
    const { select } = mount({ kind: "page", pageId: "page_about" }, site);
    expect(select.value).toBe("page:1");
    expect(select.options[select.selectedIndex]?.textContent).toBe("Despre");
  });

  test("a deleted Page is shown as missing and can be replaced or removed", () => {
    const { container, select, changes } = mount({ kind: "page", pageId: "page_gone" });
    expect(select.value).toBe("missing");
    expect(container.querySelector('[data-testid="link-target-missing"]')?.textContent).toMatch(
      /Page missing/,
    );
    expect(container.querySelector('[data-link-missing="true"]')).not.toBeNull();
    fireEvent.change(select, { target: { value: "" } });
    expect(changes).toEqual([undefined]);
  });

  test("an Article is stored by id and a Draft is flagged", () => {
    const { container, select, changes } = mount(undefined);
    fireEvent.change(select, { target: { value: "article:1" } });
    expect(changes).toEqual([{ kind: "article", articleId: "art_draft" }]);
    cleanup();
    const draft = mount({ kind: "article", articleId: "art_draft" });
    expect(draft.container.querySelector('[data-testid="link-target-draft"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="link-target-draft"]')).toBeNull();
  });

  test("a web address is typed and checked as it is entered", () => {
    const { select, changes } = mount(undefined);
    fireEvent.change(select, { target: { value: "external" } });
    expect(changes).toEqual([{ kind: "external", href: "" }]);
    cleanup();
    const typed = mount({ kind: "external", href: "https://example.org" });
    const input = typed.container.querySelector<HTMLInputElement>(
      '[data-testid="link-target-href"]',
    )!;
    expect(input.value).toBe("https://example.org");
    fireEvent.input(input, { target: { value: "javascript:alert(1)" } });
    expect(typed.changes).toEqual([{ kind: "external", href: "javascript:alert(1)" }]);
    cleanup();
    const bad = mount({ kind: "external", href: "javascript:alert(1)" });
    expect(bad.container.querySelector("[data-field-issue]")?.textContent).toMatch(
      /full web address/,
    );
  });

  test("without the shell's context it is an inert marker", () => {
    const { container } = render(
      <LinkTargetField
        value={undefined}
        onChange={() => undefined}
        context={undefined}
        dottedPath="link"
        label="Link"
      />,
    );
    expect(container.querySelector('[data-renderer="link-target"]')).not.toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });
});
