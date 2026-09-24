/** @jsxImportSource react */
/**
 * BlockInspector — the editing form for one Block, whatever contains it.
 *
 * This body existed twice, once in the editor shell for a Page's Blocks and
 * once in the Article workspace for an Article's, and the two had already
 * drifted: only one of them routed `customHTML` correctly, and the Article
 * copy passed a different set of props to `ArticleListInspector`. Since issue
 * #102 gives Pages and Articles the same workspace, the form they open is the
 * same component, and the container only has to say how a patch reaches the
 * snapshot.
 *
 * Three block types are hand-routed rather than schema-generated:
 *
 *  - `articleList` — a generated form would render `articleIds` and `tags` as
 *    arrays of raw ids, which ADR 0044 puts off-limits outright.
 *  - `customHTML` — it carries its own sanitisation affordance and danger
 *    copy (ADR 0038).
 *  - anything unknown — surfaces a soft hint rather than crashing, so a
 *    project saved by a newer build still opens.
 */
import type { JSX } from "react";
import type {
  AssetRefLike,
  BlockEnvelope,
  CustomHtmlBlock,
  DocumentAssetRef,
  Site,
} from "@sosb/schema";
import { KnownBlockSchemas } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import type { ZodType } from "zod";

import { ArticleListInspector } from "./article-list-inspector.js";
import { BlockForm } from "./block-form.js";
import { BlockVariantControl } from "./block-variant-control.js";
import { CustomHtmlBlockForm } from "./custom-html-form.js";
import { defaultArrayItemForBlock } from "./block-array-defaults.js";
import { BLOCK_FIELD_METADATA } from "./field-metadata.js";
import type { ApplySiteChange } from "./article-settings-form.js";
import { useTranslator } from "./i18n-context.js";
import type { RichTextFieldContext } from "./rich-text/rich-text-field.js";

export interface BlockInspectorProps {
  readonly site: Site;
  readonly block: BlockEnvelope;
  readonly theme?: ThemeBundle | undefined;
  /** Language of the Page or Article holding this Block. */
  readonly containerLang: string;
  /** Set when an Article holds it, so its own list can exclude it. */
  readonly containerArticleId?: string | undefined;
  readonly onSetVariant: (variant: string | undefined) => void;
  readonly onPatchData: (subpath: readonly (string | number)[], value: unknown) => void;
  readonly onArrayChangeData: (
    subpath: readonly (string | number)[],
    next: readonly unknown[],
  ) => void;
  /** Replace the whole `data` object — the customHTML form edits it wholesale. */
  readonly onReplaceData: (data: unknown) => void;
  /** Durable Site changes made from inside the form, e.g. creating a tag. */
  readonly onApplySite: ApplySiteChange;
  readonly uploader: (file: File) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;
  /**
   * Site-aware plumbing for the Rich-text Block's editor (ADR 0048). Without
   * it the field renders as an inert marker, so the container must supply it
   * for any Block list that can hold prose — which is every one.
   */
  readonly richText?: RichTextFieldContext | undefined;
  /**
   * Patch `data` *without* a Site-history entry. The rich-text editor's
   * contract (issue #100) is one history entry per editing visit, not one per
   * keystroke, while every change still reaches preview and export at once.
   */
  readonly onPatchDataQuiet?:
    | ((subpath: readonly (string | number)[], value: unknown) => void)
    | undefined;
}

export function BlockInspector(props: BlockInspectorProps): JSX.Element {
  const t = useTranslator();
  const { block } = props;
  const envelope = KnownBlockSchemas[block.type as keyof typeof KnownBlockSchemas];
  // The envelope is `{ id, type, version, data: <DataSchema> }`. The generic
  // form generator wants the data schema directly so it walks only the
  // user-editable payload.
  const dataSchema =
    envelope !== undefined
      ? ((envelope as unknown as { shape: { data: ZodType } }).shape.data ?? envelope)
      : undefined;

  return (
    <>
      <BlockVariantControl
        block={block}
        theme={props.theme}
        onChange={(variant) => props.onSetVariant(variant)}
      />

      {block.type === "articleList" ? (
        <ArticleListInspector
          site={props.site}
          value={block.data}
          containerLang={props.containerLang}
          {...(props.containerArticleId === undefined
            ? {}
            : { containerArticleId: props.containerArticleId })}
          showTextFields
          onApply={props.onApplySite}
          onPatch={(patch) => {
            for (const [key, value] of Object.entries(patch)) {
              props.onPatchData([key], value);
            }
          }}
        />
      ) : block.type === "customHTML" ? (
        <CustomHtmlBlockForm
          block={block as CustomHtmlBlock}
          onChange={(nextBlock) => props.onReplaceData(nextBlock.data)}
        />
      ) : dataSchema !== undefined ? (
        <BlockForm
          schema={dataSchema}
          data={block.data}
          onPatch={props.onPatchData}
          onArrayChange={props.onArrayChangeData}
          uploader={props.uploader}
          documentUploader={props.documentUploader}
          {...(props.displayUrlFor === undefined ? {} : { displayUrlFor: props.displayUrlFor })}
          richText={props.richText}
          onPatchQuiet={props.onPatchDataQuiet}
          newItem={(subpath) => defaultArrayItemForBlock(block.type, subpath)}
          overrides={BLOCK_FIELD_METADATA[block.type as keyof typeof BLOCK_FIELD_METADATA] ?? []}
        />
      ) : (
        <p data-testid="inspector-unknown-type" data-empty-state>
          {t("builder.inspector.unknownType", { type: block.type })}
        </p>
      )}
    </>
  );
}
