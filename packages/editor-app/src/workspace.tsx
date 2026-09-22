/** @jsxImportSource react */
/**
 * Workspace — the focused editing surface for one Page or one Article.
 *
 * Issue #102 gives both the same shape, so they are the same component: an
 * editing pane on the left and the preview beside it on wide windows, one at a
 * time behind an Edit / Preview switch on phones. Inside the editing pane,
 * ADR 0042's drill-in is preserved exactly — the outline is the un-drilled
 * view, and selecting a Block, the settings row or Related Articles opens a
 * focused Inspector with a back button naming the content.
 *
 * The differences between a Page and an Article are small and local: an
 * Article additionally shows a publication-state selector on the outline and a
 * Related Articles switch after it, and its settings Inspector is the Article
 * settings form rather than the Site spine's per-page fields. Everything
 * else — title, Block outline, reordering, the per-Block Inspector, the
 * preview — is shared, which is the point. Two workspaces would drift the
 * first time someone fixed a reordering bug in only one of them.
 *
 * The preview arrives as a node rather than being built here. The preview can
 * wander away from the content being edited (clicking a link inside it behaves
 * like the public site), so *what* is previewed is shell state, not workspace
 * state; handing the workspace a finished node keeps it out of the
 * preview-bridge business entirely.
 */
import type { JSX, ReactNode } from "react";
import type { AssetRefLike, BlockEnvelope, DocumentAssetRef, Site } from "@sosb/schema";
import { ARTICLE_STATES } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { Badge, Button, Input, Label, Segmented } from "@sosb/ui";

import { ArticleListInspector } from "./article-list-inspector.js";
import { ArticleSettingsForm, type ApplySiteChange } from "./article-settings-form.js";
import { BlockInspector } from "./block-inspector.js";
import { BlockListEditor } from "./block-list-editor.js";
import { buildBlockCatalog } from "./block-catalog.js";
import { SpineForm } from "./spine-form.js";
import type { FieldNode } from "./form-generator.js";
import { IconArrowLeft, IconChevronRight } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { updateArticle } from "./articles-ops.js";
import { useTranslator } from "./i18n-context.js";
import type { WorkspaceDrill } from "./builder-navigation.js";

const STATE_TONE = {
  published: "published",
  draft: "draft",
  unlisted: "unlisted",
} as const;

export type WorkspaceTarget =
  | { readonly kind: "page"; readonly pageIndex: number }
  | { readonly kind: "article"; readonly articleId: string };

export interface WorkspaceProps {
  readonly site: Site;
  readonly target: WorkspaceTarget;
  readonly drill: WorkspaceDrill;
  readonly onDrillChange: (drill: WorkspaceDrill) => void;
  /** Phone layout: editing and preview are shown one at a time. */
  readonly isNarrow: boolean;
  readonly theme?: ThemeBundle | undefined;

  /** Back to the list this content came from. */
  readonly onBack: () => void;
  readonly onTitleChange: (value: string) => void;

  readonly onAddBlock: () => void;
  readonly onMoveBlock: (from: number, to: number) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  readonly onSetBlockVariant: (blockId: string, variant: string | undefined) => void;
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
  readonly onReplaceBlockData: (blockIndex: number, data: unknown) => void;

  /** Per-page spine fields, already rebased onto this page's index. */
  readonly pageSettingsFields: FieldNode[];
  readonly onPatchSite: (path: readonly (string | number)[], value: unknown) => void;

  readonly onApplySite: ApplySiteChange;
  readonly today: string;
  readonly onOpenArticle: (articleId: string) => void;

  readonly uploader: (file: File) => Promise<AssetRefLike>;
  readonly documentUploader: (file: File) => Promise<DocumentAssetRef>;
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;

  /** The preview pane, composed by the shell. */
  readonly preview: ReactNode;
  /** Phone-only pane switch. */
  readonly pane: "edit" | "preview";
  readonly onPaneChange: (pane: "edit" | "preview") => void;
}

