import { describe, expect, test } from "vitest";

import { partitionByTier, summarizeLabels, tierSummaryLabels } from "../src/field-tiers.js";
import type { FieldNode } from "../src/form-generator.js";

function leaf(name: string, tier?: "advanced" | "hidden", label?: string): FieldNode {
  const node: FieldNode = { kind: "string", name, path: [name], optional: false };
  if (tier !== undefined) node.tier = tier;
  if (label !== undefined) node.label = label;
  return node;
}

function object(name: string, fields: FieldNode[], extra: Partial<FieldNode> = {}): FieldNode {
  return { kind: "object", name, path: [name], optional: false, fields, ...extra } as FieldNode;
}

describe("partitionByTier", () => {
  test("splits leaves by tier and drops hidden ones", () => {
    const { basic, advanced } = partitionByTier([
      leaf("name"),
      leaf("slug", "advanced"),
      leaf("navOrder", "hidden"),
    ]);
    expect(basic.map((n) => n.name)).toEqual(["name"]);
    expect(advanced.map((n) => n.name)).toEqual(["slug"]);
  });

  test("an object with only advanced children moves wholesale to advanced", () => {
    const seo = object("seo", [leaf("title", "advanced"), leaf("description", "advanced")]);
    const { basic, advanced } = partitionByTier([leaf("navLabel"), seo]);
    expect(basic.map((n) => n.name)).toEqual(["navLabel"]);
    expect(advanced.map((n) => n.name)).toEqual(["seo"]);
    expect(advanced[0]!.kind === "object" && advanced[0]!.fields.length).toBe(2);
  });

  test("a mixed object appears on both sides with only its own children", () => {
    const org = object("org", [leaf("name"), leaf("foundedYear", "advanced")]);
    const { basic, advanced } = partitionByTier([org]);
    expect(basic[0]!.kind === "object" && basic[0]!.fields.map((n) => n.name)).toEqual(["name"]);
    expect(advanced[0]!.kind === "object" && advanced[0]!.fields.map((n) => n.name)).toEqual([
      "foundedYear",
    ]);
  });

  test("an object left with nothing visible is dropped from both sides", () => {
    const internal = object("internal", [leaf("a", "hidden")]);
    const { basic, advanced } = partitionByTier([internal]);
    expect(basic).toEqual([]);
    expect(advanced).toEqual([]);
  });

  test("an advanced object keeps all of its visible children together", () => {
    const map = object("mapEmbed", [leaf("enabled"), leaf("zoom", "advanced")], {
      tier: "advanced",
    });
    const { basic, advanced } = partitionByTier([map]);
    expect(basic).toEqual([]);
    expect(advanced[0]!.kind === "object" && advanced[0]!.fields.map((n) => n.name)).toEqual([
      "enabled",
      "zoom",
    ]);
  });
});

describe("tierSummaryLabels / summarizeLabels", () => {
  test("lists leaves by label and labelled objects by their own label", () => {
    const seo = object("seo", [leaf("title", "advanced"), leaf("description", "advanced")], {
      label: "Search engines",
    });
    const labels = tierSummaryLabels([leaf("slug", "advanced", "Page link name"), seo]);
    expect(labels).toEqual(["Page link name", "Search engines"]);
  });

  test("unlabelled objects are flattened to their children", () => {
    const wrapper = object("wrapper", [leaf("zoom", "advanced", "Map zoom")]);
    expect(tierSummaryLabels([wrapper])).toEqual(["Map zoom"]);
  });

  test("a labelled object with a single field is listed by that field", () => {
    const org = object("org", [leaf("foundedYear", "advanced", "Founded (year)")], {
      label: "Organization",
    });
    expect(tierSummaryLabels([org])).toEqual(["Founded (year)"]);
  });

  test("summarizeLabels joins naturally and truncates long lists", () => {
    expect(summarizeLabels([])).toBe("");
    expect(summarizeLabels(["A"])).toBe("A");
    expect(summarizeLabels(["A", "B"])).toBe("A and B");
    expect(summarizeLabels(["A", "B", "C"])).toBe("A, B and C");
    expect(summarizeLabels(["A", "B", "C", "D", "E", "F"])).toBe("A, B, C and 3 more");
  });
});
