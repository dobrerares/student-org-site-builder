/**
 * Block form generator.
 *
 * The site-spine form (`SpineForm`) walks `SiteSchema` minus the `blocks`
 * array. Block forms - one per known block type - live in their own issues
 * (#9-#22). This module hosts the cross-cutting `BlockForm` that knows how
 * to render a single block's `data` payload from its Zod schema, including
 * the array-item add/remove/reorder controls that several blocks
 * (`valueList`, `activitiesList`, `teamGrid`, `imageGallery`, ...) need.
 *
 * The component is intentionally typed against an arbitrary data shape -
 * it walks the schema via `fieldsFromSchema` and renders generically so
 * future blocks plug in without bespoke editor code.
 *
 * Custom widgets via schema-identity dispatch (ADR 0043 / ADR 0044):
 *
 * The block form passes a `schemaRenderers` map into `fieldsFromSchema` so
 * that the walker emits a single `"custom"` node — rather than recursing
 * into structural leaves — for shapes whose user-facing UX is a dedicated
 * widget. Today the canonical entries are:
 *  - `AssetRefSchema → "asset-picker"`: every image-bearing block schema
 *    (image-gallery, partner-logos) embeds the SAME `AssetRefSchema`
 *    instance, so the registry hits via reference equality and the
 *    renderer below mounts `<AssetPicker>` at the `images.[k].asset` /
 *    `partners.[k].logo` slot — replacing the hash/path/mime/width/
 *    height fieldset that the default walker would otherwise emit.
 *  - `CtaBannerAssetRefSchema → "asset-picker"`,
 *    `PersonPhotoSchema → "asset-picker"`,
 *    `ActivityImageRefSchema → "asset-picker"`: three reference-distinct
 *    but structurally compatible AssetRef-shaped schemas live alongside
 *    the canonical `AssetRefSchema` (see asset-ref.ts's "Distinct shapes"
 *    docblock for why they aren't consolidated — each tunes `alt`/`mime`
 *    strictness to its block's tolerance for stale data). Each needs its
 *    own registry entry because reference equality is the dispatch key.
 *    The asset pipeline's `uploadAsset` result satisfies all three
 *    (non-empty `alt` from `file.name`, non-negative integer dimensions,
 *    populated `mime`), so a single shared `<AssetPicker>` renderer
 *    serves every entry at runtime.
 *  - `DocumentAssetRefSchema → "document-picker"`: the documentDownloads
 *    block carries this shape at `files.[k].asset`; the walker mounts
 *    `<DocumentPicker>` there instead of a hash/path/mime/byteSize
 *    fieldset (the failure mode ADR 0044 prohibits).
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { ZodType } from "zod";
import type { AssetRefLike, DocumentAssetRef } from "@sosb/schema";
import {
  ActivityImageRefSchema,
  AssetRefSchema,
  CtaBannerAssetRefSchema,
  DocumentAssetRefSchema,
  PersonPhotoSchema,
} from "@sosb/schema";

import { AdvancedToggle } from "./advanced-toggle.js";
import type { FieldOverride } from "./field-metadata.js";
import { fieldsFromSchema, type FieldNode } from "./form-generator.js";
import { getAtPath } from "./get-set-path.js";
import { AssetPicker } from "./asset-picker.js";
import { DocumentPicker, type DocumentAssetRefLike } from "./document-picker.js";

/**
 * Schema-identity registry consumed by the form-generator walk.
 *
 * Module scope is correct here: the map is stable across renders (each
 * entry is a `ZodType` re-export from `@sosb/schema`), so recreating it
 * inside the component would only churn the reference and not the
 * outcome. Reference equality on the value schemas is the load-bearing
 * property — every image-bearing block schema imports the SAME
 * `AssetRefSchema` object, and the document-downloads block carries the
 * SAME `DocumentAssetRefSchema`, so these entries dispatch across every
 * embedding without a second walker pass.
 *
 * Four AssetRef-shaped schemas dispatch to `"asset-picker"`:
 *   - `AssetRefSchema` — image-gallery, partner-logos (canonical).
 *   - `CtaBannerAssetRefSchema` — ctaBanner.backgroundImage.
 *   - `PersonPhotoSchema` — teamGrid.people[].photo.
 *   - `ActivityImageRefSchema` — activitiesList.items[].image.
 *
 * Each is a reference-distinct ZodObject (see
 * `packages/schema/src/blocks/asset-ref.ts` for the "intentionally not
 * consolidated" rationale — divergent `alt`/`mime` rules per block).
 * They share the same UX (upload + preview + alt-edit), so the renderer
 * arm below (`node.renderer === "asset-picker"`) is shared.
 */
