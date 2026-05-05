/**
 * Pages list panel — the editor's multi-page management UI.
 *
 * Responsibilities (per #23 AC):
 *   - List every page in the site, with `navLabel` + `(slug, lang)` shown.
 *   - Highlight the page currently being edited (the page surfaced in
 *     `<SpineForm>` and the preview iframe).
 *   - Add a new page: prompts for a slug, defaults to a hero block.
 *   - Clone an existing page: same blocks, new slug suffix.
 *   - Delete a page (with confirmation).
 *   - Reorder pages (move up / down). The home page convention
 *     (defaultLanguage + navOrder=0) is preserved by re-numbering navOrder
 *     after every reorder.
 *
 * Scope guard-rails:
 *   - Slug uniqueness within a language is enforced inline via
 *     `@sosb/schema`'s `checkSlug` plus a duplicate scan.
 *   - The component never deletes the last page in the site (a site without
 *     pages is invalid per the schema).
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { Page, Site } from "@sosb/schema";
import { checkSlug } from "@sosb/schema";

export interface PagesListProps {
  readonly site: Site;
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onAdd: (slug: string) => void;
  readonly onClone: (index: number, slug: string) => void;
  readonly onDelete: (index: number) => void;
  readonly onMove: (index: number, direction: "up" | "down") => void;
}

export function PagesList(props: PagesListProps): JSX.Element {
  const { site, activeIndex, onSelect, onAdd, onClone, onDelete, onMove } = props;
  const [newSlug, setNewSlug] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  function attemptAdd(): void {
    const trimmed = newSlug.trim();
    const failure = checkSlug(trimmed);
    if (failure !== null) {
      setAddError(failure.message);
      return;
    }
    // The new page inherits the default language; uniqueness is checked
    // against pages of that language.
    const lang = site.defaultLanguage;
    const taken = site.pages.some((p) => p.lang === lang && p.slug === trimmed);
    if (taken) {
      setAddError(`A page with slug "${trimmed}" already exists in ${lang}.`);
      return;
    }
    setAddError(null);
    setNewSlug("");
    onAdd(trimmed);
  }

  function attemptClone(index: number): void {
    const source = site.pages[index];
    if (source === undefined) return;
    // Generate a unique slug suffix within the source's language.
    let candidate = `${source.slug}-copy`;
    let counter = 2;
    while (site.pages.some((p) => p.lang === source.lang && p.slug === candidate)) {
      candidate = `${source.slug}-copy-${counter}`;
      counter += 1;
    }
    onClone(index, candidate);
  }

  function attemptDelete(index: number): void {
    if (site.pages.length <= 1) return;
    if (confirmIndex === index) {
      onDelete(index);
      setConfirmIndex(null);
    } else {
      setConfirmIndex(index);
    }
  }

  return (
    <section data-testid="pages-list" aria-label="Pages">
      <h3>Pages</h3>
      <ol data-testid="pages-list-items">
        {site.pages.map((page: Page, idx) => {
          const isActive = idx === activeIndex;
          const canDelete = site.pages.length > 1;
          const canMoveUp = idx > 0;
          const canMoveDown = idx < site.pages.length - 1;
          return (
            <li
              key={`${page.lang}:${page.slug}:${idx}`}
              data-testid="pages-list-item"
              data-index={idx}
              data-active={isActive}
            >
              <button
                type="button"
                data-action="select"
                data-index={idx}
                onClick={() => onSelect(idx)}
              >
                <span data-field="navLabel">{page.navLabel}</span>
                <span data-field="slug">/{page.slug}</span>
                <span data-field="lang">[{page.lang}]</span>
              </button>
              <button
                type="button"
                data-action="move-up"
                data-index={idx}
                disabled={!canMoveUp}
                onClick={() => onMove(idx, "up")}
                aria-label={`Move ${page.navLabel} up`}
              >
                ↑
              </button>
              <button
                type="button"
                data-action="move-down"
                data-index={idx}
                disabled={!canMoveDown}
                onClick={() => onMove(idx, "down")}
                aria-label={`Move ${page.navLabel} down`}
              >
                ↓
              </button>
              <button
                type="button"
                data-action="clone"
                data-index={idx}
                onClick={() => attemptClone(idx)}
              >
                Clone
              </button>
              <button
                type="button"
                data-action="delete"
                data-index={idx}
                disabled={!canDelete}
                data-confirming={confirmIndex === idx}
                onClick={() => attemptDelete(idx)}
              >
                {confirmIndex === idx ? "Confirm delete" : "Delete"}
              </button>
            </li>
          );
        })}
      </ol>
      <form
        data-testid="pages-list-add"
        onSubmit={(event) => {
          event.preventDefault();
          attemptAdd();
        }}
      >
        <label>
          <span>New page slug</span>
          <input
            type="text"
            data-testid="pages-list-add-slug"
            value={newSlug}
            onInput={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              setNewSlug(event.currentTarget.value);
              if (addError !== null) setAddError(null);
            }}
            placeholder="despre"
          />
        </label>
        <button type="submit" data-action="add">
          Add page
        </button>
        {addError !== null && (
          <p data-testid="pages-list-add-error" role="alert">
            {addError}
          </p>
        )}
      </form>
    </section>
  );
}
