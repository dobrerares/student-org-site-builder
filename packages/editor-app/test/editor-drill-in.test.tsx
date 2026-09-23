/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Tests for the workspace's drill-in Inspector (ADR 0042, kept by issue #102).
 *
 * A Page opens into a workspace whose editing pane has one of four bodies:
 *  - the outline (default): title, the settings row, the Block list;
 *  - a Block Inspector: back button naming the content, BlockForm;
 *  - the settings Inspector: back button, the page's own spine fields;
 *  - (Articles only) Related Articles.
 *
 * Site-wide forms — the spine and the Theme — are no longer drill targets
 * inside a page. They are main-navigation destinations with an adjacent
 * preview, and are checked here for exactly that.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import type { BlockEnvelope, Site } from "@sosb/schema";
import { encodePreviewMessage } from "@sosb/preview-bridge";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { announcePreviewReady, capturePreviewMessages } from "./helpers/preview.js";
import { openPage, openSection, setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

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

function mountOnHomePage(site: Site): HTMLElement {
  const { container } = render(<EditorApp initial={site} />);
  openPage(container, 0);
  return container;
}

function q<T extends Element = HTMLElement>(container: HTMLElement, selector: string): T {
  const node = container.querySelector<T>(selector);
  if (node === null) throw new Error(`expected ${selector}`);
  return node;
}

describe("Workspace drill-in Inspector", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("the outline shows the Block list and the settings row, NOT the SpineForm", () => {
    const container = mountOnHomePage(structuredClone(baseSite));

    expect(container.querySelector('[data-testid="workspace-outline"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="workspace-settings-link"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="spine-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
  });

  test("each block row exposes a drill-in select button", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid="block-row-select"]').length).toBe(2);
  });

  test("selecting a Block mounts its Inspector with a back button naming the page", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    fireEvent.click(q(container, '[data-testid="block-row-select"]'));

    const inspector = q(container, '[data-testid="inspector"]');
    expect(inspector.getAttribute("data-inspector-mode")).toBe("block");
    expect(inspector.getAttribute("data-block-id")).toBe("blk_home_hero");
    expect(inspector.getAttribute("data-block-type")).toBe("hero");
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // The outline is replaced, and the way back is labelled with the content.
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
    expect(q(container, '[data-testid="drill-back"]').textContent).toContain("Acasă");
    // The preview stays beside the Inspector on a wide window.
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
  });

  test("editing a field inside the BlockForm patches the block's data on the snapshot", () => {
    const seen: Site[] = [];
    const { container } = render(
      <EditorApp initial={siteWithMultiplePagesAndBlocks()} onExport={(s) => seen.push(s)} />,
    );
    openPage(container, 0);

    const preview = capturePreviewMessages(
      q<HTMLIFrameElement>(container, '[data-testid="preview-pane"] iframe'),
    );
    announcePreviewReady();

    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    const titleInput = q<HTMLInputElement>(
      container,
      '[data-testid="block-form"] [data-field="title"]',
    );
    fireEvent.input(titleInput, { target: { value: "Edited Title" } });
    expect(preview.latestHtml()).toContain("Edited Title");

    // Export website → readiness panel → export, to capture the live snapshot.
    fireEvent.click(q(container, 'button[data-action="export"]'));
    fireEvent.click(q(container, '[data-testid="export-confirm-button"]'));
    const last = seen[seen.length - 1];
    expect((last?.pages[0]?.blocks[0]?.data as { title?: string }).title).toBe("Edited Title");
  });

  test("adding a nested team social row creates editable defaults and keeps preview rendering", () => {
    const container = mountOnHomePage(siteWithTeamGrid());
    const preview = capturePreviewMessages(
      q<HTMLIFrameElement>(container, '[data-testid="preview-pane"] iframe'),
    );
    announcePreviewReady();

    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    const addSocial = q(
      container,
      'fieldset[data-field="people.0.socials"] button[data-action="add"]',
    );
    fireEvent.click(addSocial);

    expect(q<HTMLInputElement>(container, '[data-field="people.0.socials.0.platform"]').value).toBe(
      "website",
    );
    expect(q<HTMLInputElement>(container, '[data-field="people.0.socials.0.url"]').value).toBe("/");
    expect(preview.latestHtml()).toContain("team-person__social--website");
  });

  test("customHTML drills into the dedicated textarea and safety-warning form", () => {
    const container = mountOnHomePage(siteWithCustomHtml());
    const preview = capturePreviewMessages(
      q<HTMLIFrameElement>(container, '[data-testid="preview-pane"] iframe'),
    );
    announcePreviewReady();

    fireEvent.click(q(container, '[data-testid="block-row-select"]'));

    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-block-form="customHTML"]')).not.toBeNull();
    const textarea = q<HTMLTextAreaElement>(container, '[data-field="data.html"]');
    expect(textarea.tagName).toBe("TEXTAREA");
    fireEvent.input(textarea, { target: { value: "<p>Edited custom HTML</p>" } });
    expect(preview.latestHtml()).toContain("Edited custom HTML");

    fireEvent.click(q(container, '[data-field="data.sanitize"]'));
    expect(container.querySelector('[data-testid="custom-html-danger"]')).not.toBeNull();
  });

  test("the back button drills out of the Block Inspector to the outline", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.click(q(container, '[data-testid="drill-back"]'));

    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="workspace-settings-link"]')).not.toBeNull();
  });

  test("Escape from the Block Inspector drills out but stays in the workspace", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    fireEvent.click(q(container, '[data-testid="block-row-select"]'));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="workspace"]')).not.toBeNull();
  });

  test("the settings row mounts the page's own settings, not the whole spine", () => {
    const container = mountOnHomePage(structuredClone(baseSite));
    fireEvent.click(q(container, '[data-testid="workspace-settings-link"]'));

    const inspector = q(container, '[data-testid="inspector"]');
    expect(inspector.getAttribute("data-inspector-mode")).toBe("page");
    expect(container.querySelector('[data-field="pages.0.navLabel"]')).not.toBeNull();
    expect(container.querySelector('[data-field="org.name"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
  });

  test("Escape from the settings Inspector drills out", () => {
    const container = mountOnHomePage(structuredClone(baseSite));
    fireEvent.click(q(container, '[data-testid="workspace-settings-link"]'));
    expect(container.querySelector('[data-inspector-mode="page"]')).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector('[data-inspector-mode="page"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).not.toBeNull();
  });

  test("Site settings is a destination: the spine form beside the preview", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    openSection(container, "settings");

    expect(container.querySelector('[data-testid="settings-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="spine-form"]')).not.toBeNull();
    expect(container.querySelector('[data-field="org.name"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(q(container, '[data-testid="nav-settings"]').getAttribute("aria-current")).toBe("page");
  });

  test("Theme is a destination: the ThemeForm beside the preview", () => {
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);
    openSection(container, "theme");

    expect(container.querySelector('[data-testid="theme-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="theme-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="block-list"]')).toBeNull();
  });

  test("editing the previewed page while drilled into a Block lands on that page's outline", async () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    // Follow a link in the preview, then take up its offer to edit that page.
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: encodePreviewMessage({ type: "navigate", path: "/despre/" }),
        }),
      );
      await Promise.resolve();
    });
    fireEvent.click(q(container, '[data-testid="preview-edit-this"]'));

    // The Block that was open belongs to the page we left, so the new page
    // opens on its outline rather than on a form bound to nothing.
    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(q(container, '[data-testid="block-list"]').getAttribute("data-page-slug")).toBe(
      "despre",
    );
  });

  test("a link followed in the preview moves the preview, not the editing pane", async () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    expect(q(container, '[data-testid="block-list"]').getAttribute("data-page-slug")).toBe("acasa");

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: encodePreviewMessage({ type: "navigate", path: "/despre/" }),
        }),
      );
      await Promise.resolve();
    });

    // Still editing the home page…
    expect(q(container, '[data-testid="block-list"]').getAttribute("data-page-slug")).toBe("acasa");
    // …while the preview shows the page the visitor would have reached.
    expect(q(container, '[data-testid="preview-target-title"]').textContent).toBe("Despre");
    expect(container.querySelector('[data-testid="preview-return"]')).not.toBeNull();

    // "Edit this Page" makes the previewed page the edited one.
    fireEvent.click(q(container, '[data-testid="preview-edit-this"]'));
    expect(q(container, '[data-testid="block-list"]').getAttribute("data-page-slug")).toBe(
      "despre",
    );
    expect(container.querySelector('[data-testid="preview-return"]')).toBeNull();
  });

  test("removing the Block you are drilled into falls back to the outline", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());

    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="block-row-select"]')[0]!,
    );
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();
    fireEvent.click(q(container, '[data-testid="drill-back"]'));
    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="block-remove"]')[0]!,
    );

    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();
    fireEvent.click(q(container, '[data-testid="drill-back"]'));
    fireEvent.click(q(container, '[data-testid="block-remove"]'));

    expect(container.querySelector('[data-testid="block-form"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="block-row"]').length).toBe(0);
  });

  test("phone layout: the Inspector survives switching to the preview and back", () => {
    setViewportWidth(600);
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());

    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.click(q(container, '[data-testid="workspace-tab-preview"]'));
    // Hidden, not unmounted: the drill state and the form both survive.
    expect(q(container, '[data-testid="editor-pane"]').getAttribute("data-hidden")).toBe("true");
    expect(
      q(container, '[data-testid="preview-pane"]')
        .closest("[data-hidden]")
        ?.getAttribute("data-hidden"),
    ).toBe("false");
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.click(q(container, '[data-testid="workspace-tab-edit"]'));
    expect(q(container, '[data-testid="editor-pane"]').getAttribute("data-hidden")).toBe("false");
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();
  });
});

