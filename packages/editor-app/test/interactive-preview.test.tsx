/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * The interactive preview toggle (issue #110, ADR 0046, ADR 0056).
 *
 * Off by default, and only offered when the active Theme ships a public-site
 * script. Switching it on boots a different document — an opaque-origin
 * sandbox with the Theme's `public.js` and every asset inlined — and while it
 * is on, edits reload that document instead of morphing it. Switching it off
 * returns to the static preview, unchanged.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Site } from "@sosb/schema";
import { MemoryDriver } from "@sosb/vfs";
import { installThemePackageIntoVfs, loadThemePackage } from "@sosb/theme-package";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { announcePreviewReady, capturePreviewMessages } from "./helpers/preview.js";
import { openSection } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const THEME_ID = "org.example.interactive";
const enc = new TextEncoder();

/** A declarative package with a public script that contacts one host. */
function packageFiles(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    [
      "theme.json",
      enc.encode(
        JSON.stringify({
          formatVersion: 1,
          id: THEME_ID,
          name: "Interactive",
          version: "1.0.0",
          builder: { formatVersion: 1 },
          css: "theme.css",
          public: {
            file: "public.js",
            network: ["api.example.org"],
            offline: "The events list does not refresh.",
          },
        }),
      ),
    ],
    ["theme.css", enc.encode("body{color:#123}")],
    ["public.js", enc.encode("document.documentElement.dataset.ran = 'yes';")],
  ]);
}

function wide(): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1200 });
}

async function mountWithPackage(): Promise<{
  container: HTMLElement;
  frame: () => HTMLIFrameElement;
  toggle: () => HTMLInputElement;
}> {
  wide();
  const vfs = new MemoryDriver();
  await installThemePackageIntoVfs(vfs, loadThemePackage(packageFiles()));
  const site: Site = { ...(structuredClone(minimal) as unknown as Site), theme: { id: THEME_ID } };
  const { container } = render(<EditorApp initial={site} initialAssetVfs={vfs} />);
  openSection(container, "settings");
  const toggle = (): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('[data-testid="preview-interactive-toggle"]')!;
  // The installed Theme is loaded from the VFS after mount; the control
  // appears once the bundle (and its public script) is known.
  await waitFor(() => expect(toggle()).not.toBeNull());
  return {
    container,
    frame: () => container.querySelector<HTMLIFrameElement>('[data-testid="preview-pane"] iframe')!,
    toggle,
  };
}

function status(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="preview-interactive-status"]');
}

async function switchOn(container: HTMLElement, toggle: () => HTMLInputElement): Promise<void> {
  fireEvent.click(toggle());
  await waitFor(() => expect(status(container)?.getAttribute("data-state")).toBe("on"));
}

describe("the interactive preview toggle", () => {
  afterEach(() => {
    cleanup();
  });

  test("is not offered for a Theme without a public script", () => {
    wide();
    const { container } = render(<EditorApp initial={structuredClone(minimal) as never} />);
    openSection(container, "settings");
    expect(container.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-interactive"]')).toBeNull();
  });

  test("starts off with the static document and the same-origin sandbox", async () => {
    const { container, frame, toggle } = await mountWithPackage();
    expect(toggle().checked).toBe(false);
    expect(status(container)).toBeNull();
    expect(frame().getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-popups");
    expect(frame().getAttribute("data-preview-mode")).toBe("static");
    expect(frame().getAttribute("srcdoc")).not.toContain("data-sosb-theme-script");
    // The explanation is there for whoever wonders what the switch does.
    expect(container.querySelector('[data-testid="preview-interactive-info"]')).not.toBeNull();
  });

  test("switching on boots an opaque-origin document carrying the script inline", async () => {
    const { container, frame, toggle } = await mountWithPackage();
    const before = frame();
    await switchOn(container, toggle);

    expect(toggle().checked).toBe(true);
    // A different element: a sandbox only applies to the next navigation.
    expect(frame()).not.toBe(before);
    expect(frame().getAttribute("sandbox")).toBe(
      "allow-scripts allow-popups allow-popups-to-escape-sandbox",
    );
    expect(frame().getAttribute("data-preview-mode")).toBe("interactive");
    const srcdoc = frame().getAttribute("srcdoc")!;
    expect(srcdoc).toContain("data-sosb-theme-script");
    expect(srcdoc).toContain(
      `<script defer src="data:text/javascript;base64,${btoa(
        "document.documentElement.dataset.ran = 'yes';",
      )}" data-sosb-theme-script></script>`,
    );
    // Nothing in the document points at the editor's origin.
    expect(srcdoc).not.toContain("blob:");
    // Still a preview document: the nav interceptor keeps internal links
    // inside the pane, and the morph receiver is harmless when never posted.
    expect(srcdoc).toContain("data-sosb-preview-nav");
  });

  test("tells the author what runs and what it may contact", async () => {
    const { container, toggle } = await mountWithPackage();
    await switchOn(container, toggle);
    const strip = status(container)!;
    expect(strip.getAttribute("role")).toBe("status");
    expect(strip.textContent).toContain("Interactive preview is on");
    expect(strip.querySelector('[data-testid="preview-interactive-network"]')?.textContent).toBe(
      "It may contact: api.example.org.",
    );
    expect(strip.querySelector('[data-testid="preview-interactive-offline"]')?.textContent).toBe(
      "Without an internet connection: The events list does not refresh.",
    );
  });

  test("while on, an edit reloads the document rather than morphing it", async () => {
    const { container, frame, toggle } = await mountWithPackage();
    await switchOn(container, toggle);
    const preview = capturePreviewMessages(frame());
    announcePreviewReady();

    fireEvent.input(container.querySelector<HTMLInputElement>('[data-field="org.name"]')!, {
      target: { value: "Asociația Interactivă" },
    });

    // The Theme's script owns the live DOM: no diff is posted over the
    // bridge, the boot document itself carries the edit.
    expect(preview.payloadsOfType("previewHtml")).toHaveLength(0);
    expect(frame().getAttribute("srcdoc")).toContain("Asociația Interactivă");
    expect(frame().getAttribute("srcdoc")).toContain("data-sosb-theme-script");
  });

  test("switching off restores the static preview and the morph path", async () => {
    const { container, frame, toggle } = await mountWithPackage();
    await switchOn(container, toggle);
    fireEvent.click(toggle());

    expect(toggle().checked).toBe(false);
    expect(status(container)).toBeNull();
    expect(frame().getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-popups");
    expect(frame().getAttribute("srcdoc")).not.toContain("data-sosb-theme-script");

    const preview = capturePreviewMessages(frame());
    announcePreviewReady();
    const srcdocBefore = frame().getAttribute("srcdoc");
    fireEvent.input(container.querySelector<HTMLInputElement>('[data-field="org.name"]')!, {
      target: { value: "Static Again" },
    });
    expect(preview.latestHtml()).toContain("Static Again");
    expect(frame().getAttribute("srcdoc")).toBe(srcdocBefore);
  });
});
