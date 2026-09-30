import type { BlockEnvelope } from "@sosb/schema";

const alignments = new Set(["left", "center", "right", "justify"]);
const headings = "h1,h2,h3,h4,h5,h6,summary,.value-list__label";
const paragraphs =
  "p,li,blockquote,figcaption,address,dt,dd,.contact-card__channel-body,.site-footer__contact-body";

/** Author-selected alignment wins over theme styling, without changing layout.
 * Scope to the rendered document, and escape ids as CSS code points so an
 * imported id can never terminate a selector or the containing style element.
 */
export function blockTextAlignmentCss(blocks: readonly BlockEnvelope[]): string {
  return blocks
    .map((block) => {
      // Rich-text has its own block defaults and per-paragraph document choices.
      if (block.type === "richText") return "";
      const data = block.data as Record<string, unknown>;
      const id = Array.from(block.id, (c) => `\\${c.codePointAt(0)!.toString(16)} `).join("");
      return (
        [
          ["titleAlign", headings],
          ["paragraphAlign", paragraphs],
        ] as const
      )
        .map(([key, targets]) => {
          const align = data[key];
          if (typeof align !== "string" || !alignments.has(align)) return "";
          return `[data-block-id="${id}"] :is(${targets}){text-align:${align}!important;text-align-last:auto;}`;
        })
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");
}
