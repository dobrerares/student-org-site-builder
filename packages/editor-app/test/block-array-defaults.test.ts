import { describe, expect, test } from "vitest";

import { defaultArrayItemForBlock } from "../src/block-array-defaults.js";

describe("defaultArrayItemForBlock", () => {
  test("creates a valid editable team social row for nested people socials", () => {
    expect(defaultArrayItemForBlock("teamGrid", ["people", 0, "socials"])).toEqual({
      platform: "website",
      url: "/",
    });
    expect(defaultArrayItemForBlock("siteFooter", ["socials"])).toEqual({
      platform: "website",
      url: "/",
    });
  });

  test("creates required fields for common block arrays", () => {
    expect(defaultArrayItemForBlock("teamGrid", ["people"])).toEqual({
      name: "Member name",
      role: "Role",
    });
    expect(defaultArrayItemForBlock("faq", ["items"])).toEqual({
      question: "Question?",
      answer: "Answer.",
    });
    expect(defaultArrayItemForBlock("valueList", ["items"])).toEqual({ label: "New value" });
  });

  test("creates an event row with a stable schema-valid shape", () => {
    const item = defaultArrayItemForBlock("eventList", ["events"]) as {
      id?: unknown;
      title?: unknown;
      startsAt?: unknown;
    };

    expect(typeof item.id).toBe("string");
    expect(item.title).toBe("New event");
    expect(item.startsAt).toBe("2099-01-01T18:00:00+02:00");
  });

  test("falls back to an empty row for media-picker arrays", () => {
    expect(defaultArrayItemForBlock("imageGallery", ["images"])).toEqual({});
    expect(defaultArrayItemForBlock("documentDownloads", ["files"])).toEqual({});
  });
});
