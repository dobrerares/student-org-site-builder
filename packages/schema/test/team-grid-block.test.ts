import { describe, expect, test } from "vitest";
import { TeamGridBlockSchema, validateBlock } from "../src/index.js";

describe("teamGrid block schema", () => {
  test("validates a well-formed teamGrid block (ungrouped)", () => {
    const block = {
      id: "blk_team_01",
      type: "teamGrid",
      version: 1,
      data: {
        title: "Echipa noastră",
        intro: "Cei care fac HISTORIPOL să funcționeze.",
        columns: 3,
        people: [
          {
            name: "Ana Popescu",
            role: "Președinte",
          },
          {
            name: "Mihai Ionescu",
            role: "Vicepreședinte",
          },
        ],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a teamGrid with groupBy and full per-person fields", () => {
    const block = {
      id: "blk_team_02",
      type: "teamGrid",
      version: 1,
      data: {
        title: "Conducerea",
        columns: 4,
        groupBy: "department",
        people: [
          {
            name: "Ana Popescu",
            role: "Președinte",
            department: "Conducere",
            bio: "Studentă în anul III, Istorie.",
            photo: {
              hash: "abc123def4567890",
              path: "assets/abc123def4567890.jpg",
              metadataPath: "assets/abc123def4567890.metadata.json",
              mime: "image/jpeg",
              width: 600,
              height: 600,
              alt: "Portret Ana Popescu",
            },
            socials: [
              { platform: "linkedin", url: "https://linkedin.com/in/ana" },
              { platform: "email", url: "mailto:ana@historipol.ro" },
            ],
          },
        ],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a teamGrid with no title and no intro (both optional)", () => {
    const block = {
      id: "blk_team_03",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 2,
        people: [{ name: "A", role: "B" }],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a teamGrid with an invalid columns value", () => {
    const block = {
      id: "blk_team_04",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 5,
        people: [{ name: "A", role: "B" }],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a teamGrid with a person missing name", () => {
    const block = {
      id: "blk_team_05",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [{ role: "Vicepreședinte" }],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a teamGrid with a person missing role", () => {
    const block = {
      id: "blk_team_06",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [{ name: "Ana Popescu" }],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a teamGrid with an empty people array", () => {
    const block = {
      id: "blk_team_07",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [],
      },
    };
    expect(TeamGridBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown extra fields on data and on a person (forward-compat)", () => {
    const block = {
      id: "blk_team_08",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [
          {
            name: "A",
            role: "B",
            futurePersonField: "kept",
          },
        ],
        futureDataField: "kept too",
      },
    };
    const parsed = TeamGridBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // looseObject preserves unknown keys verbatim.
      expect((parsed.data.data as Record<string, unknown>).futureDataField).toBe("kept too");
      const person = parsed.data.data.people[0] as Record<string, unknown>;
      expect(person.futurePersonField).toBe("kept");
    }
  });

  test("validateBlock returns severity-tiered issues for missing name", () => {
    const block = {
      id: "blk_team_09",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [{ role: "no name" }],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock warns when a person photo is missing alt text", () => {
    const block = {
      id: "blk_team_10",
      type: "teamGrid",
      version: 1,
      data: {
        columns: 3,
        people: [
          {
            name: "Ana Popescu",
            role: "Președinte",
            photo: {
              hash: "abc123def4567890",
              path: "assets/abc123def4567890.jpg",
              metadataPath: "assets/abc123def4567890.metadata.json",
              mime: "image/jpeg",
              width: 600,
              height: 600,
              alt: "",
            },
          },
        ],
      },
    };
    const result = validateBlock(block);
    // Missing alt is a warning, not an error.
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.severity).toBe("warning");
    expect(result.warnings[0]!.code).toBe("block.teamGrid.photo.alt.missing");
  });
});
