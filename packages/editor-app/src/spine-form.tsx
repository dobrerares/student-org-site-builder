/**
 * Site-spine form: walks the field tree from `fieldsFromSchema(SiteSchema)`
 * and emits one `<input>` / `<select>` per leaf field. The "site spine" is
 * everything outside `pages[].blocks` — block forms are owned by #9-#22 and
 * are intentionally not rendered here (the form generator carves them out
 * upstream).
 *
 * Arrays (e.g. `org.social`) render as editable item lists with add /
 * remove / reorder controls — the same affordance `BlockForm` gives block
 * arrays — so nothing in the spine is read-only-by-accident.
 *
 * Two site-level custom widgets live here (dispatched by `renderer` name
 * from `SPINE_FIELD_METADATA`):
 *   - `language-list`   → checkbox list for `languages`
 *   - `language-select` → `<select>` over the declared languages for
 *                         `defaultLanguage`
 * Both exist so a non-technical author never has to type a language code.
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { AssetRefLike, DocumentAssetRef, Site } from "@sosb/schema";
import { nativeLanguageName } from "@sosb/renderer";

import { expandAltSyncPatches, suggestedAltForAssetPath } from "./alt-sync.js";
import { AdvancedToggle } from "./advanced-toggle.js";
import { AssetPicker } from "./asset-picker.js";
import { FieldHint } from "./field-hint.js";
import { DocumentPicker, type DocumentAssetRefLike } from "./document-picker.js";
import { fieldLabel, optionLabel } from "./field-labels.js";
import type { FieldNode } from "./form-generator.js";
import { getAtPath, setAtPath } from "./get-set-path.js";
import { useTranslator } from "./i18n-context.js";
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "./icons.js";
import { rebaseElement } from "./rebase-element.js";
import { isLongTextField } from "./block-form.js";

export interface SpineFormProps {
  readonly fields: FieldNode[];
  readonly site: Site;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
  readonly uploader: (file: File, suggestedAlt?: string) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor?: (ref: AssetRefLike) => string | undefined;
}

/**
 * Languages offered in the language checklist. Any language already
 * declared on the site but missing here is appended at runtime so an
 * imported site never loses a language it uses.
 */
const LANGUAGE_CHOICES: readonly string[] = ["ro", "en", "fr", "de", "es", "it", "hu"];

