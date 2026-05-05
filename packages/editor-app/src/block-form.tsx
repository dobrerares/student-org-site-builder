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
 */
import type { JSX } from "preact";
import type { ZodType } from "zod";

import { fieldsFromSchema, type FieldNode } from "./form-generator.js";
import { getAtPath } from "./get-set-path.js";

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
}

export function BlockForm<TData>(props: BlockFormProps<TData>): JSX.Element {
  const fields = fieldsFromSchema(props.schema);
  return (
    <form data-testid="block-form" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <FieldRenderer
          key={field.path.join(".")}
          node={field}
          data={props.data}
          onPatch={props.onPatch}
          onArrayChange={props.onArrayChange}
          newItem={props.newItem}
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
}

function FieldRenderer({
  node,
  data,
  onPatch,
  onArrayChange,
  newItem,
}: FieldRendererProps): JSX.Element {
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
