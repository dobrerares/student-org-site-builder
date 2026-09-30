import { expect, test } from "vitest";
import { JSDOM } from "jsdom";
import { FaqDataSchema, type BlockEnvelope, type Site } from "@sosb/schema";
import { renderSite } from "../src/index.js";
import { blockTextAlignmentCss } from "../src/text-alignment.js";
import fixture from "./fixtures/activities-list-cards.json" with { type: "json" };

test("Q&A alignment is validated, persisted and emitted for the selected page", () => {
  const site = structuredClone(fixture) as unknown as Site;
  const data = FaqDataSchema.parse({
    title: "Questions",
    items: [{ question: "Why?", answer: "First paragraph.\n\nSecond paragraph." }],
    paragraphAlign: "justify",
    titleAlign: "right",
  });
  const block: BlockEnvelope = { id: "faq-test", type: "faq", version: 1, data };
  site.pages[0]!.blocks = [block];
  const saved = JSON.parse(JSON.stringify(site)) as Site;
  const doc = new JSDOM(renderSite(saved, "stub")).window.document;
  const rules = [...doc.styleSheets].flatMap((s) => [...s.cssRules]);
  const matching = (selector: string) =>
    rules.filter(
      (r) =>
        "selectorText" in r &&
        doc.querySelector(selector)!.matches((r as CSSStyleRule).selectorText),
    );
  expect(
    matching(".faq__answer p").some(
      (r) => (r as CSSStyleRule).style.getPropertyValue("text-align") === "justify",
    ),
  ).toBe(true);
  expect(
    matching("summary").some(
      (r) => (r as CSSStyleRule).style.getPropertyValue("text-align") === "right",
    ),
  ).toBe(true);
  expect(FaqDataSchema.safeParse({ ...data, paragraphAlign: "bogus" }).success).toBe(false);
});

test("unset and unrecognized alignment leave theme defaults untouched", () => {
  expect(
    blockTextAlignmentCss([
      { id: "x", type: "faq", version: 1, data: { paragraphAlign: "url(evil)" } },
    ]),
  ).toBe("");
  expect(blockTextAlignmentCss([{ id: "x", type: "faq", version: 1, data: {} }])).toBe("");
});

test("untrusted block ids cannot escape the stylesheet", () => {
  const css = blockTextAlignmentCss([
    {
      id: '</style><script>alert(1)</script>"',
      type: "faq",
      version: 1,
      data: { paragraphAlign: "justify" },
    },
  ]);
  expect(css).not.toContain("<");
  expect(css).toContain("text-align:justify");
});
