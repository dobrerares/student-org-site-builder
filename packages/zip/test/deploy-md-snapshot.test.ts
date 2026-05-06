import { describe, expect, test } from "vitest";
import { generateDeployMd } from "../src/deploy-md.js";

/**
 * End-to-end snapshot tests for the DEPLOY.md generator.
 *
 * Each snapshot is captured to its own golden file under `__golden__/`.
 * Reviewers can read the actual generated content during PR review and
 * the regression test detects any prose drift.
 *
 * We snapshot four representative inputs: RO and EN, each with a "minimal"
 * input (no siteUrl, no customDomain) and a "full" input (HISTORIPOL-shaped
 * with both set).
 */
describe("generateDeployMd — golden files", () => {
  test("ro-minimal: Romanian, no siteUrl, no customDomain", async () => {
    const md = generateDeployMd({
      language: "ro",
      org: { name: "Asociația Studențească HISTORIPOL" },
    });
    await expect(md).toMatchFileSnapshot("__golden__/ro-minimal.md");
  });

  test("ro-full: Romanian, with siteUrl + customDomain", async () => {
    const md = generateDeployMd({
      language: "ro",
      org: { name: "Asociația Studențească HISTORIPOL" },
      siteUrl: "https://historipol.ro",
      customDomain: "historipol.ro",
    });
    await expect(md).toMatchFileSnapshot("__golden__/ro-full.md");
  });

  test("en-minimal: English, no siteUrl, no customDomain", async () => {
    const md = generateDeployMd({
      language: "en",
      org: { name: "HISTORIPOL Student Association" },
    });
    await expect(md).toMatchFileSnapshot("__golden__/en-minimal.md");
  });

  test("en-full: English, with siteUrl + customDomain", async () => {
    const md = generateDeployMd({
      language: "en",
      org: { name: "HISTORIPOL Student Association" },
      siteUrl: "https://historipol.ro",
      customDomain: "historipol.ro",
    });
    await expect(md).toMatchFileSnapshot("__golden__/en-full.md");
  });
});
