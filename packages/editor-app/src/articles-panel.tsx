/** @jsxImportSource react */
/**
 * ArticlesPanel — the Articles destination: a searchable, filterable list.
 *
 * Issue #102's second round pins the shape: title, language, publication state
 * and date per row, with language, state and tag filters, Create Article, and
 * Manage tags reachable from here.
 *
 * Built as a self-contained component because the navigation redesign will
 * re-home it. It owns only its own transient UI state (search text, filters,
 * which dialog is open); everything durable goes through `onApply` into the
 * editor's undoable snapshot.
 */
import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";
import type { Site } from "@sosb/schema";
import { ARTICLE_STATES } from "@sosb/schema";
import { Button, Input, Label, NativeSelect } from "@sosb/ui";
import { EditorDialog } from "./editor-dialog.js";
import { IconPlus, IconTrash } from "./icons.js";
import { TagManager } from "./tag-manager.js";
import type { ApplySiteChange } from "./article-settings-form.js";
import {
  EMPTY_ARTICLE_FILTERS,
  createArticle,
  deleteArticle,
  filterArticles,
  type ArticleFilters,
} from "./articles-ops.js";
import { useTranslator } from "./i18n-context.js";

export interface ArticlesPanelProps {
  readonly site: Site;
  readonly onApply: ApplySiteChange;
  /** Open an Article for editing. */
  readonly onSelect: (articleId: string) => void;
  /** Content language a new Article is created in. */
  readonly contentLanguage: string;
  /**
   * Today's date as `YYYY-MM-DD`. Injected rather than read from the clock so
   * tests and the golden e2e run are not date-dependent.
   */
  readonly today: string;
  /** Id of the Article currently open, for the selected-row marker. */
  readonly activeArticleId?: string | undefined;
}

