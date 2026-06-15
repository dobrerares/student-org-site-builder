import { describe, expect, test } from "vitest";
import {
  hexToRgbTriplet,
  relativeLuminance,
  contrastRatio,
  onColorFor,
} from "../src/color-math.js";

describe("hexToRgbTriplet", () => {
  test("parses 6-digit hex into an 'r, g, b' triplet", () => {
    expect(hexToRgbTriplet("#1f3a5f")).toBe("31, 58, 95");
    expect(hexToRgbTriplet("#FFFFFF")).toBe("255, 255, 255");
  });

  test("parses 3-digit shorthand hex", () => {
    expect(hexToRgbTriplet("#fff")).toBe("255, 255, 255");
    expect(hexToRgbTriplet("#1a2")).toBe("17, 170, 34");
  });

  test("returns undefined for non-hex input", () => {
    expect(hexToRgbTriplet("rebeccapurple")).toBeUndefined();
    expect(hexToRgbTriplet("rgb(1,2,3)")).toBeUndefined();
    expect(hexToRgbTriplet("#12")).toBeUndefined();
  });
});

describe("relativeLuminance", () => {
  test("white is ~1 and black is ~0", () => {
    expect(relativeLuminance("#ffffff")!).toBeCloseTo(1, 3);
    expect(relativeLuminance("#000000")!).toBeCloseTo(0, 3);
  });

  test("returns undefined for non-hex input", () => {
    expect(relativeLuminance("teal")).toBeUndefined();
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")!).toBeCloseTo(21, 0);
  });
});

describe("onColorFor", () => {
  test("picks dark ink on a light/gold accent (white would fail AA)", () => {
    expect(onColorFor("#b8893e")).toBe("#16181c");
    expect(onColorFor("#c08a3e")).toBe("#16181c");
  });

  test("picks white on a saturated/dark accent", () => {
    expect(onColorFor("#cb2b2b")).toBe("#ffffff");
    expect(onColorFor("#2563eb")).toBe("#ffffff");
    expect(onColorFor("#1f3a5f")).toBe("#ffffff");
    expect(onColorFor("#1a1a1a")).toBe("#ffffff");
  });

  test("falls back to white for unparseable colors", () => {
    expect(onColorFor("currentColor")).toBe("#ffffff");
  });
});
