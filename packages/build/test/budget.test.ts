import { describe, expect, test, vi, afterEach, beforeEach } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { build, BUDGET_LIMITS, measureBudgets } from "../src/index.js";
import {
  buildOversizedCssDist,
  buildOversizedHtmlDist,
  buildOversizedJsDist,
} from "./fixtures/oversized-dist.js";

const fixture = singlePageSite as unknown as Site;

/**
 * AC #1 — Build emits per-page budget report to `dist/_lighthouse-budget.json`.
 *
 * Shape:
 *   {
 *     status: "pass" | "warn",
 *     pages: {
 *       [path]: {
 *         status: "pass" | "warn",
 *         metrics: {
 *           html|css|js|hero: {
 *             status: "pass" | "warn" | "skipped",
 *             bytes?: number,         // measured byte count
 *             limitBytes: number,     // budget threshold
 *             note?: string,          // why "skipped" if applicable
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 * The CSS metric is measured POST-GZIP (the PRD pins "≤15kb gzipped").
 * All other metrics are raw byte counts.
 */
describe("build — _lighthouse-budget.json emission", () => {
  test("emits the report at dist/_lighthouse-budget.json", () => {
    const dist = build(fixture);
    expect(dist.has("_lighthouse-budget.json")).toBe(true);
  });

  test("the report is JSON-parseable", () => {
    const dist = build(fixture);
    const raw = dist.get("_lighthouse-budget.json")!;
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("the report records the home page (index.html)", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    expect(report.pages).toBeDefined();
    expect(report.pages["index.html"]).toBeDefined();
  });

  test("the report exposes html, css, js, hero metrics", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    const metrics = report.pages["index.html"].metrics;
    for (const key of ["html", "css", "js", "hero"]) {
      expect(metrics[key]).toBeDefined();
      expect(metrics[key].limitBytes).toBeTypeOf("number");
      expect(metrics[key].status).toMatch(/^(pass|warn|skipped)$/);
    }
  });

  test("limits match the documented PRD budgets", () => {
    expect(BUDGET_LIMITS.html).toBe(50 * 1024);
    expect(BUDGET_LIMITS.cssGzipped).toBe(15 * 1024);
    expect(BUDGET_LIMITS.js).toBe(10 * 1024);
    expect(BUDGET_LIMITS.hero).toBe(200 * 1024);
  });
});

/**
 * AC #1 — Pass-budget fixture: the existing `single-page-site.json` is small
 * enough to comfortably pass every budget. The hero metric is "skipped" in
 * v1 because the asset pipeline (#8) hasn't landed yet — the dist Map
 * carries no binary asset bytes today, only the HTML reference. The skipped
 * status is intentional and documented in ADR 0005.
 */
describe("build — pass-budget fixture (single-page-site.json)", () => {
  test("html, css, js metrics all pass", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    const metrics = report.pages["index.html"].metrics;
    expect(metrics.html.status).toBe("pass");
    expect(metrics.css.status).toBe("pass");
    expect(metrics.js.status).toBe("pass");
  });

  test("hero metric is 'skipped' in v1 (asset pipeline lands in #8)", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    expect(report.pages["index.html"].metrics.hero.status).toBe("skipped");
    expect(report.pages["index.html"].metrics.hero.note).toBeDefined();
  });

  test("page status is 'pass' when all measurable metrics pass", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    expect(report.pages["index.html"].status).toBe("pass");
  });

  test("aggregate report status is 'pass'", () => {
    const dist = build(fixture);
    const report = JSON.parse(dist.get("_lighthouse-budget.json")!);
    expect(report.status).toBe("pass");
  });
});

/**
 * AC #4 — Sample failing fixture that demonstrates a budget warning
 * correctly. The contract example: "a fixture that intentionally inlines a
 * too-large stylesheet". We exercise that via a synthetic dist Map (built by
 * `oversized-dist.ts`) fed straight into `measureBudgets`. This is the
 * cleanest unit-level path: the budget engine is a pure function from a dist
 * Map to a report, so the fixture is the dist Map.
 */
describe("measureBudgets — oversized CSS fixture warns", () => {
  test("CSS metric exceeds the gzipped 15KB budget and reports 'warn'", () => {
    const dist = buildOversizedCssDist();
    const report = measureBudgets(dist);
    const page = report.pages["index.html"]!;
    expect(page.metrics.css.status).toBe("warn");
    expect(page.metrics.css.bytes).toBeGreaterThan(BUDGET_LIMITS.cssGzipped);
  });

  test("page status is 'warn' when any metric warns", () => {
    const dist = buildOversizedCssDist();
    const report = measureBudgets(dist);
    expect(report.pages["index.html"]!.status).toBe("warn");
  });

  test("aggregate report status is 'warn'", () => {
    const dist = buildOversizedCssDist();
    const report = measureBudgets(dist);
    expect(report.status).toBe("warn");
  });
});

