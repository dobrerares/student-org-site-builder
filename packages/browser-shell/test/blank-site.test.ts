import { describe, expect, test } from "vitest";
import { validate } from "@sosb/schema";

import { BLANK_SITE } from "../src/blank-site.js";

describe("BLANK_SITE", () => {
  test("is a valid low-warning starter for Start from scratch", () => {
    const result = validate(BLANK_SITE);

    expect(result.errors).toEqual([]);
    expect(BLANK_SITE.pages).toHaveLength(1);
    expect(BLANK_SITE.pages[0]?.blocks).toHaveLength(1);
    expect(BLANK_SITE.pages[0]?.blocks[0]?.type).toBe("hero");
  });
});
