/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import { openSection, setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

function makeMultiPageSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org" },
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
        seo: { title: "Stub — Acasă" },
        blocks: [{ id: "blk_home_hero", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        seo: { title: "Stub — Despre" },
        blocks: [{ id: "blk_about_hero", type: "hero", version: 1, data: { title: "Despre" } }],
      },
    ],
  } as unknown as Site;
}

describe("EditorApp — multi-page wiring", () => {
  afterEach(() => {
    cleanup();
  });

  test("the Pages destination lists one entry per page", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    openSection(container, "pages");
    expect(container.querySelector('[data-testid="pages-list"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="pages-list-item"]')).toHaveLength(2);
  });

  test("opening a page previews that page; opening another boots a fresh document", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    const frame = (): HTMLIFrameElement =>
      container.querySelector<HTMLIFrameElement>('[data-testid="preview-pane"] iframe')!;

    openSection(container, "pages");
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-action="select"][data-index="1"]')!,
    );
    const first = frame();
    expect(first).not.toBeNull();
    expect(first.getAttribute("srcdoc")).toContain("Stub — Despre");

    // Back to the list and open the home page: a different page is a
    // different document, so the iframe is remounted with a fresh boot
    // `srcdoc` rather than morphed in place.
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="workspace-back"]')!);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-action="select"][data-index="0"]')!,
    );
    expect(frame()).not.toBe(first);
    expect(frame().getAttribute("srcdoc")).toContain("Stub — Acasă");
  });

  test("Create Page adds a page, opens it, and lengthens the list", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    openSection(container, "pages");
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="pages-create"]')!);

    // The new page opens straight into its workspace…
    expect(container.querySelector('[data-testid="workspace"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="block-list"]')?.getAttribute("data-page-slug"),
    ).toBe("new-page");

    // …and is listed back in Pages.
    openSection(container, "pages");
    expect(container.querySelectorAll('[data-testid="pages-list-item"]')).toHaveLength(3);
    expect(container.querySelector('[data-testid="nav-count-pages"]')?.textContent).toBe("3");
  });
});
