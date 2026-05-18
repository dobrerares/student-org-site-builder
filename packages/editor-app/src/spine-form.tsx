/**
 * Site-spine form: walks the field tree from `fieldsFromSchema(SiteSchema)`
 * and emits one `<input>` / `<select>` per leaf field. The "site spine" is
 * everything outside `pages[].blocks` — block forms are owned by #9-#22 and
 * are intentionally not rendered here (the form generator carves them out
 * upstream).
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { AssetRefLike, DocumentAssetRef, Site } from "@sosb/schema";

import { expandAltSyncPatches, suggestedAltForAssetPath } from "./alt-sync.js";
import { AdvancedToggle } from "./advanced-toggle.js";
import { AssetPicker } from "./asset-picker.js";
import { DocumentPicker, type DocumentAssetRefLike } from "./document-picker.js";
import type { FieldNode } from "./form-generator.js";
import { getAtPath, setAtPath } from "./get-set-path.js";
import { useTranslator } from "./i18n-context.js";

export interface SpineFormProps {
  readonly fields: FieldNode[];
  readonly site: Site;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
  readonly uploader: (file: File, suggestedAlt?: string) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor?: (ref: AssetRefLike) => string | undefined;
}

export function SpineForm({
  fields,
  site,
  onPatch,
  uploader,
  documentUploader,
  displayUrlFor,
}: SpineFormProps): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  return (
    <form data-testid="spine-form" onSubmit={(event) => event.preventDefault()}>
      <AdvancedToggle value={showAdvanced} onChange={setShowAdvanced} />
      {fields.map((field) => (
        <FieldRenderer
          key={field.path.join(".")}
          node={field}
          site={site}
          onPatch={onPatch}
          uploader={uploader}
          documentUploader={documentUploader}
          displayUrlFor={displayUrlFor}
          showAdvanced={showAdvanced}
        />
      ))}
    </form>
  );
}

interface FieldRendererProps {
  readonly node: FieldNode;
  readonly site: Site;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
  readonly uploader: (file: File, suggestedAlt?: string) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor: ((ref: AssetRefLike) => string | undefined) | undefined;
  readonly showAdvanced: boolean;
}

function FieldRenderer({
  node,
  site,
  onPatch,
  uploader,
  documentUploader,
  displayUrlFor,
  showAdvanced,
}: FieldRendererProps): JSX.Element | null {
  const t = useTranslator();

  if (node.tier === "hidden") {
    return null;
  }
  if (node.tier === "advanced" && !showAdvanced) {
    return null;
  }

  const dottedPath = node.path.join(".");
  const value = getAtPath(site, node.path);

  switch (node.kind) {
    case "object":
      return (
        <fieldset data-field={dottedPath} data-kind="object">
          <legend>{node.name}</legend>
          {node.fields.map((child) => (
            <FieldRenderer
              key={child.path.join(".")}
              node={child}
              site={site}
              onPatch={onPatch}
              uploader={uploader}
              documentUploader={documentUploader}
              displayUrlFor={displayUrlFor}
              showAdvanced={showAdvanced}
            />
          ))}
        </fieldset>
      );

    case "array":
      return (
        <fieldset data-field={dottedPath} data-kind="array">
          <legend>{node.name}</legend>
          <p data-testid="array-summary">
            {Array.isArray(value)
              ? t("form.array.itemCount", { count: value.length })
              : t("form.array.empty")}
          </p>
        </fieldset>
      );

    case "string":
      return (
        <label data-field-label={dottedPath}>
          <span>{node.name}</span>
          <input
            type="text"
            data-field={dottedPath}
            value={typeof value === "string" ? value : ""}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              const next = event.currentTarget.value;
              for (const patch of expandAltSyncPatches(site, node.path, next)) {
                onPatch(patch.path, patch.value);
              }
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
              onPatch(node.path, event.currentTarget.value);
            }}
          >
            {node.optional ? <option value="">{t("form.field.unset")}</option> : null}
            {node.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );

    case "custom":
      if (node.renderer === "asset-picker") {
        const suggestedAlt = suggestedAltForAssetPath(site, node.path);
        return (
          <AssetPicker
            value={value as AssetRefLike | undefined}
            onChange={(next) => {
              for (const patch of expandAltSyncPatches(site, node.path, next)) {
                onPatch(patch.path, patch.value);
              }
            }}
            onClear={
              node.optional
                ? () => {
                    for (const patch of expandAltSyncPatches(site, node.path, undefined)) {
                      onPatch(patch.path, patch.value);
                    }
                  }
                : undefined
            }
            uploader={(file) =>
              uploader(file, suggestedAlt && suggestedAlt.length > 0 ? suggestedAlt : undefined)
            }
            displayUrlFor={displayUrlFor}
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
 * Apply a patch produced by the spine form. Pure helper; exported so unit
 * tests can drive it without a Preact render.
 */
export function applyPatch(site: Site, path: readonly (string | number)[], value: unknown): Site {
  const draft = structuredClone(site) as unknown as Record<string, unknown>;
  for (const patch of expandAltSyncPatches(site, path, value)) {
    setAtPath(draft, patch.path, patch.value);
  }
  return draft as unknown as Site;
}
