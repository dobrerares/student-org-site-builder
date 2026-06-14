// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { loadAutosave } from "@sosb/editor-state";
import { MemoryDriver } from "@sosb/vfs/memory";
import type { Site } from "@sosb/schema";

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

describe("EditorApp save status", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("explains that a browser-only editor needs a downloaded copy", () => {
    setViewportWidth(1200);
    const { container } = render(<EditorApp initial={structuredClone(baseSite)} />);

    const status = container.querySelector('[data-testid="save-status"]');
    expect(status?.getAttribute("data-status")).toBe("localOnly");
    expect(status?.textContent).toContain("Download a copy");
  });

  test("autosaves edits into the supplied VFS and reports a saved state", async () => {
    vi.useFakeTimers();
    setViewportWidth(1200);
    const vfs = new MemoryDriver();
    const { container } = render(
      <EditorApp initial={structuredClone(baseSite)} autosaveVfs={vfs} />,
    );

    fireEvent.click(container.querySelector('[data-testid="block-add"]') as HTMLElement);
    fireEvent.click(
      container.querySelector(
        '[data-testid="add-block-entry"][data-block-type="hero"]',
      ) as HTMLElement,
    );

    expect(container.querySelector('[data-testid="save-status"]')?.textContent).toContain(
      "Saving",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const saved = await loadAutosave(vfs);
    expect(saved?.pages[0]?.blocks.length).toBe((baseSite.pages[0]?.blocks.length ?? 0) + 1);
    const status = container.querySelector('[data-testid="save-status"]');
    expect(status?.getAttribute("data-status")).toBe("saved");
    expect(status?.textContent).toContain("Saved in this browser");
  });
});