/** Platform suggestions for `org.social[].platform` (free text with hints). */
const SOCIAL_PLATFORM_SUGGESTIONS: readonly string[] = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
  "github",
  "discord",
  "whatsapp",
  "telegram",
  "website",
];

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
      <AdvancedToggle value={showAdvanced} onChange={setShowAdvanced} />
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
  const label = fieldLabel(node);

  const childProps = { site, onPatch, uploader, documentUploader, displayUrlFor, showAdvanced };

  switch (node.kind) {
    case "object":
      return (
        <fieldset data-field={dottedPath} data-kind="object">
          <legend>{label}</legend>
          {node.fields.map((child) => (
            <FieldRenderer key={child.path.join(".")} node={child} {...childProps} />
          ))}
        </fieldset>
      );

    case "array": {
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      const elementNode = node.element;

      function commit(next: unknown[]): void {
        onPatch(node.path, next);
      }
      function move(from: number, to: number): void {
        if (to < 0 || to >= items.length) return;
        const next = items.slice();
        const [picked] = next.splice(from, 1);
        next.splice(to, 0, picked);
        commit(next);
      }
      function remove(at: number): void {
        const next = items.slice();
        next.splice(at, 1);
        commit(next);
      }
      function add(): void {
        commit([...items, emptyValueFor(elementNode)]);
      }

      return (
        <fieldset data-field={dottedPath} data-kind="array">
          <legend>{label}</legend>
          <FieldHint hint={node.hint} />
          <ol data-testid={`${dottedPath}__items`}>
            {items.map((_, idx) => {
              const itemPath: (string | number)[] = [...node.path, idx];
              const childNode = rebaseElement(elementNode, itemPath);
              return (
                <li
                  key={`${dottedPath}__item__${idx}`}
                  data-testid={`${dottedPath}__item`}
                  data-index={idx}
                >
                  <FieldRenderer node={childNode} {...childProps} />
                  <div
                    class="block-form__item-controls"
                    role="group"
                    aria-label={`${label} item ${idx + 1} actions`}
                  >
                    <span class="block-form__item-index" aria-hidden="true">
                      {idx + 1} of {items.length}
                    </span>
                    <button
                      type="button"
                      data-action="move-up"
                      data-icon-button
                      aria-label="Move item up"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => move(idx, idx - 1)}
                    >
                      <IconArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      data-action="move-down"
                      data-icon-button
                      aria-label="Move item down"
                      title="Move down"
                      disabled={idx === items.length - 1}
                      onClick={() => move(idx, idx + 1)}
                    >
                      <IconArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      data-action="remove"
                      data-tone="danger"
                      aria-label="Remove item"
                      title="Remove this item"
                      onClick={() => remove(idx)}
                    >
                      <IconTrash size={15} />
                      <span>Remove</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {items.length === 0 ? (
            <p data-array-empty data-testid="array-summary">
              {t("form.array.empty")}
            </p>
          ) : null}
          <button type="button" data-action="add" data-variant="secondary" onClick={add}>
            <IconPlus size={15} />
            <span>Add {singular(label)}</span>
          </button>
        </fieldset>
      );
    }

    case "string": {
      const multiline = isLongTextField(node.name);
      const suggestions = node.name === "platform" ? SOCIAL_PLATFORM_SUGGESTIONS : undefined;
      const listId = suggestions !== undefined ? `${dottedPath}__suggestions` : undefined;
      return (
        <label data-field-label={dottedPath} data-multiline={multiline}>
          <span>{label}</span>
          {multiline ? (
            <textarea
              data-field={dottedPath}
              rows={3}
              value={typeof value === "string" ? value : ""}
              onInput={(event: JSX.TargetedEvent<HTMLTextAreaElement>) => {
                const next = event.currentTarget.value;
                for (const patch of expandAltSyncPatches(site, node.path, next)) {
                  onPatch(patch.path, patch.value);
                }
              }}
            />
          ) : (
            <input
              type={inputTypeFor(node.name)}
              data-field={dottedPath}
              list={listId}
              value={typeof value === "string" ? value : ""}
              onInput={(event: JSX.TargetedEvent<HTMLInputElement>) => {
                const next = event.currentTarget.value;
                for (const patch of expandAltSyncPatches(site, node.path, next)) {
                  onPatch(patch.path, patch.value);
                }
              }}
            />
          )}
          {suggestions !== undefined && listId !== undefined ? (
            <datalist id={listId}>
              {suggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null}
          <FieldHint hint={node.hint} />
        </label>
      );
    }

    case "number":
      return (
        <label data-field-label={dottedPath}>
          <span>{label}</span>
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
          <FieldHint hint={node.hint} />
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
          <span>{label}</span>
          <FieldHint hint={node.hint} />
        </label>
      );

    case "enum":
      return (
        <label data-field-label={dottedPath}>
          <span>{label}</span>
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
                {optionLabel(option)}
              </option>
            ))}
          </select>
          <FieldHint hint={node.hint} />
        </label>
      );

    case "custom":
      if (node.renderer === "asset-picker") {
        const suggestedAlt = suggestedAltForAssetPath(site, node.path);
        return (
          <div data-field-label={dottedPath} data-picker-slot>
            <span data-picker-label>{label}</span>
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
            <FieldHint hint={node.hint} />
          </div>
        );
      }
      if (node.renderer === "document-picker") {
        return (
          <div data-field-label={dottedPath} data-picker-slot>
            <span data-picker-label>{label}</span>
            <DocumentPicker
              value={value as DocumentAssetRefLike | undefined}
              onChange={(next) => onPatch(node.path, next)}
              uploader={documentUploader}
            />
          </div>
        );
      }
      if (node.renderer === "language-select") {
        const current = typeof value === "string" ? value : "";
        const options = site.languages.includes(current)
          ? site.languages
          : [...site.languages, current].filter((code) => code.length > 0);
        return (
          <label data-field-label={dottedPath}>
            <span>{label}</span>
            <select
              data-field={dottedPath}
              value={current}
              onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
                onPatch(node.path, event.currentTarget.value);
              }}
            >
              {options.map((code) => (
                <option key={code} value={code}>
                  {languageOptionLabel(code)}
                </option>
              ))}
            </select>
            <FieldHint
              hint={node.hint ?? "Visitors see this language first. It needs at least one page."}
            />
          </label>
        );
      }
      if (node.renderer === "language-list") {
        const declared = Array.isArray(value) ? (value as string[]) : [];
        const choices = [
          ...LANGUAGE_CHOICES,
          ...declared.filter((code) => !LANGUAGE_CHOICES.includes(code)),
        ];
        function toggle(code: string, checked: boolean): void {
          const next = checked
            ? [...declared.filter((c) => c !== code), code]
            : declared.filter((c) => c !== code);
          if (next.length === 0) return;
          onPatch(node.path, next);
        }
        return (
          <fieldset data-field={dottedPath} data-kind="language-list">
            <legend>{label}</legend>
            <FieldHint
              hint={
                node.hint ??
                "Tick every language your site should offer. Each language gets its own pages."
              }
            />
            <div data-choice-grid>
              {choices.map((code) => {
                const checked = declared.includes(code);
                const isDefault = code === site.defaultLanguage;
                const hasPages = site.pages.some((page) => page.lang === code);
                const locked = checked && (isDefault || hasPages);
                return (
                  <label key={code} data-choice data-checked={checked}>
                    <input
                      type="checkbox"
                      data-field={`${dottedPath}.${code}`}
                      checked={checked}
                      disabled={locked}
                      title={
                        locked
                          ? isDefault
                            ? "This is the main language."
                            : "Delete this language's pages first."
                          : undefined
                      }
                      onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
                        toggle(code, event.currentTarget.checked);
                      }}
                    />
                    <span>{languageOptionLabel(code)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      }
      return <span data-field={dottedPath} data-kind="custom" data-renderer={node.renderer} />;
  }
}

function languageOptionLabel(code: string): string {
  const native = nativeLanguageName(code);
  return native === code ? code.toUpperCase() : `${native} (${code.toUpperCase()})`;
}

/** "Social links" → "social link"; "Files" → "file". Best-effort, English only. */
function singular(label: string): string {
  const lower = label.toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

function inputTypeFor(name: string): string {
  switch (name) {
    case "email":
      return "email";
    case "url":
    case "href":
      return "url";
    case "phone":
      return "tel";
    default:
      return "text";
  }
}

/** A sensible blank value for a brand-new array item of the given shape. */
function emptyValueFor(node: FieldNode): unknown {
  switch (node.kind) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const child of node.fields) {
        if (child.kind === "string" && !child.optional) out[child.name] = "";
        if (child.kind === "boolean" && !child.optional) out[child.name] = false;
      }
      return out;
    }
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    default:
      return {};
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