const MEDIA_PICKER_RENDERERS: ReadonlyMap<ZodType, string> = new Map<ZodType, string>([
  [AssetRefSchema, "asset-picker"],
  [CtaBannerAssetRefSchema, "asset-picker"],
  [PersonPhotoSchema, "asset-picker"],
  [ActivityImageRefSchema, "asset-picker"],
  [DocumentAssetRefSchema, "document-picker"],
]);

export interface BlockFormProps<TData> {
  /** The block's data schema (e.g. `ValueListDataSchema`). */
  readonly schema: ZodType;
  /** Current data snapshot - source of truth for input values. */
  readonly data: TData;
  /** Patch a leaf field at the given path with a new value. */
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
  /** Replace an entire array (used by add/remove/reorder). */
  readonly onArrayChange: (path: readonly (string | number)[], next: unknown[]) => void;
  /**
   * A factory that returns the default object for a new item in an array.
   * Optional - omitting it defaults to pushing `{}`, which is fine for
   * loose-object schemas because validation only kicks in at parse time.
   */
  readonly newItem?: (arrayPath: readonly (string | number)[]) => unknown;
  /**
   * Uploader injected into any mounted `<AssetPicker>` widgets. The
   * production wiring (editor-app.tsx) closes over a real VFS + image
   * processor; tests inject a `vi.fn()` mock. Required — the asset
   * picker has no library-reuse path (CONTEXT.md), so a missing
   * uploader would render a permanently-broken widget instead of
   * failing loud at mount time.
   */
  readonly uploader: (file: File) => Promise<AssetRefLike>;
  /**
   * Uploader injected into any mounted `<DocumentPicker>` widgets. Same
   * required-prop posture as `uploader`: the document picker has no
   * library-reuse path either, so a missing uploader would render a
   * permanently-broken widget. Tests that don't mount the
   * `documentDownloads` block can pass a rejecting stub — the picker
   * only fires the uploader on user interaction.
   */
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  /**
   * Path-keyed field-metadata overrides for this block type. The walker
   * attaches `label` and `tier` to the resulting `FieldNode`s; the
   * renderer reads `tier` to honour the "Show advanced" toggle (ADR
   * 0043). Optional — a block type with no metadata renders every
   * field at the default tier.
   *
   * Production callers pass `BLOCK_FIELD_METADATA[blockType]`; tests
   * can inject ad-hoc overrides to exercise tier hiding.
   */
  readonly overrides?: readonly FieldOverride[];
}

export function BlockForm<TData>(props: BlockFormProps<TData>): JSX.Element {
  // Per-form local "Show advanced" toggle state (ADR 0043). No
  // persistence; remounting the form starts hidden again.
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const fields = fieldsFromSchema(props.schema, {
    schemaRenderers: MEDIA_PICKER_RENDERERS,
    overrides: props.overrides ?? [],
  });
  return (
    <form data-testid="block-form" onSubmit={(event) => event.preventDefault()}>
      <AdvancedToggle value={showAdvanced} onChange={setShowAdvanced} />
      {fields.map((field) => (
        <FieldRenderer
          key={field.path.join(".")}
          node={field}
          data={props.data}
          onPatch={props.onPatch}
          onArrayChange={props.onArrayChange}
          newItem={props.newItem}
          uploader={props.uploader}
          documentUploader={props.documentUploader}
          showAdvanced={showAdvanced}
        />
      ))}
    </form>
  );
}

