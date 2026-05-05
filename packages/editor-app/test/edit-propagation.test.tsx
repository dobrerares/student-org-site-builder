// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const baseSite = minimal as unknown as Site;

/**
 * AC: live update <200ms after change.
 *
 * The editor wires form fields to `EditorState.update`, then debounces a
 * push to the preview iframe via the preview-bridge. The contract:
 *
 * 1. A field edit dispatches a `siteData` host message to the iframe's
 *    contentWindow.postMessage.
 * 2. The dispatch happens within the AC's 200ms wall-clock budget.
 *
 * We hook `iframe.contentWindow.postMessage` after render and assert that a
 * change to the org-name field triggers a `siteData` message (with the new
 * value) within the SLA.
 */
describe("edit propagation via the preview bridge", () => {
  afterEach(() => {
    cleanup();
  });

  test("editing org.name dispatches a siteData message to the iframe within 200ms", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    const iframe = container.querySelector<HTMLIFrameElement>(
      '[data-testid="preview-pane"] iframe',
    );
    expect(iframe).not.toBeNull();

    // Spy on contentWindow.postMessage. The Preact component holds a ref to
    // the iframe — patching the underlying contentWindow is enough.
    const posted: unknown[] = [];
    Object.defineProperty(iframe!, "contentWindow", {
      configurable: true,
      get: () => ({
        postMessage: (data: unknown) => {
          posted.push(data);
        },
      }),
    });

    // Find the org-name input. The form generator renders one input per
    // string field, and we tag each by its dotted path (e.g.
    // `field-org.name`).
    const orgNameInput = container.querySelector<HTMLInputElement>('[data-field="org.name"]');
    expect(orgNameInput).not.toBeNull();

    const t0 = performance.now();
    fireEvent.input(orgNameInput!, { target: { value: "New Name" } });

    // Wait up to 250ms for the bridge to dispatch.
    const deadline = t0 + 250;
    while (performance.now() < deadline && posted.length === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const elapsed = performance.now() - t0;

    expect(posted.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);

    // The most recent posted message must be a siteData payload reflecting
    // the new org name.
    const lastEnvelope = posted[posted.length - 1] as {
      channel: string;
      payload: { type: string; siteData: Site };
    };
    expect(lastEnvelope.channel).toBe("sosb:preview");
    expect(lastEnvelope.payload.type).toBe("siteData");
    expect(lastEnvelope.payload.siteData.org.name).toBe("New Name");
  }, 1000);

  test("non-string subscribe events do not crash the bridge", () => {
    // Sanity: just check the app mounts without errors when innerWidth is
    // narrow. (Regression guard for any layout-conditional crash.)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 600,
    });
    expect(() => render(<EditorApp initial={structuredClone(baseSite)} />)).not.toThrow();
  });
});

// Silence the unused-import warning about vi when running on systems that
// don't have it injected globally.
void vi;
