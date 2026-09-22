import { describe, expect, test } from "vitest";

import { issuePathLabel, labelForName, optionLabel } from "../src/field-labels.js";

describe("field-labels", () => {
  test("turns common internal field names into user-facing labels", () => {
    expect(labelForName("defaultLanguage")).toBe("Main language");
    expect(labelForName("navLabel")).toBe("Menu label");
    expect(labelForName("slug")).toBe("Page link name");
  });

  test("falls back to humanised labels for unknown camel-case names", () => {
    expect(labelForName("backgroundImage")).toBe("Background image");
    expect(labelForName("customFieldName")).toBe("Custom field name");
  });

  test("labels common select values without changing their stored values", () => {
    expect(optionLabel("en")).toBe("English");
    expect(optionLabel("grid")).toBe("Grid");
    expect(optionLabel("student-projects")).toBe("Student projects");
  });

  test("formats validation paths as friendly locations", () => {
    expect(issuePathLabel(["pages", 1, "slug"])).toBe("Pages > page 2 > Page link name");
    expect(issuePathLabel(["pages", 0, "blocks", 2, "data", "backgroundAlt"])).toBe(
      "Pages > page 1 > Page sections > section 3 > Data > Image description",
    );
  });

  test("article issue paths read as articles, not as anonymous items", () => {
    expect(issuePathLabel(["articles", 0, "slug"])).toBe(
      "Articles > article 1 > Article link name",
    );
    expect(issuePathLabel(["articles", 2, "coverAlt"])).toBe(
      "Articles > article 3 > Cover image description",
    );
    expect(issuePathLabel(["articles", 0, "relatedArticles", "articleIds", 1])).toBe(
      "Articles > article 1 > Related articles > Chosen articles > item 2",
    );
  });

  test("a page slug keeps its own wording", () => {
    expect(issuePathLabel(["pages", 0, "slug"])).toBe("Pages > page 1 > Page link name");
  });
});
