/** @jsxImportSource react */
/**
 * ArticleWorkspace — editing one Article: settings, Blocks, Related Articles.
 *
 * The Block half is the existing Page machinery reused unchanged:
 * `BlockListEditor` for the outline and `BlockForm` for the per-Block Inspector,
 * with the same drill-in pattern ADR 0042 established. An Article body is a
 * Block list precisely so this could be true — a second block editor would have
 * to be kept in step with the first forever, and would diverge the first time
 * someone fixed a drag bug in only one of them.
 *
 * Related Articles appears after the Block outline, per issue #102, and its
 * controls are the shared `ArticleListInspector`. Disabling it keeps the
 * configuration so the author can switch it back on without redoing the work.
 */
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type {
  AssetRefLike,
  BlockEnvelope,
  CustomHtmlBlock,
  DocumentAssetRef,
  Site,
} from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { KnownBlockSchemas } from "@sosb/schema";
import type { ZodType } from "zod";
import { Button, Label } from "@sosb/ui";
import { BlockForm } from "./block-form.js";
import { BlockListEditor } from "./block-list-editor.js";
import { BlockVariantControl } from "./block-variant-control.js";
import { CustomHtmlBlockForm } from "./custom-html-form.js";
import { buildBlockCatalog } from "./block-catalog.js";
import { defaultArrayItemForBlock } from "./block-array-defaults.js";
import { BLOCK_FIELD_METADATA } from "./field-metadata.js";
import { IconArrowLeft } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { ArticleListInspector } from "./article-list-inspector.js";
import { ArticleSettingsForm, type ApplySiteChange } from "./article-settings-form.js";
import { addArticleTranslation, updateArticle } from "./articles-ops.js";
import { useTranslator } from "./i18n-context.js";

type ArticleDrill =
  | { readonly kind: "outline" }
  | { readonly kind: "block"; readonly blockId: string };

export interface ArticleWorkspaceProps {
  readonly site: Site;
  readonly articleIndex: number;
  readonly onApply: ApplySiteChange;
  readonly onBack: () => void;
  /** Open another Article for editing — used after creating a translation. */
  readonly onOpenArticle: (articleId: string) => void;
  /**
   * Today's date as `YYYY-MM-DD`, seeding a new translation's publication
   * date. Injected rather than read from the clock so tests stay stable.
   */
  readonly today: string;
  readonly onPatchBlockData: (
    blockIndex: number,
    subpath: readonly (string | number)[],
    value: unknown,
  ) => void;
  readonly onArrayChangeBlockData: (
    blockIndex: number,
    subpath: readonly (string | number)[],
    next: readonly unknown[],
  ) => void;
  readonly onMoveBlock: (from: number, to: number) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  readonly onAddBlock: () => void;
  readonly uploader: (file: File) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;
  /**
   * Active Theme, for the per-Block Variant control. An Article's Blocks
   * render through the same variant machinery a Page's do, so withholding the
   * control here would make the same Block configurable on a Page and not in
   * an Article.
   */
  readonly theme?: ThemeBundle | undefined;
  /** Set (or clear) a Block's design variant. */
  readonly onSetBlockVariant?: ((blockId: string, variant: string | undefined) => void) | undefined;
}

