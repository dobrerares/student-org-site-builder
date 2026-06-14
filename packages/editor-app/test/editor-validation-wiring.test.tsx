// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import type { Site } from "@sosb/schema";

import tiered from "./fixtures/issue-tiered-site.json" with { type: "json" };
import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";

const tieredSite = tiered as unknown as Site;
const minimalSite = minimal as unknown as Site;

function cleanExportSite(): Site {
  const site = structuredClone(minimalSite);
  site.theme.tokens = {
    ...(site.theme.tokens ?? {}),
    colorPrimary: "#1f3a5f",
    colorAccent: "#7a2d16",
  };
  return site;
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1200,
  });
});

/**
 * Integration: the editor wires the Site Health panel + footer + export
 * dialog together, so changes in `EditorState` flow through to all three
 * surfaces.
 */
describe("EditorApp validation wiring", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the health footer with current aggregate counts", () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);
    const footer = container.querySelector('[data-testid="health-footer"]');
    expect(footer).not.toBeNull();

    // Tiered fixture produces ≥1 error and ≥1 warning.
    const errCount = footer!.querySelector('[data-count="error"]')?.textContent ?? "";
    const warnCount = footer!.querySelector('[data-count="warning"]')?.textContent ?? "";
    const errN = Number(errCount.replace(/\D+/g, "")) || 0;
    const warnN = Number(warnCount.replace(/\D+/g, "")) || 0;
    expect(errN).toBeGreaterThan(0);
    expect(warnN).toBeGreaterThan(0);
  });

  test("toggling the footer opens the Site Health panel", () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);
    expect(container.querySelector('[data-testid="site-health-panel"]')).toBeNull();

    const toggle = container.querySelector<HTMLElement>('[data-testid="health-footer-toggle"]');
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);

    expect(container.querySelector('[data-testid="site-health-panel"]')).not.toBeNull();
  });

  test("clicking an issue in the panel focuses the corresponding form field", async () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);
    const toggle = container.querySelector<HTMLElement>('[data-testid="health-footer-toggle"]');
    fireEvent.click(toggle!);

    // Pick a row whose path lands on a real spine-form input. The fixture's
    // missing-org-email warning ("org.email") maps cleanly to the
    // `[data-field="org.email"]` input the spine form emits.
    const orgEmailRow = container.querySelector<HTMLElement>('[data-issue][data-path="org.email"]');
    expect(orgEmailRow).not.toBeNull();
    fireEvent.click(orgEmailRow!);

    // The editor should focus the matching field. We assert via document.activeElement.
    const target = container.querySelector<HTMLInputElement>('[data-field="org.email"]');
    expect(target).not.toBeNull();
    // Allow a microtask for the focus to settle.
    await Promise.resolve();
    expect(document.activeElement).toBe(target);
  });

  test("clean site (no issues) shows zero counts in the footer", () => {
    const { container } = render(<EditorApp initial={structuredClone(minimalSite)} />);
    const footer = container.querySelector('[data-testid="health-footer"]');
    expect(footer).not.toBeNull();
    const errCount = footer!.querySelector('[data-count="error"]')?.textContent ?? "";
    expect(errCount.replace(/\D+/g, "")).toBe("0");
  });
});

/**
 * AC #4: Export gate. When errors are present, clicking Export must open
 * the confirmation dialog and `onExport` must NOT fire until the user
 * types the gate phrase. With warnings only, `onExport` fires after a
 * single confirmation click. With no issues, `onExport` fires immediately.
 */
describe("EditorApp pre-export gate", () => {
  afterEach(() => {
    cleanup();
  });

  test("with errors present, clicking Export opens the dialog and does not fire onExport", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={structuredClone(tieredSite)} onExport={(s) => exports.push(s)} />,
    );
    const exportBtn = container.querySelector<HTMLButtonElement>('button[data-action="export"]');
    expect(exportBtn).not.toBeNull();
    fireEvent.click(exportBtn!);

    // Dialog opens.
    const dialog = container.querySelector('[data-testid="export-confirm-dialog"]');
    expect(dialog).not.toBeNull();
    // No export fired yet.
    expect(exports.length).toBe(0);

    // Confirm button is disabled until the gate phrase is typed.
    const confirm = dialog!.querySelector<HTMLButtonElement>(
      '[data-testid="export-confirm-button"]',
    );
    expect(confirm!.disabled).toBe(true);

    const input = dialog!.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]');
    fireEvent.input(input!, { target: { value: "DOWNLOAD" } });
    expect(confirm!.disabled).toBe(false);
    fireEvent.click(confirm!);

    expect(exports.length).toBe(1);
  });

  test("clean site exports immediately without opening the dialog", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={cleanExportSite()} onExport={(s) => exports.push(s)} />,
    );
    const exportBtn = container.querySelector<HTMLButtonElement>('button[data-action="export"]');
    fireEvent.click(exportBtn!);

    expect(container.querySelector('[data-testid="export-confirm-dialog"]')).toBeNull();
    expect(exports.length).toBe(1);
  });

  test("cancel from the dialog leaves the editor untouched and does not fire onExport", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={structuredClone(tieredSite)} onExport={(s) => exports.push(s)} />,
    );
    const exportBtn = container.querySelector<HTMLButtonElement>('button[data-action="export"]');
    fireEvent.click(exportBtn!);

    const dialog = container.querySelector('[data-testid="export-confirm-dialog"]');
    const cancel = dialog!.querySelector<HTMLButtonElement>('[data-testid="export-cancel-button"]');
    fireEvent.click(cancel!);

    // Dialog closes; no export.
    expect(container.querySelector('[data-testid="export-confirm-dialog"]')).toBeNull();
    expect(exports.length).toBe(0);
  });
});
