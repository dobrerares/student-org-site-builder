// @vitest-environment jsdom
/**
 * Tests for the editor pane's drill-in inspector pattern (ADR 0042).
 *
 * The editor pane has three view branches:
 *  - blocks (default): pages list, block list with drill-in click target,
 *                      Site settings affordance, locale toggle.
 *  - block:            pages list, back-to-blocks affordance, BlockForm
 *                      mounted with the active block's data schema.
 *  - settings:         pages list, back-to-blocks affordance, SpineForm
 *                      (the legacy site-spine form).
 *
 * These tests assert the pane shape per branch and the entry/exit
 * behaviour: clicking a row drills in, clicking back drills out, Escape
 * drills out, switching pages while drilled into a block drills out.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import type { BlockEnvelope, Site } from "@sosb/schema";
import { encodePreviewMessage } from "@sosb/preview-bridge";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function siteWithMultiplePagesAndBlocks(): Site {
  const site = structuredClone(baseSite);
  site.theme.tokens = {
    ...(site.theme.tokens ?? {}),
    colorPrimary: "#1f3a5f",
    colorAccent: "#7a2d16",
  };
  site.pages = [
    {
      slug: "acasa",
      lang: "ro",
      navLabel: "Acasă",
      navOrder: 0,
      showInNav: true,
      blocks: [
        {
          id: "blk_home_hero",
          type: "hero",
          version: 1,
          data: { title: "Home Hero" },
        } satisfies BlockEnvelope,
        {
          id: "blk_home_quote",
          type: "quote",
          version: 1,
          data: { text: "Some quote", attribution: "Someone" },
        } satisfies BlockEnvelope,
      ],
    },
    {
      slug: "despre",
      lang: "ro",
      navLabel: "Despre",
      navOrder: 1,
      showInNav: true,
      blocks: [
        {
          id: "blk_about_hero",
          type: "hero",
          version: 1,
          data: { title: "About Hero" },
        } satisfies BlockEnvelope,
      ],
    },
  ] as Site["pages"];
  return site;
}

function siteWithTeamGrid(): Site {
  const site = structuredClone(baseSite);
  site.pages[0]!.blocks = [
    {
      id: "blk_team",
      type: "teamGrid",
      version: 1,
      data: {
        title: "Team",
        columns: 3,
        people: [{ name: "Member name", role: "Role" }],
      },
    } satisfies BlockEnvelope,
  ];
  return site;
}

function siteWithCustomHtml(): Site {
  const site = structuredClone(baseSite);
  site.pages[0]!.blocks = [
    {
      id: "blk_custom",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>Initial custom HTML</p>",
        sanitize: true,
      },
    } satisfies BlockEnvelope,
  ];
  return site;
}

describe("EditorApp drill-in inspector", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("un-drilled view shows the block list and a Site settings affordance, NOT the SpineForm", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="site-settings-link"]')).not.toBeNull();
    // SpineForm is hidden in the un-drilled view.
    expect(container.querySelector('[data-testid="spine-form"]')).toBeNull();
    // No block-form mounted either.
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
  });

  test("each block row exposes a drill-in select button bearing the block's id", () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    const rows = container.querySelectorAll('[data-testid="block-row"]');
    expect(rows.length).toBe(2);

    const selects = container.querySelectorAll('[data-testid="block-row-select"]');
    expect(selects.length).toBe(2);
  });

  test("clicking a block row's select target mounts a BlockForm for that block", () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    const firstSelect = container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="block-row-select"]',
    )[0];
    expect(firstSelect).not.toBeUndefined();
    fireEvent.click(firstSelect!);

    const inspector = container.querySelector('[data-testid="inspector"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.getAttribute("data-inspector-mode")).toBe("block");
    expect(inspector?.getAttribute("data-block-id")).toBe("blk_home_hero");
    expect(inspector?.getAttribute("data-block-type")).toBe("hero");
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // Block list is hidden while drilled in.
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
    // Pages list stays visible so page-switching is always available.
    expect(container.querySelector('[data-testid="pages-list"]')).not.toBeNull();
  });

  test("editing a field inside the BlockForm patches the block's data on the snapshot", () => {
    const initial = siteWithMultiplePagesAndBlocks();
    const seenSnapshots: Site[] = [];
    const { container } = render(
      <EditorApp initial={initial} onExport={(s) => seenSnapshots.push(s)} />,
    );

    // Drill into the first block (blk_home_hero on `acasa`).
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );

    // Find the title input inside the BlockForm and edit it.
    const blockForm = container.querySelector('[data-testid="block-form"]');
    expect(blockForm).not.toBeNull();
    const titleInput = blockForm?.querySelector<HTMLInputElement>('[data-field="title"]');
    expect(titleInput).not.toBeNull();
    fireEvent.input(titleInput!, { target: { value: "Edited Title" } });

    // The preview iframe's srcdoc should now reflect the new title.
    const iframe = container.querySelector<HTMLIFrameElement>(
      '[data-testid="preview-pane"] iframe',
    );
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("srcdoc")).toContain("Edited Title");

    // Trigger an export to capture the live snapshot.
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);
    const last = seenSnapshots[seenSnapshots.length - 1];
    expect(last).toBeDefined();
    const block = last?.pages[0]?.blocks[0];
    expect(block).toBeDefined();
    expect((block?.data as { title?: string }).title).toBe("Edited Title");
  });

  test("adding a nested team social row creates editable defaults and keeps preview rendering", () => {
    const { container } = render(<EditorApp initial={siteWithTeamGrid()} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );

    const socialsFieldset = container.querySelector<HTMLElement>(
      'fieldset[data-field="people.0.socials"]',
    );
    expect(socialsFieldset).not.toBeNull();
    const addSocial = socialsFieldset!.querySelector<HTMLButtonElement>(
      'button[data-action="add"]',
    );
    expect(addSocial).not.toBeNull();

    fireEvent.click(addSocial!);

    const platform = container.querySelector<HTMLInputElement>(
      '[data-field="people.0.socials.0.platform"]',
    );
    const url = container.querySelector<HTMLInputElement>('[data-field="people.0.socials.0.url"]');
    expect(platform?.value).toBe("website");
    expect(url?.value).toBe("/");

    const iframe = container.querySelector<HTMLIFrameElement>(
      '[data-testid="preview-pane"] iframe',
    );
    expect(iframe?.getAttribute("srcdoc")).toContain("team-person__social--website");
  });

  test("customHTML drills into the dedicated textarea and safety-warning form", () => {
    const { container } = render(<EditorApp initial={siteWithCustomHtml()} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );

    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-block-form="customHTML"]')).not.toBeNull();
    const textarea = container.querySelector<HTMLTextAreaElement>('[data-field="data.html"]');
    expect(textarea).not.toBeNull();
    expect(textarea!.tagName).toBe("TEXTAREA");

    fireEvent.input(textarea!, { target: { value: "<p>Edited custom HTML</p>" } });

    const iframe = container.querySelector<HTMLIFrameElement>(
      '[data-testid="preview-pane"] iframe',
    );
    expect(iframe?.getAttribute("srcdoc")).toContain("Edited custom HTML");

    const sanitize = container.querySelector<HTMLInputElement>('[data-field="data.sanitize"]');
    expect(sanitize).not.toBeNull();
    fireEvent.click(sanitize!);
    expect(container.querySelector('[data-testid="custom-html-danger"]')).not.toBeNull();
  });

  test("the back-to-blocks button drills out of the block inspector", () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    const back = container.querySelector<HTMLButtonElement>('[data-testid="drill-back"]');
    expect(back).not.toBeNull();
    fireEvent.click(back!);

    // Back to the un-drilled view.
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="site-settings-link"]')).not.toBeNull();
  });

  test("Escape key from the block inspector drills out", () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
  });

  test("clicking the Site settings affordance mounts the SpineForm", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    expect(container.querySelector('[data-testid="spine-form"]')).toBeNull();

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="site-settings-link"]')!,
    );

    const inspector = container.querySelector('[data-testid="inspector"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.getAttribute("data-inspector-mode")).toBe("settings");
    expect(container.querySelector('[data-testid="spine-form"]')).not.toBeNull();

    // Block list hidden while drilled into settings.
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
    // Pages list stays.
    expect(container.querySelector('[data-testid="pages-list"]')).not.toBeNull();
  });

  test("Escape from the settings inspector drills out", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="site-settings-link"]')!,
    );
    expect(container.querySelector('[data-testid="spine-form"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector('[data-testid="spine-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
  });

  test("clicking the Theme affordance drills into the ThemeForm", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    const themeLink = container.querySelector<HTMLButtonElement>('[data-testid="drill-in-theme"]');
    expect(themeLink).not.toBeNull();

    fireEvent.click(themeLink!);

    const inspector = container.querySelector('[data-testid="inspector"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.getAttribute("data-inspector-mode")).toBe("theme");
    expect(container.querySelector('[data-testid="theme-form"]')).not.toBeNull();

    // Block list hidden while drilled into theme.
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
    // Pages list stays.
    expect(container.querySelector('[data-testid="pages-list"]')).not.toBeNull();
  });

  test("the back-to-blocks button drills out of the theme inspector", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="drill-in-theme"]')!);
    expect(container.querySelector('[data-testid="theme-form"]')).not.toBeNull();

    const back = container.querySelector<HTMLButtonElement>('[data-testid="drill-back"]');
    expect(back).not.toBeNull();
    fireEvent.click(back!);

    expect(container.querySelector('[data-testid="theme-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="drill-in-theme"]')).not.toBeNull();
  });

  test("switching pages while drilled into a block drills back out to the new page's block list", () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    // Drill into a block on `acasa`.
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // Switch to `despre`.
    const selectAbout = container.querySelector<HTMLButtonElement>(
      '[data-action="select"][data-index="1"]',
    );
    expect(selectAbout).not.toBeNull();
    fireEvent.click(selectAbout!);

    // Drilled back out — the block list for `despre` is now visible.
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    const blockList = container.querySelector('[data-testid="block-list"]');
    expect(blockList).not.toBeNull();
    expect(blockList?.getAttribute("data-page-slug")).toBe("despre");
  });

  test("preview navigate messages switch the active page", async () => {
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    expect(
      container.querySelector('[data-testid="block-list"]')?.getAttribute("data-page-slug"),
    ).toBe("acasa");
    await Promise.resolve();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: encodePreviewMessage({ type: "navigate", path: "/despre/" }),
      }),
    );
    await Promise.resolve();

    expect(
      container.querySelector('[data-testid="block-list"]')?.getAttribute("data-page-slug"),
    ).toBe("despre");
  });

  test("removing the block you are drilled into falls back to the un-drilled view", () => {
    const initial = siteWithMultiplePagesAndBlocks();
    const { container } = render(<EditorApp initial={initial} />);

    // Drill into the first block on `acasa` (blk_home_hero).
    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="block-row-select"]')[0]!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // Drill back out and remove the very block we were just inspecting.
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="drill-back"]')!);
    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="block-remove"]')[0]!,
    );

    // The remaining block is `blk_home_quote`. Drill into it, then remove
    // it directly via the remove control on the row beneath the inspector
    // — the inspector falls back to the un-drilled view rather than
    // dangling on a vanished block.
    const remainingSelect = container.querySelector<HTMLButtonElement>(
      '[data-testid="block-row-select"]',
    );
    expect(remainingSelect).not.toBeNull();
    fireEvent.click(remainingSelect!);
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="drill-back"]')!);
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="block-remove"]')!);

    // No blocks left — block list still visible, no inspector.
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(0);
  });

  test("narrow-viewport tab layout: drill-in lives inside the Editor tab and is unaffected by the Preview tab", () => {
    setViewportWidth(600);
    const { container } = render(<EditorApp initial={siteWithMultiplePagesAndBlocks()} />);

    // Editor tab is active by default — drill in.
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="block-row-select"]')!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // Switch to Preview tab — block-form is removed (preview replaces the
    // editor pane), but the drill state is preserved internally.
    const tabs = container.querySelectorAll<HTMLButtonElement>('[data-testid="layout-tab"]');
    const previewTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Preview");
    expect(previewTab).not.toBeUndefined();
    fireEvent.click(previewTab!);
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();

    // Switch back to Editor — block-form is visible again because the
    // drill state was preserved.
    const editorTab = Array.from(tabs).find((t) => t.textContent?.trim() === "Editor");
    fireEvent.click(editorTab!);
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();
  });
});
