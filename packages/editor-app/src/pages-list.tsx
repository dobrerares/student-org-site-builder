/** @jsxImportSource react */
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
 * Multi-language additions (#24):
 *   - When the site declares 2+ languages, pages are grouped under a
 *     heading per language with the native language name.
 *   - Each row carries a "missing translation" indicator listing the
 *     languages that don't yet have a counterpart.
 *   - Per-row "Add language version" buttons (one per missing language)
 *     fire `onAddLanguageVersion(index, targetLang)`.
 *
 * Scope guard-rails:
 *   - Slug uniqueness within a language is enforced inline via
 *     `@sosb/schema`'s `checkSlug` plus a duplicate scan.
 *   - The component never deletes the last page in the site (a site without
 *     pages is invalid per the schema).
 */
import type { JSX } from "react";
import { useState } from "react";
import type { Page, Site } from "@sosb/schema";
import { checkSlug } from "@sosb/schema";
import { nativeLanguageName } from "@sosb/renderer";
import { missingTranslationLanguages } from "./pages-ops.js";
import { IconArrowDown, IconArrowUp, IconCopy, IconPlus, IconTrash } from "./icons.js";
import type * as React from "react";
import { Button, Input } from "@sosb/ui";
import { useTranslator } from "./i18n-context.js";

export interface PagesListProps {
  readonly site: Site;
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onAdd: (slug: string) => void;
  readonly onClone: (index: number, slug: string) => void;
  readonly onDelete: (index: number) => void;
  readonly onMove: (index: number, direction: "up" | "down") => void;
  /**
   * Multi-language support (#24): create a counterpart page in the given
   * language. Optional so monolingual editors don't have to wire it up.
   */
  readonly onAddLanguageVersion?: (index: number, targetLang: string) => void;
  /**
   * Free-text filter over menu label and slug (issue #102's Pages
   * destination). Non-matching rows are omitted from the render, but every
   * row keeps the index of its page in `site.pages` — the select, move,
   * clone and delete callbacks all address pages by that index, so filtering
   * the array instead would silently operate on the wrong page.
   */
  readonly query?: string;
  /** Hide the inline "add a page" form — the destination has its own. */
  readonly hideAddForm?: boolean;
  /** Hide the section's own heading — the Pages destination supplies one. */
  readonly hideHeader?: boolean;
}

/**
 * Turn free text ("Despre noi") into a slug candidate ("despre-noi") so
 * non-technical users can type a page name and still get a valid link.
 */
function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PagesList(props: PagesListProps): JSX.Element {
  const { site, activeIndex, onSelect, onAdd, onClone, onDelete, onMove, onAddLanguageVersion } =
    props;
  const t = useTranslator();
  const [newSlug, setNewSlug] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  function attemptAdd(): void {
    const raw = newSlug.trim();
    // Accept either a ready slug ("about") or a human name ("About us").
    const trimmed = checkSlug(raw) === null ? raw : slugify(raw);
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
      setAddError(`A page with the link "${trimmed}" already exists in ${lang}.`);
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

  const isMultiLanguage = site.languages.length >= 2;

  const needle = (props.query ?? "").trim().toLowerCase();
  function matchesQuery(page: Page): boolean {
    if (needle === "") return true;
    return page.navLabel.toLowerCase().includes(needle) || page.slug.toLowerCase().includes(needle);
  }
  const anyMatch = site.pages.some(matchesQuery);

  function renderRow(page: Page, idx: number): JSX.Element {
    const isActive = idx === activeIndex;
    const canDelete = site.pages.length > 1;
    const canMoveUp = idx > 0;
    const canMoveDown = idx < site.pages.length - 1;
    const missing = isMultiLanguage ? missingTranslationLanguages(site, page) : [];
    const confirming = confirmIndex === idx;
    return (
      <li
        key={`${page.lang}:${page.slug}:${idx}`}
        data-testid="pages-list-item"
        data-index={idx}
        data-active={isActive}
        aria-current={isActive ? "true" : undefined}
      >
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-9 flex-col items-start justify-center gap-0 px-2 py-1 text-left whitespace-normal"
          data-action="select"
          data-index={idx}
          title={isActive ? "You are editing this page" : "Edit this page"}
          onClick={() => onSelect(idx)}
        >
          <span data-field="navLabel">{page.navLabel}</span>
          <span data-page-meta>
            <span data-field="slug">/{page.slug}</span>
            {isMultiLanguage ? <span data-field="lang">{page.lang}</span> : null}
            {!page.showInNav ? <span data-page-hidden>{t("pages.meta.hidden")}</span> : null}
          </span>
        </Button>
        <span data-row-actions role="group" aria-label={`Actions for ${page.navLabel}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-action="move-up"
            data-icon-button
            data-index={idx}
            disabled={!canMoveUp}
            onClick={() => onMove(idx, "up")}
            aria-label={`Move ${page.navLabel} up`}
            title="Move up in the menu"
          >
            <IconArrowUp size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-action="move-down"
            data-icon-button
            data-index={idx}
            disabled={!canMoveDown}
            onClick={() => onMove(idx, "down")}
            aria-label={`Move ${page.navLabel} down`}
            title="Move down in the menu"
          >
            <IconArrowDown size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-action="clone"
            data-icon-button
            data-index={idx}
            onClick={() => attemptClone(idx)}
            aria-label={`Duplicate ${page.navLabel}`}
            title="Duplicate this page"
          >
            <IconCopy size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size={confirming ? "sm" : "icon-sm"}
            data-action="delete"
            data-icon-button={confirming ? undefined : true}
            data-tone="danger"
            data-index={idx}
            disabled={!canDelete}
            data-confirming={confirming}
            onClick={() => attemptDelete(idx)}
            onBlur={() => {
              if (confirming) setConfirmIndex(null);
            }}
            aria-label={confirming ? `Confirm delete ${page.navLabel}` : `Delete ${page.navLabel}`}
            title={
              canDelete
                ? confirming
                  ? "Click again to delete this page"
                  : "Delete this page"
                : "A site needs at least one page"
            }
          >
            <IconTrash size={15} />
            {confirming ? <span>Confirm delete</span> : null}
          </Button>
        </span>
        {missing.length > 0 && (
          <span data-testid="missing-translation-indicator" role="status">
            Missing: {missing.map((lng) => nativeLanguageName(lng)).join(", ")}
          </span>
        )}
        {missing.map((lng) => (
          <Button
            key={lng}
            type="button"
            size="sm"
            data-action="add-language-version"
            data-index={idx}
            data-target-lang={lng}
            disabled={onAddLanguageVersion === undefined}
            onClick={() => onAddLanguageVersion?.(idx, lng)}
            aria-label={`Add ${nativeLanguageName(lng)} version of ${page.navLabel}`}
          >
            <IconPlus size={14} />
            <span>Add {nativeLanguageName(lng)} version</span>
          </Button>
        ))}
      </li>
    );
  }

  return (
    <section data-testid="pages-list" aria-label={t("pages.title")}>
      {props.hideHeader === true ? null : (
        <header>
          <div data-section-heading>
            <h3>{t("pages.title")}</h3>
            <p data-section-hint>{t("pages.info")}</p>
          </div>
        </header>
      )}
      {!anyMatch ? (
        <p data-testid="pages-list-no-matches" data-empty-state>
          {t("pages.empty.filtered")}
        </p>
      ) : isMultiLanguage ? (
        <div data-testid="pages-list-grouped">
          {site.languages.map((lang) => {
            const indexed = site.pages
              .map((page, idx) => ({ page, idx }))
              .filter(({ page }) => page.lang === lang && matchesQuery(page));
            if (indexed.length === 0) return null;
            return (
              <section
                key={lang}
                data-testid="pages-list-language-group"
                data-lang={lang}
                aria-label={`Pages in ${nativeLanguageName(lang)}`}
              >
                <h4>{nativeLanguageName(lang)}</h4>
                <ol data-testid="pages-list-items" data-lang={lang}>
                  {indexed.map(({ page, idx }) => renderRow(page, idx))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : (
        <ol data-testid="pages-list-items">
          {site.pages.map((page: Page, idx) => (matchesQuery(page) ? renderRow(page, idx) : null))}
        </ol>
      )}
      {props.hideAddForm === true ? null : (
        <form
          data-testid="pages-list-add"
          onSubmit={(event) => {
            event.preventDefault();
            attemptAdd();
          }}
        >
          <label>
            <span>Add a page</span>
            <Input
              type="text"
              data-testid="pages-list-add-slug"
              value={newSlug}
              onInput={(event: React.FormEvent<HTMLInputElement>) => {
                setNewSlug(event.currentTarget.value);
                if (addError !== null) setAddError(null);
              }}
              placeholder="e.g. Events, About us, Contact"
              autoComplete="off"
            />
          </label>
          <Button type="submit" variant="primary" data-action="add" data-variant="primary">
            Create page
          </Button>
          <p data-form-help>
            {newSlug.trim().length > 0 && checkSlug(newSlug.trim()) !== null
              ? `Link will be /${slugify(newSlug) || "…"}`
              : "You can rename it or change its link later in Page settings."}
          </p>
          {addError !== null && (
            <p data-testid="pages-list-add-error" role="alert">
              {addError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
