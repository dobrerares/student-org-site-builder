/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Integration: validation reaches the author in two places — the Overview's
 * Site Health card and the export readiness panel — and both offer a repair
 * action that opens the right destination and focuses the field.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import tiered from "./fixtures/issue-tiered-site.json" with { type: "json" };
import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { setViewportWidth } from "./helpers/nav.js";
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

function siteWithBlockValidationIssue(): Site {
  const site = cleanExportSite();
  site.pages[0]!.blocks = [
    {
      id: "blk_contact",
      type: "contactCard",
      version: 1,
      data: {
        mapEmbed: {
          enabled: true,
          provider: "osm",
          coordinates: "44.4268,26.1025",
        },
      },
    },
  ];
  return site;
}

beforeEach(() => setViewportWidth(1200));

describe("Overview Site Health", () => {
  afterEach(() => cleanup());

  test("lists the current errors and warnings as findings", () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);
    const health = container.querySelector('[data-testid="overview-health"]');
    expect(health).not.toBeNull();

    // Tiered fixture produces ≥1 error and ≥1 warning.
    const findings = container.querySelectorAll('[data-testid="overview-findings"] [data-finding]');
    const severities = Array.from(findings).map((f) => f.getAttribute("data-severity"));
    expect(severities).toContain("error");
    expect(severities).toContain("warning");
    expect(
      container.querySelector('[data-testid="overview-health-summary"]')?.textContent,
    ).not.toContain("All good");
  });

  test("Fix on a spine issue opens Site settings and focuses the field", async () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);

    // The missing-org-email warning ("org.email") maps to the spine form's
    // `[data-field="org.email"]` input.
    const fix = container.querySelector<HTMLElement>(
      '[data-testid="overview-findings"] [data-finding][data-path="org.email"] [data-testid="finding-fix"]',
    );
    expect(fix).not.toBeNull();
    fireEvent.click(fix!);

    expect(container.querySelector('[data-testid="settings-screen"]')).not.toBeNull();
    const target = container.querySelector<HTMLInputElement>('[data-field="org.email"]');
    expect(target).not.toBeNull();
    await Promise.resolve();
    expect(document.activeElement).toBe(target);
  });

  test("Fix on a Block issue opens the page, drills into the Block and focuses the field", async () => {
    const { container } = render(<EditorApp initial={siteWithBlockValidationIssue()} />);

    const fix = container.querySelector<HTMLElement>(
      '[data-finding][data-path="pages.0.blocks.0.data.mapEmbed.coordinates"] [data-testid="finding-fix"]',
    );
    expect(fix).not.toBeNull();
    fireEvent.click(fix!);

    await Promise.resolve();
    await Promise.resolve();

    const inspector = container.querySelector('[data-testid="inspector"]');
    expect(inspector?.getAttribute("data-inspector-mode")).toBe("block");
    expect(inspector?.getAttribute("data-block-id")).toBe("blk_contact");
    const latInput = container.querySelector<HTMLInputElement>(
      '[data-field="mapEmbed.coordinates.0"]',
    );
    expect(latInput).not.toBeNull();
    expect(document.activeElement).toBe(latInput);
  });

  test("a clean site says so and lists nothing", () => {
    const { container } = render(<EditorApp initial={cleanExportSite()} />);
    expect(container.querySelector('[data-testid="overview-health-summary"]')?.textContent).toBe(
      "All good",
    );
    expect(
      container.querySelectorAll('[data-testid="overview-findings"] [data-finding]').length,
    ).toBe(0);
  });
});

/**
 * Export website always opens the readiness panel (issue #102). With errors
 * present the export button stays disabled until the gate phrase is typed
 * (ADR 0016); with nothing wrong it exports in one click; the panel is where
 * the author learns that exporting does not update the live website.
 */
describe("Export readiness", () => {
  afterEach(() => cleanup());

  test("with errors present, the panel opens and export waits for the phrase", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={structuredClone(tieredSite)} onExport={(s) => exports.push(s)} />,
    );
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);

    const panel = container.querySelector('[data-testid="export-readiness"]');
    expect(panel).not.toBeNull();
    expect(
      panel!.querySelectorAll('[data-testid="export-blockers"] [data-finding]').length,
    ).toBeGreaterThan(0);
    expect(exports.length).toBe(0);

    const confirm = panel!.querySelector<HTMLButtonElement>(
      '[data-testid="export-confirm-button"]',
    );
    expect(confirm!.disabled).toBe(true);

    const input = panel!.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]');
    fireEvent.input(input!, { target: { value: "DOWNLOAD" } });
    expect(confirm!.disabled).toBe(false);
    fireEvent.click(confirm!);

    expect(exports.length).toBe(1);
  });

  test("a clean site still opens the panel and exports in one click", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={cleanExportSite()} onExport={(s) => exports.push(s)} />,
    );
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);

    const panel = container.querySelector('[data-testid="export-readiness"]');
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('[data-testid="export-ready"]')).not.toBeNull();
    expect(panel!.querySelector('[data-testid="export-confirm-input"]')).toBeNull();
    // The explanation that exporting does not update the live site is behind an (i).
    expect(panel!.querySelector('[data-testid="export-info"]')).not.toBeNull();
    expect(exports.length).toBe(0);

    fireEvent.click(
      panel!.querySelector<HTMLButtonElement>('[data-testid="export-confirm-button"]')!,
    );
    expect(exports.length).toBe(1);
    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();
  });

  test("Fix from the panel closes it and opens the destination", () => {
    const { container } = render(<EditorApp initial={structuredClone(tieredSite)} />);
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);
    const fix = container.querySelector<HTMLElement>(
      '[data-testid="export-readiness"] [data-finding][data-path="org.email"] [data-testid="finding-fix"]',
    );
    expect(fix).not.toBeNull();
    fireEvent.click(fix!);

    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();
    expect(container.querySelector('[data-testid="settings-screen"]')).not.toBeNull();
  });

  test("cancel leaves the editor untouched and does not fire onExport", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={structuredClone(tieredSite)} onExport={(s) => exports.push(s)} />,
    );
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="export-cancel-button"]')!,
    );

    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();
    expect(exports.length).toBe(0);
  });
});

describe("Export readiness — the gate starts over", () => {
  afterEach(() => cleanup());

  test("a phrase typed and then cancelled does not survive reopening the panel", () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp initial={structuredClone(tieredSite)} onExport={(s) => exports.push(s)} />,
    );
    const exportButton = (): HTMLButtonElement =>
      container.querySelector<HTMLButtonElement>('button[data-action="export"]')!;

    fireEvent.click(exportButton());
    fireEvent.input(
      container.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]')!,
      {
        target: { value: "DOWNLOAD" },
      },
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-testid="export-cancel-button"]')!,
    );

    fireEvent.click(exportButton());
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]')!.value,
    ).toBe("");
    expect(
      container.querySelector<HTMLButtonElement>('[data-testid="export-confirm-button"]')!.disabled,
    ).toBe(true);
    expect(exports.length).toBe(0);
  });
});
