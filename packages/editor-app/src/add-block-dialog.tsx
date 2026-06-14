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
 * Accessibility: `role="dialog"` + `aria-modal="true"` + an accessible
 * label, focus on the search box on open, every entry is a real
 * `<button type="button">` so keyboard activation works.
 */
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { buildBlockCatalog, type BlockCatalogEntry } from "./block-catalog.js";

const CATEGORY_LABELS: Record<string, string> = {
  mandatory: "Must-have",
  optional: "Extra sections",
  advanced: "For experts",
};

export interface AddBlockDialogProps {
  /** When `false`, the dialog renders nothing. */
  readonly open: boolean;
  /** Called with the schema-registry key when the user picks an entry. */
  readonly onPick: (type: string) => void;
  /** Called when the user dismisses the dialog (Escape, backdrop, etc.). */
  readonly onClose: () => void;
}

export function AddBlockDialog(props: AddBlockDialogProps): JSX.Element | null {
  const catalog = useMemo(() => buildBlockCatalog(), []);
  const [query, setQuery] = useState<string>("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Focus the search input on open so a keyboard user can type immediately.
  useEffect(() => {
    if (props.open) {
      searchRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [props.open]);

  if (!props.open) return null;

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
    <div
      data-testid="add-block-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Add a page section"
      tabIndex={-1}
      onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Escape") {
          event.stopPropagation();
          props.onClose();
        }
      }}
    >
      <header>
        <h2>Add a page section</h2>
        <button
          type="button"
          data-testid="add-block-close"
          aria-label="Close add-section dialog"
          onClick={props.onClose}
        >
          Close
        </button>
      </header>

      <label data-testid="add-block-search-label">
        <span>Search</span>
        <input
          ref={searchRef}
          type="search"
          data-testid="add-block-search"
          value={query}
          placeholder="Search sections..."
          onInput={(event: JSX.TargetedEvent<HTMLInputElement>): void => {
            setQuery(event.currentTarget.value);
          }}
        />
      </label>

      {visibleGroups.length === 0 ? (
        <p data-testid="add-block-empty">No sections match "{query}".</p>
      ) : (
        <ul data-testid="add-block-groups">
          {visibleGroups.map((group) => (
            <li key={group.category} data-testid="add-block-group" data-category={group.category}>
              <h3>{CATEGORY_LABELS[group.category] ?? group.category}</h3>
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.type}>
                    <button
                      type="button"
                      data-testid="add-block-entry"
                      data-block-type={entry.type}
                      onClick={() => props.onPick(entry.type)}
                    >
                      <span data-testid="add-block-entry-label">{entry.label}</span>
                      <span data-testid="add-block-entry-description">{entry.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
