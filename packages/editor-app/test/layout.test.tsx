/** @jsxImportSource react */
// @vitest-environment jsdom
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { openPage, setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

/**
 * Issue #102: editing and preview sit side by side on larger screens and one
 * at a time on phones, switched with an Edit / Preview control. The builder
 * opens into the Overview, which has no preview, so both checks open a page.
 *
 * We do NOT assert visual styling (CSS). The contract is structural markup.
 */
describe("EditorApp layout responsiveness", () => {
  beforeEach(() => {
    setViewportWidth(1200);
  });

  afterEach(() => {
    cleanup();
  });

  test("opens into the Overview with the main navigation", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    expect(container.querySelector('[data-testid="overview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="main-nav"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="nav-overview"]')?.getAttribute("aria-current"),
    ).toBe("page");
    expect(container.querySelector('[data-testid="top-bar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="save-status"]')).not.toBeNull();
  });

  test("at 1200px, a workspace shows editing and preview side by side", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    openPage(container, 0);

    expect(container.querySelector('[data-testid="editor-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="layout-tabs"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="editor-pane"]')?.getAttribute("data-hidden"),
    ).toBe("false");
  });

  test("at 600px, a workspace shows editing and preview one at a time", () => {
    setViewportWidth(600);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    openPage(container, 0);

    expect(container.querySelector('[data-testid="layout-tabs"]')).not.toBeNull();
    const edit = container.querySelector('[data-testid="workspace-tab-edit"]');
    const preview = container.querySelector('[data-testid="workspace-tab-preview"]');
    expect(edit?.textContent).toBe("Edit");
    expect(preview?.textContent).toBe("Preview");
    expect(edit?.getAttribute("aria-pressed")).toBe("true");

    expect(
      container.querySelector('[data-testid="editor-pane"]')?.getAttribute("data-hidden"),
    ).toBe("false");
    expect(container.querySelector("[data-split-preview]")?.getAttribute("data-hidden")).toBe(
      "true",
    );

    fireEvent.click(preview!);
    expect(
      container.querySelector('[data-testid="editor-pane"]')?.getAttribute("data-hidden"),
    ).toBe("true");
    expect(container.querySelector("[data-split-preview]")?.getAttribute("data-hidden")).toBe(
      "false",
    );
  });

  test("the phone navigation drawer opens from the top bar and closes with Escape", () => {
    setViewportWidth(600);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    const nav = container.querySelector('[data-testid="main-nav"]')!;
    expect(nav.getAttribute("data-drawer-open")).toBe("false");

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="nav-drawer-open"]')!);
    expect(nav.getAttribute("data-drawer-open")).toBe("true");
    expect(container.querySelector('[data-testid="nav-drawer-scrim"]')).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(nav.getAttribute("data-drawer-open")).toBe("false");
  });

  test("preview pane exposes selectable viewport sizes", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    openPage(container, 0);

    const controls = container.querySelector('[data-testid="viewport-preview-controls"]');
    expect(controls).not.toBeNull();

    const frame = container.querySelector('[data-testid="preview-frame-shell"]');
    expect(frame?.getAttribute("data-preview-viewport")).toBe("fit");

    const options = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="viewport-preview-option"]'),
    );
    expect(options.map((option) => option.dataset.viewport)).toEqual([
      "fit",
      "desktop",
      "tablet",
      "phone",
    ]);

    const phone = options.find((option) => option.dataset.viewport === "phone");
    expect(phone).toBeDefined();
    fireEvent.click(phone!);

    expect(frame?.getAttribute("data-preview-viewport")).toBe("phone");
    expect(phone?.getAttribute("aria-pressed")).toBe("true");
  });
});