export function ArticlesPanel(props: ArticlesPanelProps): JSX.Element {
  const t = useTranslator();
  const [filters, setFilters] = useState<ArticleFilters>(EMPTY_ARTICLE_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => filterArticles(props.site, filters), [props.site, filters]);
  const total = (props.site.articles ?? []).length;
  const tags = props.site.tags ?? [];
  const deletingArticle =
    pendingDelete === null ? undefined : (props.site.articles ?? [])[pendingDelete];

  function patchFilters(patch: Partial<ArticleFilters>): void {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function handleCreate(): void {
    const title = newTitle.trim();
    if (title.length === 0) return;
    let createdId = "";
    props.onApply((site) => {
      const result = createArticle(site, {
        title,
        lang: props.contentLanguage,
        today: props.today,
      });
      createdId = result.articleId;
      return result.site;
    });
    setNewTitle("");
    setCreateOpen(false);
    if (createdId !== "") props.onSelect(createdId);
  }

  return (
    <section
      className="articles-panel"
      data-testid="articles-panel"
      aria-label={t("articles.panel.title")}
    >
      <div className="articles-panel__actions">
        <Button type="button" onClick={() => setCreateOpen(true)} data-testid="articles-create">
          <IconPlus size={14} />
          {t("articles.action.create")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setTagsOpen(true)}
          data-testid="articles-manage-tags"
        >
          {t("articles.action.manageTags")}
        </Button>
      </div>

      <div className="articles-panel__filters">
        <div className="articles-panel__filter">
          <Label htmlFor="articles-search">{t("articles.search.label")}</Label>
          <Input
            id="articles-search"
            type="search"
            placeholder={t("articles.search.placeholder")}
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.currentTarget.value })}
            data-testid="articles-search"
          />
        </div>
        <div className="articles-panel__filter">
          <Label htmlFor="articles-filter-lang">{t("articles.filter.language")}</Label>
          <NativeSelect
            id="articles-filter-lang"
            value={filters.lang}
            onChange={(event) => patchFilters({ lang: event.currentTarget.value })}
            data-testid="articles-filter-lang"
          >
            <option value="">{t("articles.filter.all")}</option>
            {props.site.languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="articles-panel__filter">
          <Label htmlFor="articles-filter-state">{t("articles.filter.state")}</Label>
          <NativeSelect
            id="articles-filter-state"
            value={filters.state}
            onChange={(event) => patchFilters({ state: event.currentTarget.value })}
            data-testid="articles-filter-state"
          >
            <option value="">{t("articles.filter.all")}</option>
            {ARTICLE_STATES.map((state) => (
              <option key={state} value={state}>
                {t(`articles.state.${state}` as "articles.state.draft")}
              </option>
            ))}
          </NativeSelect>
        </div>
        {tags.length > 0 && (
          <div className="articles-panel__filter">
            <Label htmlFor="articles-filter-tag">{t("articles.filter.tag")}</Label>
            <NativeSelect
              id="articles-filter-tag"
              value={filters.tagId}
              onChange={(event) => patchFilters({ tagId: event.currentTarget.value })}
              data-testid="articles-filter-tag"
            >
              <option value="">{t("articles.filter.all")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="articles-panel__empty" data-testid="articles-empty">
          {total === 0 ? t("articles.empty") : t("articles.empty.filtered")}
        </p>
      ) : (
        <ul className="articles-panel__list" data-testid="articles-list">
          {rows.map(({ article, index }) => (
            <li
              key={article.id}
              data-testid={`article-row-${article.id}`}
              data-active={props.activeArticleId === article.id ? "true" : "false"}
            >
              <button
                type="button"
                className="articles-panel__row"
                onClick={() => props.onSelect(article.id)}
                data-testid={`article-open-${article.id}`}
              >
                <span className="articles-panel__row-title">{article.title}</span>
                <span className="articles-panel__badge" data-article-lang={article.lang}>
                  {article.lang}
                </span>
                <span className="articles-panel__badge" data-article-state={article.state}>
                  {t(`articles.state.${article.state}` as "articles.state.draft")}
                </span>
                <span className="articles-panel__date">{article.publishedAt}</span>
              </button>
              <button
                type="button"
                data-icon-button
                data-tone="danger"
                aria-label={`${t("articles.action.delete")} — ${article.title}`}
                onClick={() => setPendingDelete(index)}
                data-testid={`article-delete-${article.id}`}
              >
                <IconTrash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <EditorDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        testId="article-create-dialog"
        labelledBy="article-create-title"
        initialFocus={titleRef}
      >
        <h2 id="article-create-title">{t("articles.create.title")}</h2>
        <Label htmlFor="article-create-input">{t("articles.create.label")}</Label>
        <Input
          id="article-create-input"
          ref={titleRef}
          value={newTitle}
          placeholder={t("articles.create.placeholder")}
          onChange={(event) => setNewTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
          data-testid="article-create-input"
        />
        <div className="articles-panel__dialog-actions">
          <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
            {t("articles.create.cancel")}
          </Button>
          <Button
            type="button"
            disabled={newTitle.trim().length === 0}
            onClick={handleCreate}
            data-testid="article-create-submit"
          >
            {t("articles.create.submit")}
          </Button>
        </div>
      </EditorDialog>

      <EditorDialog
        open={tagsOpen}
        onClose={() => setTagsOpen(false)}
        testId="tag-manager-dialog"
        label={t("articles.tags.title")}
      >
        <TagManager site={props.site} onApply={props.onApply} />
        <div className="articles-panel__dialog-actions">
          <Button type="button" onClick={() => setTagsOpen(false)}>
            {t("articles.tags.cancel")}
          </Button>
        </div>
      </EditorDialog>

      <EditorDialog
        open={deletingArticle !== undefined}
        onClose={() => setPendingDelete(null)}
        testId="article-delete-dialog"
        tone="warning"
        labelledBy="article-delete-title"
      >
        <h2 id="article-delete-title">
          {t("articles.delete.confirm", { title: deletingArticle?.title ?? "" })}
        </h2>
        <div className="articles-panel__dialog-actions">
          <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
            {t("articles.create.cancel")}
          </Button>
          <Button
            type="button"
            data-tone="danger"
            onClick={() => {
              const index = pendingDelete;
              setPendingDelete(null);
              if (index !== null) props.onApply((site) => deleteArticle(site, index));
            }}
            data-testid="article-delete-confirm"
          >
            {t("articles.action.delete")}
          </Button>
        </div>
      </EditorDialog>
    </section>
  );
}
