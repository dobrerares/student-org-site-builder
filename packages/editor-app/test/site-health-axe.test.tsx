// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/preact";
import axe from "axe-core";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";

import tiered from "./fixtures/issue-tiered-site.json" with { type: "json" };
import { SiteHealthPanel } from "../src/site-health.js";
import { ExportConfirmDialog } from "../src/export-confirm.js";
import { HealthFooter } from "../src/health-footer.js";

const site = tiered as unknown as Site;

/**
 * The Site Health surfaces (panel, footer, dialog) must be axe-clean. The
 * shell axe-tests in `@sosb/renderer` cover the published site; this test
 * covers the editor's chrome.
 *
 * jsdom doesn't compute styles, so colour-contrast checks are disabled
 * (matching the renderer's a11y test). Structural/semantic rules are the
 * load-bearing checks here.
 */

async function axeCheck(node: Element): Promise<void> {
  const results = await axe.run(node, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  expect(results.violations).toEqual([]);
}

describe("Site Health surfaces — axe accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  test("Site Health panel has zero axe violations", async () => {
    const result = validate(site);
    const { container } = render(
      <SiteHealthPanel result={result} onJump={() => undefined} />,
    );
    await axeCheck(container);
  });

  test("Health footer has zero axe violations", async () => {
    const result = validate(site);
    const { container } = render(
      <HealthFooter result={result} onToggle={() => undefined} />,
    );
    await axeCheck(container);
  });

  test("Export confirm dialog (errors path) has zero axe violations", async () => {
    const result = validate(site);
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await axeCheck(container);
  });

  test("Export confirm dialog (warnings-only path) has zero axe violations", async () => {
    const result = {
      errors: [],
      warnings: [
        {
          severity: "warning" as const,
          path: ["org", "email"] as (string | number)[],
          code: "stub.warning",
          message: "stub warning",
        },
      ],
      info: [],
      ok: true,
    };
    const { container } = render(
      <ExportConfirmDialog
        result={result}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await axeCheck(container);
  });
});