export function ArticleWorkspace(props: ArticleWorkspaceProps): JSX.Element | null {
  const t = useTranslator();
  const [drill, setDrill] = useState<ArticleDrill>({ kind: "outline" });
  const article = (props.site.articles ?? [])[props.articleIndex];

  // Switching Articles must drill back out: the previously-open Block belongs
  // to the Article we just left.
  useEffect(() => {
    setDrill({ kind: "outline" });
  }, [article?.id]);

  const blocks: readonly BlockEnvelope[] = article?.blocks ?? [];
  const activeBlockIndex =
    drill.kind === "block" ? blocks.findIndex((b) => b.id === drill.blockId) : -1;
  const activeBlock = activeBlockIndex >= 0 ? blocks[activeBlockIndex] : undefined;

  useEffect(() => {
    if (drill.kind === "block" && activeBlock === undefined) setDrill({ kind: "outline" });
  }, [drill, activeBlock]);

  if (article === undefined) return null;
  const index = props.articleIndex;
  const catalog = buildBlockCatalog();

  if (drill.kind === "block" && activeBlock !== undefined && activeBlockIndex >= 0) {
    const envelope = KnownBlockSchemas[activeBlock.type as keyof typeof KnownBlockSchemas];
    const dataSchema =
      envelope !== undefined
        ? ((envelope as unknown as { shape: { data: ZodType } }).shape.data ?? envelope)
        : undefined;
    const entry = catalog.entryFor(activeBlock.type);
    const blockTitle =
      typeof (activeBlock.data as { title?: unknown })?.title === "string"
        ? (activeBlock.data as { title: string }).title
        : entry.label;

    return (
      <div
        data-testid="inspector"
        data-inspector-mode="article-block"
        data-block-id={activeBlock.id}
        data-block-type={activeBlock.type}
      >
        <Button
          type="button"
          data-testid="drill-back"
          onClick={() => setDrill({ kind: "outline" })}
        >
          <IconArrowLeft size={16} />
          <span>{t("articles.action.back")}</span>
        </Button>
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">{entry.label}</span>
          <h2>{blockTitle}</h2>
        </header>
        {props.onSetBlockVariant !== undefined && (
          <BlockVariantControl
            block={activeBlock}
            theme={props.theme}
            onChange={(variant) => props.onSetBlockVariant?.(activeBlock.id, variant)}
          />
        )}
        {activeBlock.type === "articleList" ? (
          <ArticleListInspector
            site={props.site}
            value={activeBlock.data}
            containerLang={article.lang}
            containerArticleId={article.id}
            showTextFields
            onApply={props.onApply}
            onPatch={(patch) => {
              for (const [key, value] of Object.entries(patch)) {
                props.onPatchBlockData(activeBlockIndex, [key], value);
              }
            }}
          />
        ) : activeBlock.type === "customHTML" ? (
          <CustomHtmlBlockForm
            block={activeBlock as CustomHtmlBlock}
            onChange={(nextBlock) => {
              props.onArrayChangeBlockData(activeBlockIndex, [], []);
              props.onPatchBlockData(activeBlockIndex, [], nextBlock.data);
            }}
          />
        ) : dataSchema !== undefined ? (
          <BlockForm
            schema={dataSchema}
            data={activeBlock.data}
            onPatch={(subpath, value) => props.onPatchBlockData(activeBlockIndex, subpath, value)}
            onArrayChange={(subpath, next) =>
              props.onArrayChangeBlockData(activeBlockIndex, subpath, next)
            }
            uploader={props.uploader}
            documentUploader={props.documentUploader}
            {...(props.displayUrlFor === undefined ? {} : { displayUrlFor: props.displayUrlFor })}
            newItem={(subpath) => defaultArrayItemForBlock(activeBlock.type, subpath)}
            overrides={
              BLOCK_FIELD_METADATA[activeBlock.type as keyof typeof BLOCK_FIELD_METADATA] ?? []
            }
          />
        ) : (
          <p data-testid="inspector-unknown-type">
            No editor available for block type &quot;{activeBlock.type}&quot;.
          </p>
        )}
      </div>
    );
  }

  const related = article.relatedArticles;
  const relatedEnabled = related?.enabled === true;

  return (
    <div data-testid="inspector" data-inspector-mode="article" data-article-id={article.id}>
      <Button type="button" data-testid="drill-back" onClick={props.onBack}>
        <IconArrowLeft size={16} />
        <span>{t("articles.action.back")}</span>
      </Button>
      <header data-testid="inspector-header">
        <span data-testid="inspector-eyebrow">{t("articles.settings.title")}</span>
        <h2>{article.title}</h2>
      </header>

      <ArticleSettingsForm
        site={props.site}
        articleIndex={index}
        onApply={props.onApply}
        uploader={props.uploader}
        displayUrlFor={props.displayUrlFor}
      />

      <section className="article-workspace__blocks" aria-label={t("articles.settings.blocks")}>
        <BlockListEditor
          site={props.site}
          pageSlug={article.slug}
          blocks={blocks}
          onSelect={(blockId) => setDrill({ kind: "block", blockId })}
          onMove={props.onMoveBlock}
          onRemove={props.onRemoveBlock}
          onAddBlock={props.onAddBlock}
        />
      </section>

      <ArticleTranslations
        site={props.site}
        articleIndex={index}
        today={props.today}
        onApply={props.onApply}
        onOpenArticle={props.onOpenArticle}
      />

      <section className="article-workspace__related" data-testid="article-related">
        <div className="article-workspace__label-row">
          <Label htmlFor="article-related-toggle">{t("articles.settings.related")}</Label>
          <InfoHint
            label={t("articles.settings.related")}
            text={t("articles.settings.related.hint")}
            testId="article-related-hint"
          />
        </div>
        <label className="article-workspace__toggle">
          <input
            id="article-related-toggle"
            type="checkbox"
            checked={relatedEnabled}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              props.onApply((site) => {
                const current = (site.articles ?? [])[index]?.relatedArticles;
                // Toggling off preserves the configuration verbatim — only the
                // `enabled` flag moves, so switching back restores the list.
                return updateArticle(site, index, {
                  relatedArticles: { ...(current ?? { mode: "byTag" as const }), enabled },
                });
              });
            }}
            data-testid="article-related-toggle"
          />
          <span>{t("articles.settings.related.enable")}</span>
        </label>

        {relatedEnabled && related !== undefined && (
          <ArticleListInspector
            site={props.site}
            value={related}
            containerLang={article.lang}
            containerArticleId={article.id}
            onApply={props.onApply}
            onPatch={(patch) => {
              props.onApply((site) => {
                const current = (site.articles ?? [])[index]?.relatedArticles ?? {
                  enabled: true,
                };
                return updateArticle(site, index, {
                  relatedArticles: { ...current, ...patch, enabled: true },
                });
              });
            }}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Create the Article's counterpart in another language.
 *
 * Issue #97 makes translations separate linked Articles with their own
 * publication state, which means the author needs a way to *make* one —
 * `addArticleTranslation` existed but nothing reached it, so a translation
 * could only be produced by hand-editing the project file.
 *
 * Only languages with no counterpart in the translation group are offered:
 * `addArticleTranslation` refuses a second Article in a language the group
 * already occupies, and a button that silently does nothing is worse than no
 * button. Renders nothing on a single-language Site.
 */
function ArticleTranslations(props: {
  site: Site;
  articleIndex: number;
  today: string;
  onApply: ApplySiteChange;
  onOpenArticle: (articleId: string) => void;
}): JSX.Element | null {
  const t = useTranslator();
  const article = (props.site.articles ?? [])[props.articleIndex];
  if (article === undefined) return null;
  if (props.site.languages.length < 2) return null;

  const group = article.translationGroup;
  const taken = new Set<string>([article.lang]);
  if (group !== undefined) {
    for (const other of props.site.articles ?? []) {
      if (other.translationGroup === group) taken.add(other.lang);
    }
  }
  const missing = props.site.languages.filter((lang) => !taken.has(lang));
  if (missing.length === 0) return null;

  return (
    <section className="article-workspace__translations" data-testid="article-translations">
      <div className="article-workspace__label-row">
        <Label>{t("articles.settings.language")}</Label>
        <InfoHint
          label={t("articles.settings.language")}
          text={t("articles.settings.language.hint")}
          testId="article-translations-hint"
        />
      </div>
      {missing.map((lang) => (
        <Button
          key={lang}
          type="button"
          variant="secondary"
          data-testid={`article-add-translation-${lang}`}
          onClick={() => {
            let createdId: string | undefined;
            props.onApply((site) => {
              const result = addArticleTranslation(site, props.articleIndex, lang, props.today);
              createdId = result.articleId;
              return result.site;
            });
            if (createdId !== undefined) props.onOpenArticle(createdId);
          }}
        >
          {t("articles.action.addTranslation", { lang })}
        </Button>
      ))}
    </section>
  );
}
