import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * AC: electron-builder produces .dmg, .exe, .AppImage on respective CI
 * runners.
 *
 * We can't run electron-builder inside vitest (it shells out to platform
 * tools to produce binaries), so we test the config *structurally*. A
 * working config has:
 *
 * - An `appId` (electron-builder fails-loud without one).
 * - A `productName`.
 * - `mac.target` includes `dmg`.
 * - `win.target` includes `nsis`.
 * - `linux.target` includes `AppImage`.
 * - Mac code signing IS NOT configured (out of scope for v1; see
 *   `.out-of-scope/mac-code-signing.md` and issue #44).
 *
 * The config lives at `electron-builder.config.cjs` so electron-builder's
 * native config loader (which uses `require()`) finds it without a
 * `--config` flag.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const requireFromHere = createRequire(import.meta.url);

interface TargetEntry {
  readonly target: string;
}
type TargetSpec = string | TargetEntry | ReadonlyArray<string | TargetEntry>;

interface ElectronBuilderConfig {
  readonly appId?: string;
  readonly productName?: string;
  readonly mac?: { readonly target?: TargetSpec; readonly identity?: unknown };
  readonly win?: { readonly target?: TargetSpec };
  readonly linux?: { readonly target?: TargetSpec };
  readonly afterSign?: unknown;
}

function targetNames(spec: TargetSpec | undefined): string[] {
  if (!spec) return [];
  const arr = Array.isArray(spec) ? spec : [spec];
  return arr.map((entry) => (typeof entry === "string" ? entry : entry.target));
}

describe("electron-builder config", () => {
  const configPath = path.resolve(here, "..", "electron-builder.config.cjs");
  const config = requireFromHere(configPath) as ElectronBuilderConfig;

  test("declares an appId", () => {
    expect(typeof config.appId).toBe("string");
    expect(config.appId!.length).toBeGreaterThan(0);
  });

  test("declares a productName", () => {
    expect(typeof config.productName).toBe("string");
    expect(config.productName!.length).toBeGreaterThan(0);
  });

  test("macOS target includes dmg", () => {
    expect(targetNames(config.mac?.target)).toContain("dmg");
  });

  test("Windows target includes nsis", () => {
    expect(targetNames(config.win?.target)).toContain("nsis");
  });

  test("Linux target includes AppImage", () => {
    expect(targetNames(config.linux?.target)).toContain("AppImage");
  });

  test("mac code signing is OUT OF SCOPE for v1 (no identity, no afterSign)", () => {
    // `identity` not set OR explicitly `null` (electron-builder's documented
    // way to disable code signing).
    if (config.mac && "identity" in config.mac) {
      expect(config.mac.identity).toBeNull();
    }
    expect(config.afterSign).toBeUndefined();
  });
});
