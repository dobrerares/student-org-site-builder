/** @jsxImportSource react */
/**
 * Block design-variant control (ADR 0046).
 *
 * A Theme may offer several named designs for the same Block type — a hero as
 * a spotlight or a split, partners as a grid or a quiet band. The author picks
 * between them here, in the Block Inspector, without changing the Block's type
 * and without touching its content.
 *
 * The control renders only when the *active* Theme offers variants for this
 * Block type. That is why it is not a permanent fixture of the inspector: an
 * empty "Design: (none available)" row on every Block under every built-in
 * Theme would be noise for the overwhelming majority of editing sessions.
 */
import type { JSX } from "react";
import type { BlockEnvelope } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { variantsForBlockType } from "@sosb/renderer";

import { NamedValueSelect } from "./named-value-select.js";

export interface BlockVariantControlProps {
  readonly block: BlockEnvelope;
  readonly theme: ThemeBundle | undefined;
  readonly onChange: (variant: string | undefined) => void;
}

export function BlockVariantControl(props: BlockVariantControlProps): JSX.Element | null {
  if (props.theme === undefined) return null;
  const variants = variantsForBlockType(props.theme, props.block.type);
  if (variants.length === 0) return null;

  return (
    <div data-testid="block-variant-control" data-block-variant-control>
      <NamedValueSelect
        label="Design"
        hint={`Layouts this look offers for this section. “${props.theme.name}” only.`}
        options={variants.map((variant) => ({
          value: variant.id,
          label:
            variant.description === undefined
              ? variant.label
              : `${variant.label} — ${variant.description}`,
        }))}
        nameKey="variant"
        value={props.block.variant}
        onChange={props.onChange}
      />
    </div>
  );
}