describe("measureBudgets — oversized HTML fixture warns", () => {
  test("HTML metric exceeds the 50KB budget and reports 'warn'", () => {
    const dist = buildOversizedHtmlDist();
    const report = measureBudgets(dist);
    const page = report.pages["index.html"]!;
    expect(page.metrics.html.status).toBe("warn");
    expect(page.metrics.html.bytes).toBeGreaterThan(BUDGET_LIMITS.html);
  });
});

describe("measureBudgets — oversized JS fixture warns", () => {
  test("JS metric exceeds the 10KB budget and reports 'warn'", () => {
    const dist = buildOversizedJsDist();
    const report = measureBudgets(dist);
    const page = report.pages["index.html"]!;
    expect(page.metrics.js.status).toBe("warn");
    expect(page.metrics.js.bytes).toBeGreaterThan(BUDGET_LIMITS.js);
  });
});

/**
 * AC #2 — Budget violations logged as build warnings with a clear pointer to
 * the offending file.
 *
 * `build()` itself can't easily produce an over-budget output today (the
 * renderer + stub theme are intentionally tiny). To exercise the warning
 * code path through `build()` we synthesise an over-budget dist by passing
 * a `_testInjectExtraCss` option. The option is documented as "test-only"
 * inline; production callers have no need for it.
 */
describe("build — budget warnings written to console.warn", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("emits NO warnings when every metric passes", () => {
    build(fixture);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("emits a warning naming the offending page and metric on violation", () => {
    build(fixture, { _testInjectExtraCss: makeFatCss() });
    expect(warnSpy).toHaveBeenCalled();
    const messages = warnSpy.mock.calls.map((args) => args.join(" "));
    const cssWarn = messages.find((m) => m.includes("index.html") && /css/i.test(m));
    expect(cssWarn).toBeDefined();
    // Should mention budget context: actual + limit byte counts.
    expect(cssWarn).toMatch(/\d+/);
  });
});

/**
 * AC #2 — Configurable to errors via `errorOnBudget: true`.
 */
describe("build — errorOnBudget option", () => {
  test("does NOT throw on a passing fixture, even when errorOnBudget=true", () => {
    expect(() => build(fixture, { errorOnBudget: true })).not.toThrow();
  });

  test("throws when a metric warns and errorOnBudget=true", () => {
    expect(() =>
      build(fixture, { errorOnBudget: true, _testInjectExtraCss: makeFatCss() }),
    ).toThrow(/budget/i);
  });

  test("the thrown error names the offending page and metric", () => {
    let caught: unknown;
    try {
      build(fixture, { errorOnBudget: true, _testInjectExtraCss: makeFatCss() });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/index\.html/);
    expect((caught as Error).message).toMatch(/css/i);
  });

  test("does NOT throw when errorOnBudget is omitted (default warn-only)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => build(fixture, { _testInjectExtraCss: makeFatCss() })).not.toThrow();
    spy.mockRestore();
  });
});

/**
 * Determinism — the budget report is part of the dist Map and so falls
 * under the existing same-input → same-output contract.
 */
describe("build — budget report determinism", () => {
  test("repeat builds produce byte-identical reports", () => {
    const a = build(fixture);
    const b = build(fixture);
    expect(a.get("_lighthouse-budget.json")).toBe(b.get("_lighthouse-budget.json"));
  });
});

/**
 * Build a CSS string large enough to exceed 15KB after gzip. We use a wide
 * variety of unique class selectors and unique declarations so gzip's LZ77
 * window can't compress it down past the threshold.
 */
function makeFatCss(): string {
  const lines: string[] = [];
  for (let i = 0; i < 4000; i++) {
    // Each line is ~60 unique bytes; 4000 lines is ~240KB raw, comfortably
    // over the 15KB-gzipped budget even with high-entropy unique tokens.
    lines.push(
      `.bloat-${i.toString(36)}-q${(i * 31).toString(36)} { color: #${(i * 7919).toString(16).padStart(6, "0").slice(-6)}; padding: ${i % 97}px; margin: ${i % 53}px; }`,
    );
  }
  return lines.join("\n");
}
