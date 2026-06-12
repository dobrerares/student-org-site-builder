import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { validate } from "../src/index.js";

/**
 * Build a minimal-but-valid site from the HISTORIPOL fixture, allowing the
 * caller to override the theme id. The fixture is deep-cloned so each test
 * gets a fresh, independent object.
 *
 * This helper lives here (inlined) because there is no project-wide
 * minimal-site builder yet; the existing site-level tests reach for the
 * HISTORIPOL fixture directly. Keeping it local avoids inventing a new
 * fixture surface for a single rule.
 */
function makeMinimalSite({ themeId }: { themeId: string }): unknown {
  const site = structuredClone(historipol) as unknown as {
    theme: { id: string };
  };
  site.theme.id = themeId;
  return site;
}

describe("validate() — theme.id closed-set rule (ADR 0044 corollary 3)", () => {
  test("emits a warning for an unknown theme id", () => {
    const site = makeMinimalSite({ themeId: "someFutureTheme" });
    const result = validate(site);
    const warning = result.warnings.find((w) => w.code === "site.theme.id.unknown");
    expect(warning).toBeDefined();
    expect(warning?.path).toEqual(["theme", "id"]);
  });

  test("does NOT emit a warning for a known theme id", () => {
    const site = makeMinimalSite({ themeId: "academic" });
    const result = validate(site);
    const warning = result.warnings.find((w) => w.code === "site.theme.id.unknown");
    expect(warning).toBeUndefined();
  });

  test("a snapshot with an unknown theme id still parses (round-trip preserved)", () => {
    const site = makeMinimalSite({ themeId: "someFutureTheme" });
    const result = validate(site);
    expect(result.ok).toBe(true);
  });

  test("does NOT emit a warning for the stub theme (registered but hidden in UI)", () => {
    const site = makeMinimalSite({ themeId: "stub" });
    const result = validate(site);
    const warning = result.warnings.find((w) => w.code === "site.theme.id.unknown");
    expect(warning).toBeUndefined();
  });
});

describe("validate() — PRD quality warnings", () => {
  test("emits a warning for low-contrast custom theme colours", () => {
    const site = makeMinimalSite({ themeId: "academic" }) as {
      theme: { tokens: { colorPrimary: string; colorAccent: string } };
    };
    site.theme.tokens.colorPrimary = "#ffffff";

    const result = validate(site);
    const warning = result.warnings.find(
      (w) =>
        w.code === "site.theme.tokens.contrast.low" &&
        w.path.join(".") === "theme.tokens.colorPrimary",
    );
    expect(warning).toBeDefined();
  });

  test("does not warn for contrast-safe custom theme colours", () => {
    const site = makeMinimalSite({ themeId: "academic" }) as {
      theme: { tokens: { colorPrimary: string; colorAccent: string } };
    };
    site.theme.tokens.colorPrimary = "#111111";

    const result = validate(site);
    const warning = result.warnings.find(
      (w) =>
        w.code === "site.theme.tokens.contrast.low" &&
        w.path.join(".") === "theme.tokens.colorPrimary",
    );
    expect(warning).toBeUndefined();
  });

  test("emits a warning for image refs with oversized byte metadata", () => {
    const site = makeMinimalSite({ themeId: "academic" }) as {
      pages: Array<{
        blocks: Array<{
          data: { backgroundImage?: Record<string, unknown> };
        }>;
      }>;
    };
    const image = site.pages[0]!.blocks[0]!.data.backgroundImage!;
    image.variants = [
      {
        width: 1600,
        height: 900,
        mime: "image/webp",
        path: "assets/hero.1600.webp",
        bytes: 260 * 1024,
      },
    ];

    const result = validate(site);
    const warning = result.warnings.find((w) => w.code === "site.asset.image.oversized");
    expect(warning).toBeDefined();
    expect(warning?.path).toEqual(["pages", 0, "blocks", 0, "data", "backgroundImage"]);
  });
});
