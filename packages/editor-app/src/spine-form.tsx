/**
 * Site-spine form: walks the field tree from `fieldsFromSchema(SiteSchema)`
 * and emits one `<input>` / `<select>` per leaf field. The "site spine" is
 * everything outside `pages[].blocks` — block forms are owned by #9-#22 and
 * are intentionally not rendered here (the form generator carves them out
 * upstream).
 */
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";

import type { FieldNode } from "./form-generator.js";
import { getAtPath, setAtPath } from "./get-set-path.js";
import { useTranslator } from "./i18n-context.js";

export interface SpineFormProps {
  readonly fields: FieldNode[];
  readonly site: Site;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
}

export function SpineForm({ fields, site, onPatch }: SpineFormProps): JSX.Element {
  return (
    <form data-testid="spine-form" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <FieldRenderer key={field.path.join(".")} node={field} site={site} onPatch={onPatch} />
      ))}
    </form>
  );
}

interface FieldRendererProps {
  readonly node: FieldNode;
  readonly site: Site;
  readonly onPatch: (path: readonly (string | number)[], value: unknown) => void;
}

function FieldRenderer({ node, site, onPatch }: FieldRendererProps): JSX.Element {
  const t = useTranslator();
  const dottedPath = node.path.join(".");
  const value = getAtPath(site, node.path);

  switch (node.kind) {
    case "object":
      return (
        <fieldset data-field={dottedPath} data-kind="object">
          <legend>{node.name}</legend>
          {node.fields.map((child) => (
            <FieldRenderer key={child.path.join(".")} node={child} site={site} onPatch={onPatch} />
          ))}
        </fieldset>
      );

    case "array":
      // Site-spine arrays — `languages`, `pages`, `org.social` — are
      // structural lists. v1 surfaces them as a read-only summary; the
      // forms that create / reorder / delete entries arrive in their own
      // issues (page CRUD = #25-style work; languages = bilingual UI).
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
      // TODO(T4/T11): mount the registered custom widget. The form-generator
      // emits `"custom"` nodes for both schema-identity dispatch (e.g.,
      // `AssetRefSchema` → asset-picker) and path-keyed dispatch (e.g.,
      // `theme.id` → theme-picker). For now we render nothing so the type
      // checker is satisfied and the existing forms keep working until the
      // widget-mounting follow-up tasks land.
      return <span data-field={dottedPath} data-kind="custom" data-renderer={node.renderer} />;
  }
}

/**
 * Apply a patch produced by the spine form. Pure helper; exported so unit
 * tests can drive it without a Preact render.
 */
export function applyPatch(site: Site, path: readonly (string | number)[], value: unknown): Site {
  const draft = structuredClone(site) as unknown as Record<string, unknown>;
  setAtPath(draft, path, value);
  return draft as unknown as Site;
}
