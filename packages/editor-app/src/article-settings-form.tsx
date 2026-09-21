/** @jsxImportSource react */
/**
 * ArticleSettingsForm — the metadata half of editing an Article.
 *
 * Deliberately hand-written rather than generated from `ArticleSchema` by the
 * form-generator. ADR 0043 reserves hand-coded forms for surfaces with genuinely
 * unusual UX, and this one has four: a slug field whose edits create redirect
 * history, a publication-state control that needs an explanation of when changes
 * actually go live, a tag picker with inline creation, and a cover image that
 * must obey the sibling-alt dual-write rule. A generated form would render
 * `slugHistory`, `translationGroup`, and `id` as text inputs, which ADR 0044
 * forbids outright.
 *
 * Every longer explanation sits behind an (i) `InfoHint` per issue #102's
 * global presentation rule.
 */
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { ArticleState, AssetRefLike, Site } from "@sosb/schema";
import { ARTICLE_STATES } from "@sosb/schema";
import { Input, Label, NativeSelect, Textarea } from "@sosb/ui";
import { AssetPicker } from "./asset-picker.js";
import { InfoHint } from "./info-hint.js";
import { TagPicker } from "./tag-picker.js";
import { createTag, setArticleSlug, updateArticle } from "./articles-ops.js";
import { useTranslator } from "./i18n-context.js";

/** Apply a pure Site transform through the editor's undoable state. */
export type ApplySiteChange = (mutate: (site: Site) => Site) => void;

export interface ArticleSettingsFormProps {
  readonly site: Site;
  readonly articleIndex: number;
  readonly onApply: ApplySiteChange;
  readonly uploader: (file: File) => Promise<AssetRefLike>;
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;
}

export function ArticleSettingsForm(props: ArticleSettingsFormProps): JSX.Element | null {
  const t = useTranslator();
  const article = (props.site.articles ?? [])[props.articleIndex];

  // The slug is edited as a draft and committed on blur, because committing on
  // every keystroke would push a half-typed slug into `slugHistory` and mint a
  // redirect for a URL that never existed.
  const [slugDraft, setSlugDraft] = useState(article?.slug ?? "");
  const [slugError, setSlugError] = useState<"invalid" | "taken" | null>(null);
  useEffect(() => {
    setSlugDraft(article?.slug ?? "");
    setSlugError(null);
  }, [article?.id, article?.slug]);

  if (article === undefined) return null;
  const index = props.articleIndex;

  const patch = (next: Parameters<typeof updateArticle>[2]): void => {
    props.onApply((site) => updateArticle(site, index, next));
  };

  function commitSlug(): void {
    if (slugDraft === article?.slug) {
      setSlugError(null);
      return;
    }
    let failure: "invalid" | "taken" | undefined;
    props.onApply((site) => {
      const result = setArticleSlug(site, index, slugDraft);
      failure = result.error;
      return result.site;
    });
    setSlugError(failure ?? null);
  }

  return (
    <div className="article-settings" data-testid="article-settings-form">
      <div className="article-settings__field">
        <Label htmlFor="article-title">{t("articles.settings.titleField")}</Label>
        <Input
          id="article-title"
          data-field={`articles.${index}.title`}
          value={article.title}
          onChange={(event) => patch({ title: event.currentTarget.value })}
        />
      </div>

      <div className="article-settings__field">
        <div className="article-settings__label-row">
          <Label htmlFor="article-slug">{t("articles.settings.slug")}</Label>
          <InfoHint
            label={t("articles.settings.slug")}
            text={t("articles.settings.slug.hint")}
            testId="article-slug-hint"
          />
        </div>
        <Input
          id="article-slug"
          data-field={`articles.${index}.slug`}
          value={slugDraft}
          onChange={(event) => setSlugDraft(event.currentTarget.value)}
          onBlur={commitSlug}
          aria-invalid={slugError !== null}
          aria-describedby={slugError !== null ? "article-slug-error" : undefined}
        />
        {slugError !== null && (
          <p id="article-slug-error" role="alert" className="article-settings__error">
            {t(
              slugError === "invalid"
                ? "articles.settings.slug.error.invalid"
                : "articles.settings.slug.error.taken",
            )}
          </p>
        )}
      </div>

      <div className="article-settings__field">
        <Label htmlFor="article-date">{t("articles.settings.date")}</Label>
        <Input
          id="article-date"
          type="date"
          data-field={`articles.${index}.publishedAt`}
          value={article.publishedAt}
          onChange={(event) => patch({ publishedAt: event.currentTarget.value })}
        />
      </div>

      <div className="article-settings__field">
        <Label htmlFor="article-summary">{t("articles.settings.summary")}</Label>
        <Textarea
          id="article-summary"
          rows={3}
          data-field={`articles.${index}.summary`}
          value={article.summary ?? ""}
          onChange={(event) => patch({ summary: event.currentTarget.value })}
        />
      </div>

      <div className="article-settings__field">
        <Label>{t("articles.settings.cover")}</Label>
        <AssetPicker
          value={article.cover}
          uploader={props.uploader}
          displayUrlFor={props.displayUrlFor}
          onChange={(next) => {
            // Sibling-alt dual-write (CONTEXT.md): the author edits `coverAlt`,
            // and the ref's own `alt` is kept in step for export and JSON-LD.
            const alt = article.coverAlt ?? next.alt ?? "";
            patch({ cover: { ...next, alt }, coverAlt: alt });
          }}
          onClear={() => {
            patch({ cover: undefined, coverAlt: undefined });
          }}
        />
      </div>

      {article.cover !== undefined && (
        <div className="article-settings__field">
          <Label htmlFor="article-cover-alt">{t("articles.settings.coverAlt")}</Label>
          <Input
            id="article-cover-alt"
            data-field={`articles.${index}.coverAlt`}
            value={article.coverAlt ?? ""}
            onChange={(event) => {
              const alt = event.currentTarget.value;
              patch({
                coverAlt: alt,
                ...(article.cover === undefined ? {} : { cover: { ...article.cover, alt } }),
              });
            }}
          />
        </div>
      )}

      <div className="article-settings__field">
        <TagPicker
          tags={props.site.tags ?? []}
          selected={article.tags ?? []}
          label={t("articles.settings.tags")}
          onToggle={(tagId) => {
            const current = article.tags ?? [];
            patch({
              tags: current.includes(tagId)
                ? current.filter((id) => id !== tagId)
                : [...current, tagId],
            });
          }}
          onCreate={(label) => {
            props.onApply((site) => {
              const created = createTag(site, label);
              const target = (created.site.articles ?? [])[index];
              const current = target?.tags ?? [];
              if (current.includes(created.tagId)) return created.site;
              return updateArticle(created.site, index, { tags: [...current, created.tagId] });
            });
          }}
        />
      </div>

      <div className="article-settings__field">
        <div className="article-settings__label-row">
          <Label htmlFor="article-state">{t("articles.settings.state")}</Label>
          <InfoHint
            label={t("articles.settings.state")}
            text={t("articles.settings.state.hint")}
            testId="article-state-hint"
          />
        </div>
        <NativeSelect
          id="article-state"
          data-field={`articles.${index}.state`}
          value={article.state}
          onChange={(event) => patch({ state: event.currentTarget.value as ArticleState })}
        >
          {ARTICLE_STATES.map((state) => (
            <option key={state} value={state}>
              {t(`articles.state.${state}` as "articles.state.draft")}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
