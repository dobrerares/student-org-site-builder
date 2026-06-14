// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";

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
