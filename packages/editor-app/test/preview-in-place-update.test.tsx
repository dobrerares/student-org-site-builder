/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * The live preview updates in place.
 *
 * Reassigning the iframe's `srcdoc` rebuilds the document from scratch, which
 * is why typing into a form used to scroll the preview back to the top and
 * collapse anything the user had opened. The host now renders each snapshot
 * with the real renderer and posts the HTML over the preview bridge; the
 * iframe diffs it onto its live document.
 *
 * What this file pins down:
 *  - an edit posts `previewHtml` and does NOT touch `srcdoc`,
 *  - the iframe element itself survives edits (so its document, and therefore
 *    its scroll position, survives too),
 *  - a theme / page / language change still does a full reload, because those
 *    are genuinely different documents,
 *  - edits made before the iframe's morph script has booted are buffered and
 *    delivered once it announces itself, rather than being dropped.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { announcePreviewReady, capturePreviewMessages } from "./helpers/preview.js";
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

function wide(): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1200,
  });
}

function mount(site: Site = structuredClone(baseSite)): {
  container: HTMLElement;
  frame: () => HTMLIFrameElement;
} {
  wide();
  const { container } = render(<EditorApp initial={site} />);
  return {
    container,
    frame: () => container.querySelector<HTMLIFrameElement>('[data-testid="preview-pane"] iframe')!,
  };
}

/** Drill into Site settings and type a new organisation name. */
function editOrgName(container: HTMLElement, value: string): void {
  fireEvent.click(
    container.querySelector<HTMLButtonElement>('[data-testid="site-settings-link"]')!,
  );
  fireEvent.input(container.querySelector<HTMLInputElement>('[data-field="org.name"]')!, {
    target: { value },
  });
}

describe("preview updates in place", () => {
  afterEach(() => {
    cleanup();
  });

  test("an edit posts previewHtml carrying the new content", () => {
    const { container, frame } = mount();
    const preview = capturePreviewMessages(frame());
    announcePreviewReady();

    editOrgName(container, "Asociația Nouă");

    expect(preview.latestHtml()).toContain("Asociația Nouă");
  });

  test("an edit does not rewrite srcdoc or remount the iframe", () => {
    const { container, frame } = mount();
    const before = frame();
    const srcdocBefore = before.getAttribute("srcdoc");
    capturePreviewMessages(before);
    announcePreviewReady();

    editOrgName(container, "Nume Schimbat");

    // Same element, same boot document: the iframe's live DOM — and with it
    // the user's scroll position and open disclosures — was never torn down.
    expect(frame()).toBe(before);
    expect(frame().getAttribute("srcdoc")).toBe(srcdocBefore);
    expect(srcdocBefore).not.toContain("Nume Schimbat");
  });

  test("the boot document is rendered once, not per keystroke", () => {
    const { container, frame } = mount();
    const preview = capturePreviewMessages(frame());
    announcePreviewReady();

    editOrgName(container, "A");
    const input = container.querySelector<HTMLInputElement>('[data-field="org.name"]')!;
    fireEvent.input(input, { target: { value: "AB" } });
    fireEvent.input(input, { target: { value: "ABC" } });

    const htmls = preview.payloadsOfType("previewHtml");
    expect(htmls.length).toBeGreaterThanOrEqual(3);
    expect(htmls[htmls.length - 1]!["html"]).toContain("ABC");
  });

  test("still posts the ADR 0005 siteData envelope alongside the HTML", () => {
    const { container, frame } = mount();
    const preview = capturePreviewMessages(frame());
    announcePreviewReady();

    editOrgName(container, "Cu Bridge");

    const siteData = preview.payloadsOfType("siteData");
    expect(siteData.length).toBeGreaterThan(0);
    const last = siteData[siteData.length - 1]! as unknown as { siteData: Site };
    expect(last.siteData.org.name).toBe("Cu Bridge");
  });

  test("edits made before the iframe script boots are buffered, not dropped", () => {
    const { container, frame } = mount();
    const preview = capturePreviewMessages(frame());

    // No `ready` yet — the morph script has not wired its listener.
    editOrgName(container, "Editat Devreme");
    expect(preview.payloadsOfType("previewHtml")).toHaveLength(0);

    announcePreviewReady();

    // The buffered render is delivered as soon as the iframe can hear it.
    expect(preview.latestHtml()).toContain("Editat Devreme");
  });

  test("changing the theme reloads the preview document", () => {
    const { container, frame } = mount();
    const before = frame();

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-testid="drill-in-theme"]')!);
    const picker = container.querySelector('[data-testid="theme-picker"]')!;
    const option = picker.querySelector<HTMLInputElement>(
      '[data-theme-id="civic"] input[type="radio"]',
    )!;
    fireEvent.click(option);

    // A theme swaps the entire stylesheet and much of the markup; morphing
    // into it would preserve state that no longer means anything.
    expect(frame()).not.toBe(before);
  });
});
