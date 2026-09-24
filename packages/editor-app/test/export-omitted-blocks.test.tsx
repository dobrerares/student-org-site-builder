/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * ADR 0045 in the export readiness panel: a Block the active Theme has no
 * design for is left out of the published Site, and the author acknowledges
 * that list before the export proceeds. The acknowledgement is a checkbox —
 * not a typed phrase (nothing is broken) and not a plain warning (it must not
 * be passable without reading) — and it sits on top of the validation gate,
 * never in place of it.
 *
 * Rendered through the whole `EditorApp`, so what is tested is the list the
 * editor actually computes (`omittedBlocksFor` under the active Theme), not
 * a prop handed to the panel by the test.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { vfsWithPartnersPackage } from "./fixtures/partners-package.js";
import { setViewportWidth } from "./helpers/nav.js";
import { EditorApp } from "../src/editor-app.js";

const minimalSite = minimal as unknown as Site;

/** A clean Site (no validation findings) so only the omission gate applies. */
function cleanSite(): Site {
  const site = structuredClone(minimalSite);
  site.theme.tokens = {
    ...(site.theme.tokens ?? {}),
    colorPrimary: "#1f3a5f",
    colorAccent: "#7a2d16",
  };
  return site;
}

/**
 * The same Site with a Custom Block type no built-in Theme can render. The
 * type *is* declared — by the package the tests install into the Site VFS
 * (ADR 0055) — so it is an omission, not a missing extension: a declared type
 * the active Theme does not design is acknowledged; an undeclared one blocks
 * the export outright (see custom-blocks-editor.test.tsx).
 */
function siteWithCustomBlock(): Site {
  const site = cleanSite();
  site.pages[0]!.blocks.push({
    id: "blk_partners",
    type: "org.example/partners",
    version: 1,
    data: { heading: "Alpha" },
  });
  return site;
}

function openExport(container: HTMLElement): HTMLElement {
  fireEvent.click(container.querySelector<HTMLButtonElement>('button[data-action="export"]')!);
  const panel = container.querySelector<HTMLElement>('[data-testid="export-readiness"]');
  if (panel === null) throw new Error("the export readiness panel did not open");
  return panel;
}

/** Open the panel once the shell has read `themes/` and the omission list is up. */
async function openExportWithOmissions(container: HTMLElement): Promise<HTMLElement> {
  const panel = openExport(container);
  await waitFor(() => {
    if (panel.querySelector('[data-testid="export-omitted-blocks"]') === null) {
      throw new Error("omissions not listed yet");
    }
  });
  return panel;
}

function confirmButton(panel: HTMLElement): HTMLButtonElement {
  const button = panel.querySelector<HTMLButtonElement>('[data-testid="export-confirm-button"]');
  if (button === null) throw new Error("no export button");
  return button;
}

beforeEach(() => setViewportWidth(1200));

describe("Export readiness — omitted Blocks (ADR 0045)", () => {
  afterEach(() => cleanup());

  test("lists the Blocks the Theme cannot render and gates the export on the checkbox", async () => {
    const exports: Site[] = [];
    const { container } = render(
      <EditorApp
        initial={siteWithCustomBlock()}
        initialAssetVfs={await vfsWithPartnersPackage()}
        onExport={(s) => exports.push(s)}
      />,
    );
    const panel = await openExportWithOmissions(container);

    // A clean Site otherwise: the "ready" row shows, no phrase is asked for.
    expect(panel.querySelector('[data-testid="export-ready"]')).not.toBeNull();
    expect(panel.querySelector('[data-testid="export-confirm-input"]')).toBeNull();

    const list = panel.querySelector('[data-testid="export-omitted-blocks"]');
    expect(list).not.toBeNull();
    expect(list!.querySelector("h3")?.textContent).toBe("Left out of the website (1)");
    const row = list!.querySelector('[data-omitted-block][data-block-id="blk_partners"]');
    expect(row).not.toBeNull();
    expect(row!.getAttribute("data-block-type")).toBe("org.example/partners");
    expect(row!.textContent).toContain("org.example/partners");
    expect(row!.textContent).toContain("Page");

    const confirm = confirmButton(panel);
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(exports.length).toBe(0);

    const ack = panel.querySelector<HTMLInputElement>('[data-testid="export-omitted-ack"]');
    expect(ack).not.toBeNull();
    fireEvent.click(ack!);
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(exports.length).toBe(1);
    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();
  });

  test("the acknowledgement starts over each time the panel opens", async () => {
    const { container } = render(
      <EditorApp
        initial={siteWithCustomBlock()}
        initialAssetVfs={await vfsWithPartnersPackage()}
      />,
    );
    let panel = await openExportWithOmissions(container);
    fireEvent.click(panel.querySelector<HTMLInputElement>('[data-testid="export-omitted-ack"]')!);
    expect(confirmButton(panel).disabled).toBe(false);

    fireEvent.click(
      panel.querySelector<HTMLButtonElement>('[data-testid="export-cancel-button"]')!,
    );
    expect(container.querySelector('[data-testid="export-readiness"]')).toBeNull();

    panel = openExport(container);
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="export-omitted-ack"]')!.checked,
    ).toBe(false);
    expect(confirmButton(panel).disabled).toBe(true);
  });

  test("without omissions the panel shows no acknowledgement at all", () => {
    const { container } = render(<EditorApp initial={cleanSite()} />);
    const panel = openExport(container);
    expect(panel.querySelector('[data-testid="export-omitted-blocks"]')).toBeNull();
    expect(confirmButton(panel).disabled).toBe(false);
  });
});