interface FieldRendererProps {
  readonly node: FieldNode;
  readonly data: unknown;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
  readonly onArrayChange: (path: readonly (string | number)[], next: unknown[]) => void;
  // `undefined` is explicit so we can forward an optional prop under
  // `exactOptionalPropertyTypes: true` without creating a missing-key shape.
  readonly newItem: ((arrayPath: readonly (string | number)[]) => unknown) | undefined;
  readonly uploader: (file: File) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  /**
   * Current state of the parent form's "Show advanced" toggle. `true`
   * reveals `tier === "advanced"` fields; `false` hides them. Fields
   * with `tier === "hidden"` are dropped regardless (ADR 0043).
   */
  readonly showAdvanced: boolean;
}

function FieldRenderer({
  node,
  data,
  onPatch,
  onArrayChange,
  newItem,
  uploader,
  documentUploader,
  showAdvanced,
}: FieldRendererProps): JSX.Element | null {
  // Tier-based visibility filter (ADR 0043). Hidden fields are NEVER
  // rendered; advanced fields require the toggle to be on. Default-tier
  // fields fall through to the normal kind switch below.
  if (node.tier === "hidden") {
    return null;
  }
  if (node.tier === "advanced" && !showAdvanced) {
    return null;
  }

  const dottedPath = node.path.join(".");
  const value = getAtPath(data, node.path);

  switch (node.kind) {
    case "object":
      return (
        <fieldset data-field={dottedPath} data-kind="object">
          <legend>{node.name}</legend>
          {node.fields.map((child) => (
            <FieldRenderer
              key={child.path.join(".")}
              node={child}
              data={data}
              onPatch={onPatch}
              onArrayChange={onArrayChange}
              newItem={newItem}
              uploader={uploader}
              documentUploader={documentUploader}
              showAdvanced={showAdvanced}
            />
          ))}
        </fieldset>
      );

    case "array": {
      // Array items: render one fieldset per item with add/remove/reorder.
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      const elementNode = node.element;

      function move(from: number, to: number): void {
        if (to < 0 || to >= items.length) return;
        const next = items.slice();
        const [picked] = next.splice(from, 1);
        next.splice(to, 0, picked);
        onArrayChange(node.path, next);
      }
      function remove(at: number): void {
        const next = items.slice();
        next.splice(at, 1);
        onArrayChange(node.path, next);
      }
      function add(): void {
        const next = items.slice();
        const factoryItem = newItem?.(node.path);
        next.push(factoryItem ?? {});
        onArrayChange(node.path, next);
      }

      return (
        <fieldset data-field={dottedPath} data-kind="array">
          <legend>{node.name}</legend>
          <ol data-testid={`${dottedPath}__items`}>
            {items.map((_, idx) => {
              const itemPath: (string | number)[] = [...node.path, idx];
              // Build a child node for this item by rebasing the element node's
              // path under the indexed slot. The element node's path uses the
              // synthetic `[]` segment - rewrite it to the concrete index.
              const childNode = rebaseElement(elementNode, itemPath);
              return (
                <li
                  key={`${dottedPath}__item__${idx}`}
                  data-testid={`${dottedPath}__item`}
                  data-index={idx}
                >
                  <FieldRenderer
                    node={childNode}
                    data={data}
                    onPatch={onPatch}
                    onArrayChange={onArrayChange}
                    newItem={newItem}
                    uploader={uploader}
                    documentUploader={documentUploader}
                    showAdvanced={showAdvanced}
                  />
                  <div class="block-form__item-controls">
                    <button
                      type="button"
                      data-action="move-up"
                      disabled={idx === 0}
                      onClick={() => move(idx, idx - 1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      data-action="move-down"
                      disabled={idx === items.length - 1}
                      onClick={() => move(idx, idx + 1)}
                    >
                      Move down
                    </button>
                    <button type="button" data-action="remove" onClick={() => remove(idx)}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" data-action="add" onClick={add}>
            Add item
          </button>
        </fieldset>
      );
    }

    case "string":
      return (
        <label data-field-label={dottedPath}>
          <span>{node.name}</span>
          <input
            type="text"
            data-field={dottedPath}
            value={typeof value === "string" ? value : ""}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              onPatch(node.path, event.currentTarget.value);
            }}
          />
        </label>
      );

    case "number":
      return (
        <label data-field-label={dottedPath}>
          <span>{node.name}</span>
          <input
            type="number"
            data-field={dottedPath}
            value={typeof value === "number" ? String(value) : ""}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              const raw = event.currentTarget.value;
              if (raw === "") {
                onPatch(node.path, undefined);
              } else {
                const num = Number(raw);
                if (!Number.isNaN(num)) onPatch(node.path, num);
              }
            }}
          />
        </label>
      );

    case "boolean":
      return (
        <label data-field-label={dottedPath}>
          <input
            type="checkbox"
            data-field={dottedPath}
            checked={value === true}
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              onPatch(node.path, event.currentTarget.checked);
            }}
          />
          <span>{node.name}</span>
        </label>
      );

    case "enum":
      return (
        <label data-field-label={dottedPath}>
          <span>{node.name}</span>
          <select
            data-field={dottedPath}
            value={typeof value === "string" ? value : ""}
            onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
              const raw = event.currentTarget.value;
              onPatch(node.path, raw === "" ? undefined : raw);
            }}
          >
            {node.optional ? <option value="">(unset)</option> : null}
            {node.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );

    case "custom":
      // Dispatch by renderer name. The form-generator emits `"custom"`
      // nodes for both schema-identity dispatch (e.g. `AssetRefSchema` →
      // "asset-picker", `DocumentAssetRefSchema` → "document-picker")
      // and path-keyed dispatch (e.g. `theme.id` → "theme-picker").
      // BlockForm only owns block-data widgets — the theme-picker is
      // mounted by ThemeForm — so the media pickers (asset + document)
      // are the only branches wired here today. Unknown renderer names
      // fall back to a debug span so a future schema-identity
      // registration that forgets to add a renderer arm is loud-in-DOM
      // rather than silent.
      if (node.renderer === "asset-picker") {
        return (
          <AssetPicker
            value={value as AssetRefLike | undefined}
            onChange={(next) => onPatch(node.path, next)}
            uploader={uploader}
          />
        );
      }
      if (node.renderer === "document-picker") {
        return (
          <DocumentPicker
            value={value as DocumentAssetRefLike | undefined}
            onChange={(next) => onPatch(node.path, next)}
            uploader={documentUploader}
          />
        );
      }
      return <span data-field={dottedPath} data-kind="custom" data-renderer={node.renderer} />;
  }
}

/**
 * Rewrite the synthetic `[]` segment inside an element-template node so its
 * path points at a concrete array index. The traversal recurses through
 * nested objects/arrays so deeply-nested item subtrees still resolve.
 */
function rebaseElement(node: FieldNode, basePath: (string | number)[]): FieldNode {
  function rebase(n: FieldNode, prefix: (string | number)[]): FieldNode {
    const newPath = prefix;
    switch (n.kind) {
      case "object":
        return {
          ...n,
          path: newPath,
          fields: n.fields.map((c) => rebase(c, [...newPath, c.name])),
        };
      case "array":
        return { ...n, path: newPath, element: rebase(n.element, [...newPath, "[]"]) };
      default:
        return { ...n, path: newPath };
    }
  }
  return rebase(node, basePath);
}
