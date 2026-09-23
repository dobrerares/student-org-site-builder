/** @jsxImportSource react */
/**
 * ArticlesScreen — the Articles destination: a searchable, filterable list.
 *
 * Issue #102's second round pins the shape: title, language, publication state
 * and date per row, with language, state and tag filters, Create Article, and
 * Manage tags reachable from here.
 *
 * Create Article is one click. It does not ask for a title first: the accepted
 * design opens the new Draft immediately with a title field and an initial
 * Rich-text Block, so the title is typed where the writing happens. The shell
 * owns that flow (it knows the content language and today's date); this screen
 * only asks for it.
 *
 * Everything durable goes through `onApply` into the editor's undoable
 * snapshot; the screen keeps only its own transient state (search, filters,
 * which dialog is open).
 */
import type { JSX } from "react";
import { useMemo, useState } from "react";
import type { Site } from "@sosb/schema";
import { ARTICLE_STATES } from "@sosb/schema";
import { Badge, Button, Input, Label, NativeSelect } from "@sosb/ui";

import { EditorDialog } from "./editor-dialog.js";
import { IconChevronRight, IconTrash } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { TagManager } from "./tag-manager.js";
import type { ApplySiteChange } from "./article-settings-form.js";
import {
  EMPTY_ARTICLE_FILTERS,
  deleteArticle,
  filterArticles,
  type ArticleFilters,
} from "./articles-ops.js";
import { useTranslator } from "./i18n-context.js";

const STATE_TONE = {
  published: "published",
  draft: "draft",
  unlisted: "unlisted",
} as const;

export interface ArticlesScreenProps {
  readonly site: Site;
  readonly onApply: ApplySiteChange;
  /** Open an Article for editing. */
  readonly onOpen: (articleId: string) => void;
  /** Create a Draft in the current content language and open it. */
  readonly onCreate: () => void;
  /** Id of the Article last open, for the selected-row marker. */
  readonly activeArticleId?: string | undefined;
}

export function ArticlesScreen(props: ArticlesScreenProps): JSX.Element {
  const t = useTranslator();
  const [filters, setFilters] = useState<ArticleFilters>(EMPTY_ARTICLE_FILTERS);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const rows = useMemo(() => filterArticles(props.site, filters), [props.site, filters]);
  const total = (props.site.articles ?? []).length;
  const tags = props.site.tags ?? [];
  const deletingArticle =
    pendingDelete === null ? undefined : (props.site.articles ?? [])[pendingDelete];

  function patchFilters(patch: Partial<ArticleFilters>): void {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function titleOf(title: string): string {
    return title.trim() === "" ? t("articles.untitled") : title;
  }

  return (
    <div data-testid="articles-screen" data-screen aria-label={t("articles.panel.title")}>
      <header data-screen-head>
        <div data-row-between>
          <h1>
            {t("articles.panel.title")}
            <InfoHint
              label={t("articles.panel.title")}
              text={t("articles.info")}
              testId="articles-screen-info"
            />
          </h1>
          <div data-row>
            <Button
              type="button"
              onClick={() => setTagsOpen(true)}
              data-testid="articles-manage-tags"
            >
              {t("articles.action.manageTags")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={props.onCreate}
              data-testid="articles-create"
            >
              {t("builder.action.createArticle")}
            </Button>
          </div>
        </div>
      </header>

      <div data-screen-filters>
        <div data-screen-search>
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
        <div>
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
        <div>
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
          <div>
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
        <p data-empty-state data-testid="articles-empty">
          {total === 0 ? t("articles.empty") : t("articles.empty.filtered")}
        </p>
      ) : (
        <ul data-summary-list data-testid="articles-list">
          {rows.map(({ article, index }) => (
            <li
              key={article.id}
              data-testid={`article-row-${article.id}`}
              data-active={props.activeArticleId === article.id ? "true" : "false"}
            >
              <button
                type="button"
                data-summary-row
                onClick={() => props.onOpen(article.id)}
                data-testid={`article-open-${article.id}`}
              >
                <span data-summary-main>
                  <span data-summary-title>{titleOf(article.title)}</span>
                  <span data-summary-meta>{article.publishedAt}</span>
                </span>
                <Badge tone="outline" data-article-lang={article.lang}>
                  {article.lang}
                </Badge>
                <Badge
                  tone={STATE_TONE[article.state as keyof typeof STATE_TONE] ?? "neutral"}
                  data-article-state={article.state}
                >
                  {t(`articles.state.${article.state}` as "articles.state.draft")}
                </Badge>
                <IconChevronRight size={16} />
              </button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                data-tone="danger"
                aria-label={`${t("articles.action.delete")} — ${titleOf(article.title)}`}
                title={t("articles.action.delete")}
                onClick={() => setPendingDelete(index)}
                data-testid={`article-delete-${article.id}`}
              >
                <IconTrash size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <EditorDialog
        open={tagsOpen}
        onClose={() => setTagsOpen(false)}
        testId="tag-manager-dialog"
        label={t("articles.tags.title")}
      >
        <TagManager site={props.site} onApply={props.onApply} />
        <div data-dialog-actions>
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
          {t("articles.delete.confirm", { title: titleOf(deletingArticle?.title ?? "") })}
        </h2>
        <div data-dialog-actions>
          <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
            {t("articles.create.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
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
    </div>
  );
}
