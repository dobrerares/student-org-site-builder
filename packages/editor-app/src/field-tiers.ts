/**
 * Field-tier partitioning for progressive disclosure.
 *
 * Forms used to gate `tier: "advanced"` fields in place: flipping the
 * "expert options" checkbox made extra inputs appear wherever they
 * happened to sit in the schema walk, sometimes far from the toggle,
 * and an object whose children were all advanced still rendered its
 * empty card. That was confusing for the non-technical audience.
 *
 * `partitionByTier` splits a field tree into two trees instead:
 *
 *   - `basic`    — everything a first-time author needs. Rendered inline.
 *   - `advanced` — the rarely-touched extras, rendered together inside a
 *                  collapsible "More options" section at the end of the
 *                  form, so they always appear right where the disclosure
 *                  button is.
 *
 * Objects are split recursively: an object with both kinds of children
 * appears in both trees (each copy holding only its own children); an
 * object whose visible children are all advanced moves wholesale into
 * the advanced tree; an object left with no visible children is dropped.
 * `tier: "hidden"` nodes never appear in either tree.
 *
 * Arrays are treated as leaves — an array node lives entirely on one
 * side, decided by its own tier.
 */
import { fieldLabel } from "./field-labels.js";
import type { FieldNode } from "./form-generator.js";

export interface TierPartition {
  readonly basic: FieldNode[];
  readonly advanced: FieldNode[];
}

export function partitionByTier(fields: readonly FieldNode[]): TierPartition {
  const basic: FieldNode[] = [];
  const advanced: FieldNode[] = [];

  for (const node of fields) {
    if (node.tier === "hidden") continue;

    if (node.kind === "object") {
      if (node.tier === "advanced") {
        const inner = partitionByTier(node.fields);
        const visible = [...inner.basic, ...inner.advanced];
        if (visible.length > 0) advanced.push({ ...node, fields: visible });
        continue;
      }
      const inner = partitionByTier(node.fields);
      if (inner.basic.length > 0) basic.push({ ...node, fields: inner.basic });
      if (inner.advanced.length > 0) advanced.push({ ...node, fields: inner.advanced });
      continue;
    }

    if (node.tier === "advanced") {
      advanced.push(node);
    } else {
      basic.push(node);
    }
  }

  return { basic, advanced };
}

/**
 * Human-readable names of what a "More options" section contains, used
 * for the one-line summary under the disclosure button. A labelled
 * object with several children (e.g. "Search engines") is listed by
 * that label; an object holding a single stray field (e.g. the
 * "Organization" copy that only carries "Founded (year)") is listed by
 * the field itself, since the group name alone would say nothing.
 */
export function tierSummaryLabels(fields: readonly FieldNode[]): string[] {
  const out: string[] = [];
  for (const node of fields) {
    if (node.kind === "object" && (node.label === undefined || node.fields.length < 2)) {
      out.push(...tierSummaryLabels(node.fields));
    } else {
      out.push(fieldLabel(node));
    }
  }
  return out;
}

/** "A, B and C" / "A, B, C and 2 more". Best-effort, English only. */
export function summarizeLabels(labels: readonly string[], max = 4): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0] ?? "";
  if (labels.length <= max) {
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  const shown = labels.slice(0, max - 1);
  return `${shown.join(", ")} and ${labels.length - shown.length} more`;
}
