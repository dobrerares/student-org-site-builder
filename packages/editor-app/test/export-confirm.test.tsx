/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { ExportConfirmDialog } from "../src/export-confirm.js";
import type { ValidationResult } from "@sosb/schema";

function buildResult(errors: number, warnings: number, info: number = 0): ValidationResult {
  const issue = (severity: "error" | "warning" | "info", i: number) => ({
    severity,
    path: ["pages", i, "slug"] as (string | number)[],
    code: `stub.${severity}.${i}`,
    message: `${severity} message ${i}`,
  });
  return {
    errors: Array.from({ length: errors }, (_, i) => issue("error", i)),
    warnings: Array.from({ length: warnings }, (_, i) => issue("warning", i)),
    info: Array.from({ length: info }, (_, i) => issue("info", i)),
    ok: errors === 0,
  };
}

/**
 * AC #4: pre-export confirmation shows errors and warnings; errors require
 * typed confirmation; warnings can be passed through with a single click.
 *
 * The dialog calls `onConfirm()` when the user has cleared the gate and
 * `onCancel()` when they back out. The exact gate depends on whether
 * errors are present:
 *
 *  - Errors present: a "type DOWNLOAD to confirm" textbox is shown; the
 *    confirm button stays disabled until that text matches.
 *  - Warnings only:  a single "Download anyway" button is enabled
 *    immediately; cancel is always available.
 *  - Clean (no issues): the dialog never renders — that path is handled
 *    upstream in the editor shell, not inside the dialog.
 */
describe("Export confirmation dialog — error gate", () => {
  afterEach(() => {
    cleanup();
  });

  test("with errors, the confirm button is disabled until the user types the confirmation phrase", () => {
    const result = buildResult(2, 1, 0);
    const calls: number[] = [];
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => calls.push(1)}
        onCancel={() => undefined}
      />,
    );

    const confirm = container.querySelector<HTMLButtonElement>(
      '[data-testid="export-confirm-button"]',
    );
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(true);

    // Click is a no-op while disabled — onConfirm must not fire.
    fireEvent.click(confirm!);
    expect(calls.length).toBe(0);

    // Type the gate phrase.
    const input = container.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]');
    expect(input).not.toBeNull();
    fireEvent.input(input!, { target: { value: "DOWNLOAD" } });
    expect(confirm!.disabled).toBe(false);

    fireEvent.click(confirm!);
    expect(calls.length).toBe(1);
  });

  test("with errors, lists every error in the dialog body", () => {
    const result = buildResult(3, 0, 0);
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const issueRows = container.querySelectorAll('[data-issue][data-severity="error"]');
    expect(issueRows.length).toBe(3);
  });

  test("cancel button always fires onCancel and never onConfirm", () => {
    const result = buildResult(1, 0, 0);
    const confirms: number[] = [];
    const cancels: number[] = [];
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => confirms.push(1)}
        onCancel={() => cancels.push(1)}
      />,
    );
    const cancel = container.querySelector<HTMLButtonElement>(
      '[data-testid="export-cancel-button"]',
    );
    expect(cancel).not.toBeNull();
    fireEvent.click(cancel!);
    expect(cancels.length).toBe(1);
    expect(confirms.length).toBe(0);
  });
});

describe("Export confirmation dialog — warning-only path", () => {
  afterEach(() => {
    cleanup();
  });

  test("with warnings only, confirm is enabled immediately (single-click `Download anyway`)", () => {
    const result = buildResult(0, 4, 0);
    const calls: number[] = [];
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => calls.push(1)}
        onCancel={() => undefined}
      />,
    );

    const confirm = container.querySelector<HTMLButtonElement>(
      '[data-testid="export-confirm-button"]',
    );
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(false);

    // No type-to-confirm input is rendered when only warnings are present.
    const input = container.querySelector<HTMLInputElement>('[data-testid="export-confirm-input"]');
    expect(input).toBeNull();

    fireEvent.click(confirm!);
    expect(calls.length).toBe(1);
  });

  test("with warnings only, lists every warning in the dialog body", () => {
    const result = buildResult(0, 5, 0);
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const rows = container.querySelectorAll('[data-issue][data-severity="warning"]');
    expect(rows.length).toBe(5);
  });
});

/**
 * ADR 0045: a Block the active Theme has no design for is left out of the
 * published Site, and the author acknowledges the list before download. The
 * acknowledgement is a checkbox — not a typed phrase (nothing is broken) and
 * not a plain warning (it must not be passable without reading).
 */
describe("Export confirmation dialog — omitted Blocks (ADR 0045)", () => {
  afterEach(() => {
    cleanup();
  });

  const omitted = [
    {
      document: { kind: "page" as const, id: "ro:acasa", title: "Acasă", lang: "ro" },
      blockId: "b9",
      blockType: "org.example/partners",
    },
  ];

  function confirmButton(container: HTMLElement): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="export-confirm-button"]',
    );
    if (button === null) throw new Error("no confirm button");
    return button;
  }

  test("omissions alone open the dialog and gate the download on the checkbox", () => {
    const calls: number[] = [];
    const { container } = render(
      <ExportConfirmDialog
        result={buildResult(0, 0)}
        omittedBlocks={omitted}
        onConfirm={() => calls.push(1)}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector("h2")?.textContent).toMatch(/left out/i);
    const list = container.querySelector('[data-testid="export-omitted-blocks"]');
    expect(list).not.toBeNull();
    expect(list!.textContent).toContain("Acasă");
    expect(list!.textContent).toContain("org.example/partners");

    const confirm = confirmButton(container);
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(calls.length).toBe(0);

    const ack = container.querySelector<HTMLInputElement>('[data-testid="export-omitted-ack"]');
    expect(ack).not.toBeNull();
    fireEvent.click(ack!);
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(calls.length).toBe(1);
  });

  test("with warnings as well, the warnings list stays and the checkbox still gates", () => {
    const { container } = render(
      <ExportConfirmDialog
        result={buildResult(0, 2)}
        omittedBlocks={omitted}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('[data-issues-group="warning"]')).not.toBeNull();
    const confirm = confirmButton(container);
    expect(confirm.disabled).toBe(true);
    fireEvent.click(container.querySelector('[data-testid="export-omitted-ack"]')!);
    expect(confirm.disabled).toBe(false);
  });

  test("the typed phrase for errors does not stand in for the acknowledgement", () => {
    const { container } = render(
      <ExportConfirmDialog
        result={buildResult(1, 0)}
        omittedBlocks={omitted}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const confirm = confirmButton(container);
    fireEvent.input(container.querySelector('[data-testid="export-confirm-input"]')!, {
      target: { value: "DOWNLOAD" },
    });
    expect(confirm.disabled).toBe(true);
    fireEvent.click(container.querySelector('[data-testid="export-omitted-ack"]')!);
    expect(confirm.disabled).toBe(false);
  });

  test("without omissions the dialog renders no acknowledgement at all", () => {
    const { container } = render(
      <ExportConfirmDialog
        result={buildResult(0, 1)}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('[data-testid="export-omitted-blocks"]')).toBeNull();
    expect(confirmButton(container).disabled).toBe(false);
  });
});