describe("Workspace drill-in — Escape, overlays and the preview target", () => {
  beforeEach(() => setViewportWidth(1200));
  afterEach(() => cleanup());

  test("Escape with the export readiness panel open closes the panel, not the Inspector", () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    fireEvent.click(q(container, '[data-testid="block-row-select"]'));
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();

    fireEvent.click(q(container, 'button[data-action="export"]'));
    const panel = q(container, '[data-testid="export-readiness"]');

    // A real key press targets the focused element inside the popup and
    // bubbles up from there; the shell's own Escape listener sits on window.
    fireEvent.keyDown(panel, { key: "Escape" });

    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-form"]')).not.toBeNull();
  });

  test("re-opening a workspace after a detour points the preview back at it", async () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: encodePreviewMessage({ type: "navigate", path: "/despre/" }),
        }),
      );
      await Promise.resolve();
    });
    expect(q(container, '[data-testid="preview-target-title"]').textContent).toBe("Despre");

    // Theme keeps the preview where it was (ADR 0053 §2)…
    openSection(container, "theme");
    expect(q(container, '[data-testid="preview-target-title"]').textContent).toBe("Despre");

    // …but opening the home page again is entering its workspace: the
    // preview follows, and there is nothing to "return" to.
    openPage(container, 0);
    expect(q(container, '[data-testid="preview-target-title"]').textContent).toBe("Acasă");
    expect(container.querySelector('[data-testid="preview-return"]')).toBeNull();
  });

  test("an edit made while a freshly navigated preview boots reaches the new document", async () => {
    const container = mountOnHomePage(siteWithMultiplePagesAndBlocks());
    const first = q<HTMLIFrameElement>(container, '[data-testid="preview-pane"] iframe');

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: encodePreviewMessage({ type: "navigate", path: "/despre/" }),
        }),
      );
      await Promise.resolve();
    });
    const second = q<HTMLIFrameElement>(container, '[data-testid="preview-pane"] iframe');
    expect(second).not.toBe(first);
    const capture = capturePreviewMessages(second);

    // Type before the new document has announced its morph script: the edit
    // is held back rather than posted into nothing.
    fireEvent.input(q(container, '[data-testid="workspace-title"]'), {
      target: { value: "Acasă nouă" },
    });
    expect(capture.latestHtml()).toBeUndefined();

    // Once it is ready, the held edit must land in *this* document — the
    // menu on the previewed About page names the renamed home page.
    await act(async () => {
      announcePreviewReady();
      await Promise.resolve();
    });
    expect(capture.latestHtml()).toContain("Acasă nouă");
  });
});
