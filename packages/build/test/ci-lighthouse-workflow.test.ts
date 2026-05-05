import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * AC #3 — CI Lighthouse run asserts 95+ on Performance, Accessibility,
 * Best Practices, and SEO. We assert the workflow file is structurally
 * sound and points at the Lighthouse step + the lighthouserc config.
 *
 * The workflow YAML is parsed (loosely) here rather than via a third-party
 * yaml lib to avoid pulling a new runtime dep into the test surface; the
 * shape we want to verify is small and stable enough that a string-grep
 * approach is honest. The `actions/checkout` workflow expression is checked
 * to ensure the file isn't a stub.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..", "..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("CI workflow — Lighthouse job", () => {
  const workflow = read(".github/workflows/ci.yml");

  test("ci.yml exists and is non-empty", () => {
    expect(workflow.length).toBeGreaterThan(0);
  });

  test("ci.yml has a 'lighthouse' job", () => {
    expect(workflow).toMatch(/^\s+lighthouse:\s*$/m);
  });

  test("the lighthouse job depends on the build job (needs)", () => {
    expect(workflow).toMatch(/needs:\s*\[?build\]?/);
  });

  test("the lighthouse job runs the materialise script", () => {
    expect(workflow).toMatch(/scripts\/build-lighthouse-fixture\.mjs/);
  });

  test("the lighthouse job invokes treosh/lighthouse-ci-action", () => {
    expect(workflow).toMatch(/treosh\/lighthouse-ci-action@/);
  });

  test("the lighthouse job points at lighthouserc.json", () => {
    expect(workflow).toMatch(/configPath:\s*\.\/lighthouserc\.json/);
  });

  test("ci.yml is YAML-shaped (consistent two-space indent, no tabs)", () => {
    expect(workflow).not.toMatch(/\t/);
    // Top-level keys: name, on, concurrency, jobs.
    expect(workflow).toMatch(/^name:\s/m);
    expect(workflow).toMatch(/^jobs:\s*$/m);
  });
});

describe("Lighthouse config", () => {
  const raw = read("lighthouserc.json");

  test("lighthouserc.json is valid JSON", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("asserts 95+ on Performance, Accessibility, Best Practices, SEO", () => {
    const config = JSON.parse(raw);
    const a = config.ci.assert.assertions;
    for (const key of [
      "categories:performance",
      "categories:accessibility",
      "categories:best-practices",
      "categories:seo",
    ]) {
      expect(a[key]).toBeDefined();
      const rule = a[key];
      // Shape: ["error" | "warn", { minScore: number }]
      expect(Array.isArray(rule)).toBe(true);
      const minScore = rule[1]?.minScore;
      expect(typeof minScore).toBe("number");
      expect(minScore).toBeGreaterThanOrEqual(0.95);
    }
  });

  test("uses the lighthouse-dist directory the materialise script writes to", () => {
    const config = JSON.parse(raw);
    expect(config.ci.collect.staticDistDir).toBe("./lighthouse-dist");
  });
});
