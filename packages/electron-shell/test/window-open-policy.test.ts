import { describe, expect, test } from "vitest";
import { decideWindowOpen, isEditorNavigation } from "../src/window-open-policy.js";

/**
 * Isolation of the editor window (ADR 0046 / ADR 0056): nothing the preview
 * opens may become an Electron window carrying the preload bridge, and the
 * editor never navigates away from itself.
 */
describe("decideWindowOpen", () => {
  test("never allows a child window", () => {
    for (const url of ["https://example.org/", "http://example.org", "file:///etc/passwd", "x"]) {
      expect(decideWindowOpen(url).action).toBe("deny");
    }
  });

  test("hands http and https URLs to the system browser", () => {
    expect(decideWindowOpen("https://partner.example/page?x=1#top").openExternal).toBe(
      "https://partner.example/page?x=1#top",
    );
    expect(decideWindowOpen("http://partner.example").openExternal).toBe("http://partner.example/");
  });

  test("drops anything that is not a web URL", () => {
    for (const url of [
      "file:///Users/me/site.zip",
      "javascript:alert(1)",
      "mailto:someone@example.org",
      "sosb-custom://run",
      "not a url",
      "",
    ]) {
      expect(decideWindowOpen(url).openExternal).toBeNull();
    }
  });
});

describe("isEditorNavigation", () => {
  test("the editor document itself, with any fragment or query, is allowed", () => {
    const editor = "file:///opt/sosb/renderer/index.html";
    expect(isEditorNavigation(editor, editor)).toBe(true);
    expect(isEditorNavigation(`${editor}#/pages`, editor)).toBe(true);
    expect(isEditorNavigation(`${editor}?reload=1`, editor)).toBe(true);
    const dev = "http://localhost:5173/";
    expect(isEditorNavigation("http://localhost:5173/?x", dev)).toBe(true);
  });

  test("anything else is refused", () => {
    const editor = "file:///opt/sosb/renderer/index.html";
    expect(isEditorNavigation("file:///opt/sosb/renderer/other.html", editor)).toBe(false);
    expect(isEditorNavigation("https://example.org/", editor)).toBe(false);
    expect(isEditorNavigation("http://localhost:5173/about/", "http://localhost:5173/")).toBe(
      false,
    );
    expect(isEditorNavigation("garbage", editor)).toBe(false);
  });
});
