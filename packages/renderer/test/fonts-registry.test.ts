import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  FONT_FACE_REGISTRY,
  SELF_HOSTED_FAMILIES,
  woff2Base64,
  type FontFaceDef,
} from "../src/fonts/registry.js";
import { FONT_WOFF2_BASE64 } from "../src/fonts/font-bytes.generated.js";

// (family -> weights) we expect to be self-hosted. Each weight ships both
// `latin` and `latin-ext` subsets, style `normal`.
const WANT: Record<string, number[]> = {
  Archivo: [700, 800],
  "Space Grotesk": [500, 700],
  Fraunces: [600],
  "Source Serif 4": [600, 700],
  Inter: [400, 500, 600, 700],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
// test/ -> renderer/ -> packages/ -> repo root
const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("font codegen sync", () => {
  test("committed generated files match `gen:fonts --check`", () => {
    // Throws (non-zero exit) if the committed generated files have drifted.
    const out = execFileSync(process.execPath, [join("scripts", "gen-fonts.mjs"), "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(out).toContain("OK");
  });
});

describe("font registry coverage", () => {
  test("SELF_HOSTED_FAMILIES equals the five expected families", () => {
    expect([...SELF_HOSTED_FAMILIES].sort()).toEqual(Object.keys(WANT).sort());
  });

  test("every wanted (family, weight) has both latin and latin-ext defs", () => {
    for (const [family, weights] of Object.entries(WANT)) {
      const defs = FONT_FACE_REGISTRY[family];
      expect(defs, `missing family ${family}`).toBeTruthy();
      for (const weight of weights) {
        const subsets = (defs as readonly FontFaceDef[])
          .filter((d) => d.weight === weight)
          .map((d) => d.subset)
          .sort();
        expect(subsets, `${family} ${weight}`).toEqual(["latin", "latin-ext"]);
      }
    }
  });

  test("every def's file key exists in FONT_WOFF2_BASE64", () => {
    for (const defs of Object.values(FONT_FACE_REGISTRY)) {
      for (const def of defs) {
        expect(FONT_WOFF2_BASE64[def.file], def.file).toBeTypeOf("string");
        expect(woff2Base64(def.file), def.file).toBe(FONT_WOFF2_BASE64[def.file]);
      }
    }
  });

  test("latin-ext defs cover the Romanian Ș/Ț range (U+0100-02BA)", () => {
    let latinExtCount = 0;
    for (const defs of Object.values(FONT_FACE_REGISTRY)) {
      for (const def of defs) {
        if (def.subset !== "latin-ext") continue;
        latinExtCount++;
        expect(def.unicodeRange, def.file).toContain("U+0100-02BA");
      }
    }
    expect(latinExtCount).toBeGreaterThan(0);
  });
});

describe("woff2 bytes are valid", () => {
  // woff2 magic number: ASCII "wOF2" = 0x77 0x4F 0x46 0x32.
  const WOFF2_MAGIC = "wOF2";

  // Sample one file per family to keep the test fast while spanning all fonts.
  const samples = Object.values(FONT_FACE_REGISTRY).map((defs) => defs[0]!.file);

  test.each(samples)("%s decodes to woff2 bytes", (file) => {
    const b64 = woff2Base64(file);
    expect(b64, file).toBeTypeOf("string");
    const bytes = Buffer.from(b64 as string, "base64");
    expect(bytes.subarray(0, 4).toString("latin1")).toBe(WOFF2_MAGIC);
  });
});
