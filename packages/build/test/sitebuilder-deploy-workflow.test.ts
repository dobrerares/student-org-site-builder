import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-browser.yml");

describe("sitebuilder Cloudflare Pages deployment workflow", () => {
  test("workflow file exists", () => {
    expect(existsSync(workflowPath), `expected ${workflowPath} to exist`).toBe(true);
  });

  const yaml = existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";

  test("deploys the hosted sitebuilder on main pushes and manual dispatch", () => {
    expect(yaml).toMatch(/name:\s*Deploy sitebuilder/);
    expect(yaml).toMatch(/push:\s*[\s\S]*branches:\s*\[main\]/);
    expect(yaml).toMatch(/workflow_dispatch:/);
  });

  test("builds and deploys the browser-shell archival output", () => {
    expect(yaml).toMatch(/pnpm --filter @sosb\/browser-shell build:archival/);
    expect(yaml).toMatch(/packages\/browser-shell\/dist\/archival\/builder\.html/);
    expect(yaml).toMatch(/pages deploy packages\/browser-shell\/dist\/archival/);
  });

  test("does not deploy generated organization site output", () => {
    expect(yaml).not.toMatch(/historipol/i);
    expect(yaml).not.toMatch(/build\/historipol-sitebuilder/);
  });

  test("uses Cloudflare Pages secrets and GitHub deployment permissions", () => {
    expect(yaml).toMatch(/deployments:\s*write/);
    expect(yaml).toMatch(/secrets\.CLOUDFLARE_API_TOKEN/);
    expect(yaml).toMatch(/secrets\.CLOUDFLARE_ACCOUNT_ID/);
    expect(yaml).toMatch(/secrets\.GITHUB_TOKEN/);
  });
});
