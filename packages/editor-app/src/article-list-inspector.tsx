/** @jsxImportSource react */
/**
 * ArticleListInspector — configuration for an Article list.
 *
 * One component drives both places a list can be configured: the `articleList`
 * Block's Inspector and an Article's Related Articles setting. They share a
 * selection shape in the schema, so sharing the UI keeps "By tag" from meaning
 * two subtly different things depending on where the author is standing.
 *
 * The matches preview underneath the controls comes from
 * `resolveArticleSelection` — the same function the renderer and the validator
 * call. The author is therefore looking at the real answer, not a second
 * implementation of the rules that could disagree with what exports.
 *
 * Reordering offers Move up / Move down buttons rather than drag alone, per
 * issue #102's fourth round: drag handles are unusable on a phone and invisible
 * to keyboard users.
 */
import type { JSX } from "react";
import { useState } from "react";
import type { Article, ArticleSelection, Site } from "@sosb/schema";
import {
  ARTICLE_LIST_MODES,
  DEFAULT_ARTICLE_LIST_MODE,
  DEFAULT_ARTICLE_LIST_SORT,
  articlesById,
  resolveArticleSelection,
} from "@sosb/schema";
import { Input, Label, NativeSelect } from "@sosb/ui";
import { IconArrowDown, IconArrowUp, IconClose, IconPlus } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { TagPicker } from "./tag-picker.js";
import { createTag } from "./articles-ops.js";
import type { ApplySiteChange } from "./article-settings-form.js";
import { useTranslator } from "./i18n-context.js";

export interface ArticleListInspectorProps {
  readonly site: Site;
  /** Current selection configuration (block `data`, or `relatedArticles`). */
  readonly value: ArticleSelection & {
    readonly title?: string | undefined;
    readonly intro?: string | undefined;
  };
  /** Language of the containing Page or Article — drives the "By tag" preview. */
  readonly containerLang: string;
  /** Set when the list sits on an Article, so "By tag" excludes it. */
  readonly containerArticleId?: string | undefined;
  /** Patch one or more keys of the selection. */
  readonly onPatch: (patch: Record<string, unknown>) => void;
  /** Needed for inline tag creation. */
  readonly onApply: ApplySiteChange;
  /** Heading/intro fields belong to the Block, not to Related Articles. */
  readonly showTextFields?: boolean | undefined;
}

function stateLabelKey(state: Article["state"]): "articles.state.draft" {
  return `articles.state.${state}` as "articles.state.draft";
}

