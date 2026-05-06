import { describe, expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * AC: GitHub Actions release workflow builds + publishes per-platform
 * installers when a tag like `v1.2.3` is pushed.
 *
 * We can't actually run GitHub Actions inside vitest, so we test the
 * workflow file *structurally*. A working release workflow has:
 *
 * - A `release.yml` file under `.github/workflows/`.
 * - A trigger on tag pushes matching `v*` (so the maintainer can cut a
 *   release with `git tag v1.2.3 && git push --tags`).
 * - A matrix over `ubuntu-latest`, `macos-latest`, `windows-latest`
 *   (each runner produces its native installer; cross-platform builds
 *   for unsigned mac do not work without macOS).
 * - A `pnpm install` + `pnpm build` step before electron-builder runs.
 * - The electron-builder `--publish always` flag (so artifacts upload to
 *   the GitHub Release the tag created).
 * - A `GH_TOKEN` env var so electron-builder can authenticate to the
 *   GitHub Releases API.
 *
 * The workflow lives at `.github/workflows/release.yml` so GitHub picks
 * it up automatically; renaming this file means renaming this test.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(here, "..", "..", "..", ".github", "workflows", "release.yml");

describe("release workflow (.github/workflows/release.yml)", () => {
  test("workflow file exists", () => {
    expect(existsSync(workflowPath), `expected ${workflowPath} to exist`).toBe(true);
  });

  const yaml = existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";

  test("triggers on tag pushes matching v*", () => {
    expect(yaml).toMatch(/on:\s*[\s\S]*push:\s*[\s\S]*tags:\s*[\s\S]*['"]?v\*['"]?/);
  });

  test("runs the build on all three platform runners", () => {
    expect(yaml).toMatch(/ubuntu-latest/);
    expect(yaml).toMatch(/macos-latest/);
    expect(yaml).toMatch(/windows-latest/);
  });

  test("uses pnpm with frozen lockfile", () => {
    expect(yaml).toMatch(/pnpm install --frozen-lockfile/);
  });

  test("runs the workspace build before packaging", () => {
    expect(yaml).toMatch(/pnpm build/);
  });

  test("invokes electron-builder with --publish always", () => {
    expect(yaml).toMatch(/electron-builder/);
    expect(yaml).toMatch(/--publish[\s=]+always/);
  });

  test("exposes GH_TOKEN for the GitHub Releases upload", () => {
    expect(yaml).toMatch(/GH_TOKEN/);
    // `secrets.GITHUB_TOKEN` is the GitHub-provisioned token; we don't
    // require a personal token.
    expect(yaml).toMatch(/secrets\.GITHUB_TOKEN/);
  });

  test("uses corepack to enable pnpm via the packageManager field", () => {
    expect(yaml).toMatch(/corepack enable/);
  });

  test("checks out the repo with actions/checkout", () => {
    expect(yaml).toMatch(/actions\/checkout/);
  });

  test("sets up node 20 via actions/setup-node", () => {
    expect(yaml).toMatch(/actions\/setup-node/);
    expect(yaml).toMatch(/node-version:\s*['"]?20['"]?/);
  });
});