export function Workspace(props: WorkspaceProps): JSX.Element {
  const t = useTranslator();

  const target = props.target;
  const isArticle = target.kind === "article";
  const page = target.kind === "page" ? props.site.pages[target.pageIndex] : undefined;
  const articleIndex =
    target.kind === "article"
      ? (props.site.articles ?? []).findIndex((a) => a.id === target.articleId)
      : -1;
  const article = articleIndex >= 0 ? props.site.articles?.[articleIndex] : undefined;

  const blocks: readonly BlockEnvelope[] = (page?.blocks ?? article?.blocks ?? []) as readonly BlockEnvelope[];
  const contentTitle = page?.navLabel ?? article?.title ?? "";
  const lang = page?.lang ?? article?.lang ?? props.site.defaultLanguage;

  // The shell reconciles a vanished target before we render, so this is the
  // narrow window where a structural edit has landed but the reconcile has
  // not yet flushed.
  if (page === undefined && article === undefined) {
    return (
      <div data-testid="workspace-missing" data-screen>
        <p>{t("workspace.missing")}</p>
      </div>
    );
  }

  const catalog = buildBlockCatalog();
  const drill = props.drill;
  const activeBlockIndex =
    drill.kind === "block" ? blocks.findIndex((b) => b.id === drill.blockId) : -1;
  const activeBlock = activeBlockIndex >= 0 ? blocks[activeBlockIndex] : undefined;

  const backToOutline = (
    <Button
      type="button"
      data-testid="drill-back"
      data-action="drill-back"
      onClick={() => props.onDrillChange({ kind: "outline" })}
    >
      <IconArrowLeft size={16} />
      <span data-truncate>{t("workspace.back.content", { title: contentTitle })}</span>
    </Button>
  );

  const paneBar = (
    <div data-pane-bar>
      {drill.kind === "outline" ? (
        <Button
          type="button"
          data-testid="workspace-back"
          data-action="workspace-back"
          onClick={props.onBack}
        >
          <IconArrowLeft size={16} />
          <span data-truncate>
            {isArticle ? t("workspace.back.articles") : t("workspace.back.pages")}
          </span>
        </Button>
      ) : (
        backToOutline
      )}
      <span data-pane-spacer />
      {article !== undefined && (
        <Badge tone={STATE_TONE[article.state as keyof typeof STATE_TONE] ?? "neutral"}>
          {t(`articles.state.${article.state}` as "articles.state.draft")}
        </Badge>
      )}
      <Badge tone="outline">{lang}</Badge>
    </div>
  );

  let body: JSX.Element;

  if (drill.kind === "block" && activeBlock !== undefined) {
    const entry = catalog.entryFor(activeBlock.type);
    const rawTitle = (activeBlock.data as { title?: unknown })?.title;
    const blockTitle = typeof rawTitle === "string" && rawTitle.trim() !== "" ? rawTitle : entry.label;
    body = (
      <div
        data-testid="inspector"
        data-inspector-mode="block"
        data-block-id={activeBlock.id}
        data-block-type={activeBlock.type}
      >
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">{entry.label}</span>
          <h2>{blockTitle}</h2>
        </header>
        <BlockInspector
          site={props.site}
          block={activeBlock}
          theme={props.theme}
          containerLang={lang}
          {...(article === undefined ? {} : { containerArticleId: article.id })}
          onSetVariant={(variant) => props.onSetBlockVariant(activeBlock.id, variant)}
          onPatchData={(subpath, value) =>
            props.onPatchBlockData(activeBlockIndex, subpath, value)
          }
          onArrayChangeData={(subpath, next) =>
            props.onArrayChangeBlockData(activeBlockIndex, subpath, next)
          }
          onReplaceData={(data) => props.onReplaceBlockData(activeBlockIndex, data)}
          onApplySite={props.onApplySite}
          uploader={props.uploader}
          documentUploader={props.documentUploader}
          displayUrlFor={props.displayUrlFor}
        />
      </div>
    );
  } else if (drill.kind === "settings") {
    body = (
      <div
        data-testid="inspector"
        data-inspector-mode={isArticle ? "article-settings" : "page"}
        {...(props.target.kind === "page" ? { "data-page-index": props.target.pageIndex } : {})}
      >
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">
            {isArticle ? t("workspace.settings.article") : t("workspace.settings.page")}
          </span>
          <h2>{contentTitle}</h2>
        </header>
        {article !== undefined && articleIndex >= 0 ? (
          <ArticleSettingsForm
            site={props.site}
            articleIndex={articleIndex}
            onApply={props.onApplySite}
            uploader={props.uploader}
            displayUrlFor={props.displayUrlFor}
          />
        ) : (
          <SpineForm
            fields={props.pageSettingsFields}
            site={props.site}
            onPatch={props.onPatchSite}
            uploader={props.uploader}
            documentUploader={props.documentUploader}
            {...(props.displayUrlFor === undefined ? {} : { displayUrlFor: props.displayUrlFor })}
          />
        )}
      </div>
    );
  } else if (drill.kind === "related" && article !== undefined && articleIndex >= 0) {
    const related = article.relatedArticles;
    body = (
      <div data-testid="inspector" data-inspector-mode="related">
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">{t("articles.settings.related")}</span>
          <h2>{contentTitle}</h2>
        </header>
        <ArticleListInspector
          site={props.site}
          value={related ?? { enabled: true }}
          containerLang={lang}
          containerArticleId={article.id}
          onApply={props.onApplySite}
          onPatch={(patch) => {
            props.onApplySite((site) => {
              const current = (site.articles ?? [])[articleIndex]?.relatedArticles ?? {
                enabled: true,
              };
              return updateArticle(site, articleIndex, {
                relatedArticles: { ...current, ...patch, enabled: true },
              });
            });
          }}
        />
      </div>
    );
  } else {
    // The outline: title, publication state, settings affordance, Blocks and
    // — for an Article — Related Articles after them.
    const relatedEnabled = article?.relatedArticles?.enabled === true;
    body = (
      <div data-testid="workspace-outline">
        <div data-title-field>
          <Label htmlFor="workspace-title">
            {isArticle ? t("workspace.title.article") : t("workspace.title.page")}
          </Label>
          <Input
            id="workspace-title"
            data-testid="workspace-title"
            value={contentTitle}
            onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          />
          <span data-hint>/{page?.slug ?? article?.slug ?? ""}</span>
        </div>

        {article !== undefined && articleIndex >= 0 && (
          <div data-card data-testid="workspace-state">
            <div data-row>
              <Label htmlFor="workspace-state-control">{t("articles.settings.state")}</Label>
              <Segmented
                ariaLabel={t("articles.settings.state")}
                value={article.state}
                onValueChange={(state) =>
                  props.onApplySite((site) => updateArticle(site, articleIndex, { state }))
                }
                options={ARTICLE_STATES.map((state) => ({
                  value: state,
                  label: t(`articles.state.${state}` as "articles.state.draft"),
                  testId: `workspace-state-${state}`,
                }))}
              />
              <InfoHint
                label={t("articles.settings.state")}
                text={t("articles.settings.state.hint")}
                testId="workspace-state-hint"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          data-summary-row
          data-testid="workspace-settings-link"
          data-action="drill-settings"
          onClick={() => props.onDrillChange({ kind: "settings" })}
        >
          <span data-summary-main>
            <span data-summary-title>
              {isArticle ? t("workspace.settings.article") : t("workspace.settings.page")}
            </span>
            <span data-summary-meta>
              {isArticle ? t("workspace.settings.article.hint") : t("workspace.settings.page.hint")}
            </span>
          </span>
          <IconChevronRight size={16} />
        </button>

        <section data-workspace-blocks>
          <div data-row-between>
            <h3>
              {t("workspace.blocks")}
              <InfoHint
                label={t("workspace.blocks")}
                text={t("workspace.blocks.info")}
                testId="workspace-blocks-info"
              />
            </h3>
          </div>
          <BlockListEditor
            site={props.site}
            pageSlug={page?.slug ?? article?.slug ?? ""}
            blocks={blocks}
            onSelect={(blockId) => props.onDrillChange({ kind: "block", blockId })}
            onMove={props.onMoveBlock}
            onRemove={props.onRemoveBlock}
            onAddBlock={props.onAddBlock}
          />
        </section>

        {article !== undefined && articleIndex >= 0 && (
          <section data-card data-testid="article-related">
            <div data-row-between>
              <div data-row>
                <Label htmlFor="article-related-toggle">{t("articles.settings.related")}</Label>
                <InfoHint
                  label={t("articles.settings.related")}
                  text={t("articles.settings.related.hint")}
                  testId="article-related-hint"
                />
              </div>
              <label data-toggle>
                <input
                  id="article-related-toggle"
                  type="checkbox"
                  checked={relatedEnabled}
                  onChange={(event) => {
                    const enabled = event.currentTarget.checked;
                    props.onApplySite((site) => {
                      const current = (site.articles ?? [])[articleIndex]?.relatedArticles;
                      // Toggling off moves only the `enabled` flag, so the
                      // configuration survives and switching back on restores
                      // the list the author already built.
                      return updateArticle(site, articleIndex, {
                        relatedArticles: { ...(current ?? { mode: "byTag" as const }), enabled },
                      });
                    });
                  }}
                  data-testid="article-related-toggle"
                />
                <span>{t("articles.settings.related.enable")}</span>
              </label>
            </div>
            {relatedEnabled && (
              <Button
                type="button"
                size="sm"
                data-testid="article-related-configure"
                onClick={() => props.onDrillChange({ kind: "related" })}
              >
                {t("articles.settings.related")}
                <IconChevronRight size={14} />
              </Button>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div data-testid="workspace" data-workspace>
      {props.isNarrow && (
        <div data-workspace-tabs>
          <Segmented
            ariaLabel={t("workspace.tabs.label")}
            value={props.pane}
            onValueChange={props.onPaneChange}
            options={[
              { value: "edit", label: t("workspace.tab.edit"), testId: "workspace-tab-edit" },
              {
                value: "preview",
                label: t("workspace.tab.preview"),
                testId: "workspace-tab-preview",
              },
            ]}
          />
        </div>
      )}

      <section
        data-testid="editor-pane"
        data-hidden={props.isNarrow && props.pane !== "edit" ? "true" : "false"}
        aria-label={t("pane.editor.label")}
      >
        {paneBar}
        <div data-pane-body>{body}</div>
      </section>

      <div
        data-workspace-preview
        data-hidden={props.isNarrow && props.pane !== "preview" ? "true" : "false"}
      >
        {props.preview}
      </div>
    </div>
  );
}