export function ArticleListInspector(props: ArticleListInspectorProps): JSX.Element {
  const t = useTranslator();
  const [query, setQuery] = useState("");

  const mode = props.value.mode ?? DEFAULT_ARTICLE_LIST_MODE;
  const selectedIds = props.value.articleIds ?? [];
  const byId = articlesById(props.site);
  const allArticles = props.site.articles ?? [];

  const matches = resolveArticleSelection(props.site, props.value, {
    lang: props.containerLang,
    ...(props.containerArticleId === undefined
      ? {}
      : { excludeArticleId: props.containerArticleId }),
  });

  const needle = query.trim().toLocaleLowerCase();
  const candidates = allArticles.filter(
    (article) =>
      !selectedIds.includes(article.id) &&
      (needle === "" || article.title.toLocaleLowerCase().includes(needle)),
  );

  function move(index: number, direction: -1 | 1): void {
    const next = selectedIds.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [a, b] = [next[index]!, next[target]!];
    next[index] = b;
    next[target] = a;
    props.onPatch({ articleIds: next });
  }

  return (
    <div className="article-list-inspector" data-testid="article-list-inspector">
      {props.showTextFields === true && (
        <>
          <div className="article-list-inspector__field">
            <Label htmlFor="article-list-title">{t("articleList.heading")}</Label>
            <Input
              id="article-list-title"
              value={props.value.title ?? ""}
              onChange={(event) => props.onPatch({ title: event.currentTarget.value })}
            />
          </div>
          <div className="article-list-inspector__field">
            <Label htmlFor="article-list-intro">{t("articleList.intro")}</Label>
            <Input
              id="article-list-intro"
              value={props.value.intro ?? ""}
              onChange={(event) => props.onPatch({ intro: event.currentTarget.value })}
            />
          </div>
        </>
      )}

      <fieldset className="article-list-inspector__modes">
        <legend>
          {t("articleList.mode")}
          <InfoHint
            label={t("articleList.mode")}
            text={t("articleList.mode.hint")}
            testId="article-list-mode-hint"
          />
        </legend>
        {ARTICLE_LIST_MODES.map((option) => (
          <label key={option} className="article-list-inspector__mode">
            <input
              type="radio"
              name="article-list-mode"
              value={option}
              checked={mode === option}
              onChange={() => props.onPatch({ mode: option })}
              data-testid={`article-list-mode-${option}`}
            />
            <span>
              {t(option === "byTag" ? "articleList.mode.byTag" : "articleList.mode.selected")}
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "byTag" ? (
        <>
          <TagPicker
            tags={props.site.tags ?? []}
            selected={props.value.tags ?? []}
            label={t("articleList.tags")}
            hint={{ label: t("articleList.tags"), text: t("articleList.tags.hint") }}
            testId="article-list-tag-picker"
            onToggle={(tagId) => {
              const current = props.value.tags ?? [];
              props.onPatch({
                tags: current.includes(tagId)
                  ? current.filter((id) => id !== tagId)
                  : [...current, tagId],
              });
            }}
            onCreate={(label) => {
              let createdId = "";
              props.onApply((site) => {
                const result = createTag(site, label);
                createdId = result.tagId;
                return result.site;
              });
              if (createdId !== "") {
                const current = props.value.tags ?? [];
                if (!current.includes(createdId)) {
                  props.onPatch({ tags: [...current, createdId] });
                }
              }
            }}
          />
          {(props.value.tags ?? []).length === 0 && (
            <p className="article-list-inspector__note" data-testid="article-list-no-tags">
              {t("articleList.tags.none")}
            </p>
          )}
          <div className="article-list-inspector__field">
            <Label htmlFor="article-list-sort">{t("articleList.sort")}</Label>
            <NativeSelect
              id="article-list-sort"
              value={props.value.sort ?? DEFAULT_ARTICLE_LIST_SORT}
              onChange={(event) => props.onPatch({ sort: event.currentTarget.value })}
            >
              <option value="date-desc">{t("articleList.sort.desc")}</option>
              <option value="date-asc">{t("articleList.sort.asc")}</option>
            </NativeSelect>
          </div>
        </>
      ) : (
        <div className="article-list-inspector__selection">
          <div className="article-list-inspector__label-row">
            <Label htmlFor="article-list-search">{t("articleList.selected.search")}</Label>
            <InfoHint
              label={t("articleList.mode.selected")}
              text={t("articleList.selected.hint")}
              testId="article-list-selection-hint"
            />
          </div>
          <Input
            id="article-list-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            data-testid="article-list-search"
          />

          {candidates.length > 0 && (
            <ul
              className="article-list-inspector__candidates"
              data-testid="article-list-candidates"
            >
              {candidates.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className="article-list-inspector__candidate"
                    onClick={() => {
                      props.onPatch({ articleIds: [...selectedIds, article.id] });
                      setQuery("");
                    }}
                    data-testid={`article-candidate-${article.id}`}
                  >
                    <IconPlus size={14} />
                    <span className="article-list-inspector__candidate-title">{article.title}</span>
                    <span className="article-list-inspector__meta">{article.lang}</span>
                    <span
                      className="article-list-inspector__meta"
                      data-article-state={article.state}
                    >
                      {t(stateLabelKey(article.state))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedIds.length === 0 ? (
            <p className="article-list-inspector__note">{t("articleList.selected.empty")}</p>
          ) : (
            <ol className="article-list-inspector__selected" data-testid="article-list-selected">
              {selectedIds.map((id, index) => {
                const article = byId.get(id);
                return (
                  <li key={`${id}-${index}`} data-testid={`article-selected-${id}`}>
                    <span className="article-list-inspector__selected-title">
                      {article?.title ?? t("articleList.missing")}
                    </span>
                    {article !== undefined && (
                      <>
                        <span className="article-list-inspector__meta">{article.lang}</span>
                        <span
                          className="article-list-inspector__meta"
                          data-article-state={article.state}
                        >
                          {t(stateLabelKey(article.state))}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      data-icon-button
                      aria-label={`${t("articleList.moveUp")} — ${article?.title ?? id}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      data-testid={`article-move-up-${id}`}
                    >
                      <IconArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      data-icon-button
                      aria-label={`${t("articleList.moveDown")} — ${article?.title ?? id}`}
                      disabled={index === selectedIds.length - 1}
                      onClick={() => move(index, 1)}
                      data-testid={`article-move-down-${id}`}
                    >
                      <IconArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      data-icon-button
                      data-tone="danger"
                      aria-label={`${t("articleList.selected.remove")} — ${article?.title ?? id}`}
                      onClick={() =>
                        props.onPatch({
                          articleIds: selectedIds.filter((_, i) => i !== index),
                        })
                      }
                      data-testid={`article-remove-${id}`}
                    >
                      <IconClose size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <div className="article-list-inspector__field">
        <Label htmlFor="article-list-limit">{t("articleList.limit")}</Label>
        <Input
          id="article-list-limit"
          type="number"
          min={1}
          value={props.value.limit ?? ""}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            const parsed = Number.parseInt(raw, 10);
            props.onPatch({
              limit: raw === "" || !Number.isFinite(parsed) || parsed < 1 ? undefined : parsed,
            });
          }}
        />
      </div>

      <section className="article-list-inspector__preview" aria-live="polite">
        <h3>{t("articleList.matches")}</h3>
        {matches.length === 0 ? (
          <p className="article-list-inspector__note" data-testid="article-list-no-matches">
            {t("articleList.matches.empty")}
          </p>
        ) : (
          <ul data-testid="article-list-matches">
            {matches.map((article) => (
              <li key={article.id}>
                <span>{article.title}</span>
                <span className="article-list-inspector__meta">{article.lang}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
