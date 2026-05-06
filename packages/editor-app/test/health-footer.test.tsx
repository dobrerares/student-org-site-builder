// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";

import { HealthFooter } from "../src/health-footer.js";
import type { ValidationResult } from "@sosb/schema";

function buildResult(errors: number, warnings: number, info: number): ValidationResult {
  const issue = (severity: "error" | "warning" | "info", i: number) => ({
    severity,
    path: ["x", i] as (string | number)[],
    code: `stub.${severity}.${i}`,
    message: `${severity} ${i}`,
  });
  return {
    errors: Array.from({ length: errors }, (_, i) => issue("error", i)),
    warnings: Array.from({ length: warnings }, (_, i) => issue("warning", i)),
    info: Array.from({ length: info }, (_, i) => issue("info", i)),
    ok: errors === 0,
  };
}

/**
 * AC #5: footer indicator shows aggregate counts (e.g. "3 errors, 7
 * warnings"). The component is fed a `ValidationResult` and clicks bubble
 * up via `onToggle` so the editor shell can open the Site Health panel.
 */
describe("Health footer — aggregate indicator", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders error/warning/info counts in stable, machine-readable form", () => {
    const result = buildResult(3, 7, 2);
    const { container } = render(<HealthFooter result={result} onToggle={() => undefined} />);

    expect(container.querySelector('[data-count="error"]')?.textContent).toContain("3");
    expect(container.querySelector('[data-count="warning"]')?.textContent).toContain("7");
    expect(container.querySelector('[data-count="info"]')?.textContent).toContain("2");
  });

  test("the visible label reads `3 errors, 7 warnings, 2 info` (PRD example)", () => {
    const result = buildResult(3, 7, 2);
    const { container } = render(<HealthFooter result={result} onToggle={() => undefined} />);
    const text = (container.textContent ?? "").toLowerCase();
    expect(text).toMatch(/3\s*error/);
    expect(text).toMatch(/7\s*warning/);
    expect(text).toMatch(/2\s*info/);
  });

  test("clicking the footer fires onToggle (so the editor opens the Site Health panel)", () => {
    const result = buildResult(1, 1, 0);
    const calls: number[] = [];
    const { container } = render(<HealthFooter result={result} onToggle={() => calls.push(1)} />);
    const button = container.querySelector<HTMLElement>('[data-testid="health-footer-toggle"]');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(calls.length).toBe(1);
  });

  test("when the result is empty, the footer still renders zeros (no flicker)", () => {
    const result = buildResult(0, 0, 0);
    const { container } = render(<HealthFooter result={result} onToggle={() => undefined} />);
    expect(container.querySelector('[data-count="error"]')?.textContent).toContain("0");
    expect(container.querySelector('[data-count="warning"]')?.textContent).toContain("0");
  });
});
