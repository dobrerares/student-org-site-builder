/** @jsxImportSource react */
/**
 * Add Block dialog — categorised, searchable picker over the schema
 * registry.
 *
 * Owned by issue #27. Per the AC:
 * - Lists every known block type (dynamically from
 *   `@sosb/schema`'s `KnownBlockSchemas`).
 * - Groups entries by category (mandatory / optional / advanced).
 * - One-line description per entry.
 * - Search filter narrows by label or description.
 * - Escape closes; click on an entry picks it.
 *
 * Accessibility: the overlay is `@sosb/ui`'s Base UI dialog via
 * `<EditorDialog>`, so focus is trapped inside while open and returns to
 * whatever opened it on close. `role="dialog"` + `aria-modal="true"` + an
 * accessible label come from the primitive; the search box takes initial
 * focus so a keyboard user can type immediately; every entry is a real
 * `<button type="button">` so keyboard activation works. A backdrop sits
 * behind the dialog; clicking it dismisses, matching the Escape key.
 */
import type { JSX } from "react";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildBlockCatalog, type BlockCatalogEntry } from "./block-catalog.js";
import { EditorDialog } from "./editor-dialog.js";
import { IconClose } from "./icons.js";
import { Button, Input } from "@sosb/ui";

const CATEGORY_LABELS: Record<string, string> = {
  mandatory: "Essentials",
  optional: "More sections",
  advanced: "For experts",
};

const CATEGORY_HINTS: Record<string, string> = {
  mandatory: "Most pages need these.",
  optional: "Pick what fits your page.",
  advanced: "Only if someone technical is helping.",
};

export interface AddBlockDialogProps {
  /** When `false`, the dialog renders nothing. */
  readonly open: boolean;
  /** Called with the schema-registry key when the user picks an entry. */
  readonly onPick: (type: string) => void;
  /** Called when the user dismisses the dialog (Escape, backdrop, etc.). */
  readonly onClose: () => void;
  /**
   * Block types to hide. The Articles workspace passes the types issue #97
   * does not allow inside an Article's main content.
   */
  readonly excludeTypes?: readonly string[] | undefined;
}

export function AddBlockDialog(props: AddBlockDialogProps): JSX.Element {
  const excludeKey = (props.excludeTypes ?? []).join(",");
  const catalog = useMemo(
    () => buildBlockCatalog({ exclude: excludeKey === "" ? [] : excludeKey.split(",") }),
    [excludeKey],
  );
  const [query, setQuery] = useState<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Reset the filter when the dialog closes, so reopening starts clean.
  // Initial focus is Base UI's job now — see `initialFocus` below.
  useEffect(() => {
    if (!props.open) setQuery("");
  }, [props.open]);

  const trimmed = query.trim().toLowerCase();
  function matches(entry: BlockCatalogEntry): boolean {
    if (trimmed.length === 0) return true;
    return (
      entry.label.toLowerCase().includes(trimmed) ||
      entry.description.toLowerCase().includes(trimmed) ||
      entry.type.toLowerCase().includes(trimmed)
    );
  }

  const visibleGroups = catalog.groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter(matches),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <EditorDialog
      open={props.open}
      onClose={props.onClose}
      testId="add-block-dialog"
      label="Add a page section"
      initialFocus={searchRef}
    >
      <>
        <header>
          <div>
            <h2>Add a page section</h2>
            <p data-dialog-lead>
              Pick a section. It lands at the bottom of the page; you can move it after.
            </p>
          </div>
          <Button
            type="button"
            data-testid="add-block-close"
            data-icon-button
            aria-label="Close add-section dialog"
            title="Close"
            onClick={props.onClose}
          >
            <IconClose size={18} />
          </Button>
        </header>

        <label data-testid="add-block-search-label">
          <span>Search</span>
          <Input
            ref={searchRef}
            type="search"
            data-testid="add-block-search"
            value={query}
            placeholder="Search sections, e.g. team, gallery, contact"
            onInput={(event: React.FormEvent<HTMLInputElement>): void => {
              setQuery(event.currentTarget.value);
            }}
          />
        </label>

        {visibleGroups.length === 0 ? (
          <p data-testid="add-block-empty">No sections match “{query}”.</p>
        ) : (
          <ul data-testid="add-block-groups">
            {visibleGroups.map((group) => (
              <li key={group.category} data-testid="add-block-group" data-category={group.category}>
                <h3>
                  <span>{CATEGORY_LABELS[group.category] ?? group.category}</span>
                  <small>{CATEGORY_HINTS[group.category] ?? ""}</small>
                </h3>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.type}>
                      <Button
                        type="button"
                        data-testid="add-block-entry"
                        data-block-type={entry.type}
                        onClick={() => props.onPick(entry.type)}
                      >
                        <span data-testid="add-block-entry-label">{entry.label}</span>
                        <span data-testid="add-block-entry-description">{entry.description}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </>
    </EditorDialog>
  );
}
