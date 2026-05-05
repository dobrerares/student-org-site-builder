// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

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

  test("renders a Pages list panel with one entry per page", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    const list = container.querySelector('[data-testid="pages-list"]');
    expect(list).not.toBeNull();
    const items = container.querySelectorAll('[data-testid="pages-list-item"]');
    expect(items).toHaveLength(2);
  });

  test("the preview iframe srcdoc reflects the active page after a select", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    const iframe = container.querySelector<HTMLIFrameElement>(
      '[data-testid="preview-pane"] iframe',
    );
    expect(iframe).not.toBeNull();
    // Initial: home page is active.
    expect(iframe!.getAttribute("srcdoc")).toContain("Stub — Acasă");

    // Click 'Despre' in the list and expect the preview to switch.
    const selectAbout = container.querySelector<HTMLButtonElement>(
      '[data-action="select"][data-index="1"]',
    );
    fireEvent.click(selectAbout!);
    expect(iframe!.getAttribute("srcdoc")).toContain("Stub — Despre");
  });

  test("adding a page lengthens the list", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
    const { container } = render(<EditorApp initial={makeMultiPageSite()} />);
    const input = container.querySelector<HTMLInputElement>('[data-testid="pages-list-add-slug"]');
    fireEvent.input(input!, { target: { value: "proiecte" } });
    const submit = container.querySelector<HTMLButtonElement>('[data-action="add"]');
    fireEvent.click(submit!);
    const items = container.querySelectorAll('[data-testid="pages-list-item"]');
    expect(items).toHaveLength(3);
  });
});
