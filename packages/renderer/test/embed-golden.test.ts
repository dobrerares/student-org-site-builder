import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import embedOnly from "./fixtures/embed-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = embedOnly as unknown as Site;

/**
 * Golden-file tests per provider x stub theme.
 *
 * The PRD-listed "per provider x Academic theme" matrix stages here
 * against the stub theme until the Academic theme (#47) lands; the
 * stub theme is layout-only and exercises the same renderer code path.
 * When the Academic theme arrives, this file gets a sibling
 * `embed-golden-academic.test.ts` that snapshots against `academic`.
 */

const PROVIDERS = [
  "youtube",
  "vimeo",
  "spotify",
  "instagram",
  "facebook",
  "soundcloud",
  "bandcamp",
  "twitter",
] as const;

describe("embed golden files - stub theme x 8 providers", () => {
  for (const provider of PROVIDERS) {
    test(`stub theme + ${provider} embed matches its golden file`, async () => {
      const single = structuredClone(fixture) as Site;
      const block = single.pages[0]!.blocks.find((b) => {
        const data = b.data as Record<string, unknown>;
        return data.provider === provider;
      });
      if (!block) throw new Error(`fixture missing ${provider} block`);
      single.pages[0]!.blocks = [block];
      const html = renderSite(single, "stub");
      await expect(html).toMatchFileSnapshot(`__golden__/stub-theme-embed-${provider}.html`);
    });
  }
});
