import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { parseSite } from "../src/index.js";

describe("preserve-unknown-keys round-trip identity", () => {
  test("unknown top-level fields survive read-write-read", () => {
    const input = {
      ...structuredClone(historipol),
      // Field this version of the editor doesn't know about.
      futureField: { kind: "experimental", value: 42 },
    };
    const parsed = parseSite(input);
    // A parser that strips unknown keys would drop this; passthrough preserves it.
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped).toEqual(input);
  });

  test("unknown fields inside org survive round-trip", () => {
    const input = structuredClone(historipol) as unknown as {
      org: Record<string, unknown>;
    };
    input.org.experimentalCustomField = "preserved";
    const parsed = parseSite(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect((roundTripped as typeof input).org.experimentalCustomField).toBe("preserved");
  });

  test("unknown fields inside theme.tokens survive round-trip", () => {
    const input = structuredClone(historipol) as unknown as {
      theme: { tokens: Record<string, unknown> };
    };
    input.theme.tokens.shadowDepth = "soft"; // hypothetical future token
    const parsed = parseSite(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect((roundTripped as typeof input).theme.tokens.shadowDepth).toBe("soft");
  });

  test("unknown block types survive round-trip without losing data", () => {
    const input = structuredClone(historipol) as unknown as {
      pages: { blocks: unknown[] }[];
    };
    input.pages[0]!.blocks.push({
      id: "blk_unknown_1",
      type: "futureBlockType", // not registered in this editor
      version: 7,
      data: { customPayload: "must survive", nestedData: { a: [1, 2, 3] } },
    });
    const parsed = parseSite(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped).toEqual(input);
  });

  test("unknown fields inside a known block's data survive round-trip", () => {
    const input = structuredClone(historipol) as unknown as {
      pages: { blocks: { type: string; data: Record<string, unknown> }[] }[];
    };
    // Find the hero block on page 0 and add an unknown field.
    const hero = input.pages[0]!.blocks[0]!;
    hero.data.experimentalAlignment = "center";
    const parsed = parseSite(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect((roundTripped as typeof input).pages[0]!.blocks[0]!.data.experimentalAlignment).toBe(
      "center",
    );
  });

  test("HISTORIPOL fixture is exactly preserved on round-trip", () => {
    // The strongest form of the identity: byte-for-byte equality after JSON
    // serialise of the parsed result.
    const parsed = parseSite(historipol);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped).toEqual(historipol);
  });
});
