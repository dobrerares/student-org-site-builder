// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";

import tiered from "./fixtures/issue-tiered-site.json" with { type: "json" };
import { SiteHealthPanel } from "../src/site-health.js";

const site = tiered as unknown as Site;

/**
 * AC #1: errors, warnings, and info each render distinctly.
 * AC #2: the panel lists every issue with severity, location and a
 *         human-readable message.
 *
 * The panel is fed the result of `validate(site)`; it groups issues into
 * three sections (Errors / Warnings / Info) and emits stable
 * `data-severity-group="error|warning|info"` attributes for each group so
 * the editor's CSS, the click-to-jump test, and accessibility tooling can
 * target them without relying on rendered copy.
 */
describe("Site Health panel — grouped rendering", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders three distinct severity groups (error, warning, info)", () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );

    expect(container.querySelector('[data-severity-group="error"]')).not.toBeNull();
    expect(container.querySelector('[data-severity-group="warning"]')).not.toBeNull();
    expect(container.querySelector('[data-severity-group="info"]')).not.toBeNull();
  });

  test("emits one `data-issue` row per issue across all tiers", () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );

    const total = result.errors.length + result.warnings.length + result.info.length;
    const rows = container.querySelectorAll("[data-issue]");
    expect(rows.length).toBe(total);
  });

  test("each issue row exposes its severity and dotted path", () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );

    const firstError = result.errors[0];
    if (firstError === undefined) throw new Error("fixture should produce an error");
    const dotted = firstError.path.join(".");
    const row = container.querySelector(
      `[data-issue][data-severity="error"][data-path="${dotted}"]`,
    );
    expect(row).not.toBeNull();
  });

  test("each issue row carries the human-readable message", () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );

    const firstWarning = result.warnings[0];
    if (firstWarning === undefined) throw new Error("fixture should produce a warning");
    const rows = container.querySelectorAll('[data-issue][data-severity="warning"]');
    const found = Array.from(rows).find((r) => r.textContent?.includes(firstWarning.message));
    expect(found).toBeDefined();
  });

  test("when a result has no issues, panel renders an `all clear` message", () => {
    const empty = {
      errors: [],
      warnings: [],
      info: [],
      ok: true,
    };
    const { container } = render(
      <SiteHealthPanel result={empty} onJump={() => undefined} />,
    );
    expect(container.textContent ?? "").toMatch(/no issues|all clear|clean/i);
  });
});

/**
 * AC #3: clicking an issue navigates the editor to the offending field.
 *
 * The panel doesn't know how to navigate by itself — it calls back via
 * `onJump(issue)` so the editor shell can scroll/focus the target. We
 * assert the contract: a click on a `[data-issue]` row emits an `onJump`
 * call carrying the same issue object that the panel rendered.
 */
describe("Site Health panel — click-to-jump", () => {
  afterEach(() => {
    cleanup();
  });

  test("clicking an issue row fires onJump with the matching issue", () => {
    const result = validate(site);
    const calls: unknown[] = [];
    const { container } = render(
      <SiteHealthPanel result={result} onJump={(issue) => calls.push(issue)} />,
    );

    const firstError = result.errors[0];
    if (firstError === undefined) throw new Error("fixture should produce an error");
    const dotted = firstError.path.join(".");
    const row = container.querySelector<HTMLElement>(
      `[data-issue][data-severity="error"][data-path="${dotted}"]`,
    );
    expect(row).not.toBeNull();

    fireEvent.click(row!);
    expect(calls.length).toBe(1);
    const passed = calls[0] as { code: string; path: (string | number)[] };
    expect(passed.code).toBe(firstError.code);
    expect(passed.path).toEqual(firstError.path);
  });

  test("issue rows are buttons (keyboard-activable)", () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );
    const rows = container.querySelectorAll("[data-issue]");
    for (const row of Array.from(rows)) {
      // Either a real button or an element with role="button" + tabindex.
      const isButton =
        row.tagName.toLowerCase() === "button" ||
        (row.getAttribute("role") === "button" && row.hasAttribute("tabindex"));
      expect(isButton).toBe(true);
    }
  });
});
