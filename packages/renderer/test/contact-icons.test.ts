import { describe, expect, test } from "vitest";
import { iconNameForPlatform } from "../src/blocks/contact-icons.js";

/**
 * Unit coverage for the contactCard channel-icon mapping.
 *
 * iconNameForPlatform is the single point that decides which glyph a social
 * channel gets. Its binding behaviour: known platforms (and their aliases,
 * case-insensitively) map to brand glyphs; ANY unknown platform falls back to
 * the generic "link" glyph rather than dropping the row or rendering a blank
 * chip. These paths are otherwise only exercised by two fixtures that use
 * instagram/facebook, so the aliases + fallback would regress silently.
 */
describe("iconNameForPlatform", () => {
  test.each([
    ["instagram", "instagram"],
    ["IG", "instagram"],
    ["facebook", "facebook"],
    ["fb", "facebook"],
    ["Meta", "facebook"],
    ["linkedin", "linkedin"],
    ["LinkedIn", "linkedin"],
    ["twitter", "twitter"],
    ["x", "twitter"],
    ["X", "twitter"],
    ["youtube", "youtube"],
    ["yt", "youtube"],
  ])("maps %s -> %s (case-insensitive, with aliases)", (platform, expected) => {
    expect(iconNameForPlatform(platform)).toBe(expected);
  });

  test.each([["mastodon"], ["tiktok"], ["website"], ["github"], [""], ["   "]])(
    "falls back to the generic link glyph for unknown platform %j",
    (platform) => {
      expect(iconNameForPlatform(platform)).toBe("link");
    },
  );
});
