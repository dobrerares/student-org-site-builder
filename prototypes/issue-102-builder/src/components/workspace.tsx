/** THROWAWAY prototype (issue #102) — the focused editing workspace (edit + preview). */
import { useEffect, useMemo, useState } from "react";
import {
  BLOCK_LABEL,
  LANG_LABEL,
  STATE_LABEL,
  articleUrl,
  emptyListConfig,
  matchesByTag,
  pageUrl,
  slugify,
  uid,
  type Article,
  type Block,
  type Lang,
  type ListConfig,
  type Page,
  type PubState,
  type Site,
  type Tag,
} from "../model";
import { ArticleCard, ListConfigEditor, TagPicker } from "./pickers";
import { PublicPreview, type PreviewTarget } from "./preview";
import { RichTextEditor } from "./richtext";
import { Dialog, Field, Info, LangBadge, Segmented, StateBadge, formatDate } from "./ui";

type Drill =
  | { kind: "outline" }
  | { kind: "block"; id: string }
  | { kind: "settings" }
  | { kind: "related" };

export type WorkspaceProps = {
  site: Site;
  setSite: (fn: (s: Site) => Site) => void;
  target: PreviewTarget;
  onBack: () => void;
  onOpen: (t: PreviewTarget) => void;
  createTag: (label: string) => Tag | null;
  toast: (text: string, kind?: "ok" | "warn" | "info") => void;
  isPhone: boolean;
};

/* ---------------- blocks: outline + inspector ---------------- */

function BlockOutline({
  blocks,
  onOpenBlock,
  onReorder,
  onAdd,
  onRemove,
  site,
}: {
  blocks: Block[];
  site: Site;
  onOpenBlock: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: (type: Block["type"]) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const summary = (b: Block) => {
    switch (b.type) {
      case "richText": {
        const text = new DOMParser().parseFromString(b.html, "text/html").body.textContent ?? "";
        return text.slice(0, 64) || "Empty";
      }
      case "articleList":
        return `${b.config.heading} — ${b.config.mode === "tag" ? "By tag" : `${b.config.articleIds.length} selected`}`;
      case "heading":
        return b.text;
      case "cta":
        return b.text;
      case "image":
        return b.src;
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h3 className="h3">
          Blocks{" "}
          <Info label="blocks">
            Blocks are the pieces this page is made of, in the order they appear. Choose one to edit
            it. Drag the ⠿ handle, or use Move up / Move down, to reorder them.
          </Info>
        </h3>
        <button className="btn btn-sm" onClick={() => setAdding(true)}>
          + Add block
        </button>
      </div>
      <div className="list">
        {blocks.length === 0 && <div className="list-row muted">No blocks yet.</div>}
        {blocks.map((b, i) => (
          <div
            className="block-row"
            key={b.id}
            data-dragover={dragOver === b.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(b.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) onReorder(from, i);
            }}
          >
            <span className="drag-handle" title="Drag to reorder" aria-hidden="true">
              ⠿
            </span>
            <button className="block-open" onClick={() => onOpenBlock(b.id)}>
              <span className="t">{BLOCK_LABEL[b.type]}</span>
              <span className="s">{summary(b)}</span>
            </button>
            <span className="block-actions">
              <button
                className="btn btn-sm btn-icon"
                title="Move up"
                aria-label={`Move ${BLOCK_LABEL[b.type]} up`}
                onClick={() => onReorder(i, i - 1)}
              >
                ↑
              </button>
              <button
                className="btn btn-sm btn-icon"
                title="Move down"
                aria-label={`Move ${BLOCK_LABEL[b.type]} down`}
                onClick={() => onReorder(i, i + 1)}
              >
                ↓
              </button>
              <button
                className="btn btn-sm btn-icon"
                title="Remove block"
                aria-label={`Remove ${BLOCK_LABEL[b.type]}`}
                onClick={() => onRemove(b.id)}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      {adding && (
        <Dialog
          title="Add a block"
          onClose={() => setAdding(false)}
          actions={
            <button className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          }
        >
          <div className="stack">
            {(Object.keys(BLOCK_LABEL) as Block["type"][]).map((t) => (
              <button
                key={t}
                className="btn"
                onClick={() => {
                  onAdd(t);
                  setAdding(false);
                }}
              >
                {BLOCK_LABEL[t]}
              </button>
            ))}
            <span className="field-label">
              Prototype note
              <Info label="the block list in this prototype">
                The real builder offers all {Object.keys(BLOCK_LABEL).length * 3} block types from
                the block library. Five are enough to walk through navigation. ({site.pages.length}{" "}
                pages in this project.)
              </Info>
            </span>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function BlockInspector({
  site,
  block,
  lang,
  excludeId,
  onChange,
  createTag,
  onOpen,
}: {
  site: Site;
  block: Block;
  lang: Lang;
  excludeId?: string;
  onChange: (b: Block) => void;
  createTag: (label: string) => Tag | null;
  onOpen: (t: PreviewTarget) => void;
}) {
  switch (block.type) {
    case "richText":
      return (
        <RichTextEditor
          key={block.id}
          site={site}
          html={block.html}
          onChange={(html) => onChange({ ...block, html })}
        />
      );
    case "articleList":
      return (
        <ListConfigEditor
          site={site}
          config={block.config}
          lang={lang}
          excludeId={excludeId}
          onCreateTag={createTag}
          onChange={(config) => onChange({ ...block, config })}
          onOpenArticle={(id) => onOpen({ kind: "article", id })}
        />
      );
    case "heading":
      return (
        <div className="stack">
          <Field label="Heading text">
            <input
              type="text"
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </Field>
          <Field label="Size">
            <Segmented
              ariaLabel="Heading size"
              value={String(block.level) as "2" | "3"}
              onChange={(v) => onChange({ ...block, level: Number(v) as 2 | 3 })}
              options={[
                { value: "2", label: "Large" },
                { value: "3", label: "Medium" },
              ]}
            />
          </Field>
        </div>
      );
    case "cta":
      return (
        <div className="stack">
          <Field label="Message">
            <input
              type="text"
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </Field>
          <Field label="Button label">
            <input
              type="text"
              value={block.buttonLabel}
              onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })}
            />
          </Field>
        </div>
      );
    case "image":
      return (
        <div className="stack">
          <Field label="Image file">
            <input
              type="text"
              value={block.src}
              onChange={(e) => onChange({ ...block, src: e.target.value })}
            />
          </Field>
          <Field
            label="Image description"
            info="Describes the image for people using a screen reader. A missing description is a warning, not something that stops you exporting."
          >
            <input
              type="text"
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
            />
          </Field>
          <Field label="Caption (optional)">
            <input
              type="text"
              value={block.caption}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
            />
          </Field>
        </div>
      );
  }
}

/* ---------------- Article settings ---------------- */

function ArticleSettings({
  site,
  article,
  update,
  createTag,
}: {
  site: Site;
  article: Article;
  update: (patch: Partial<Article>) => void;
  createTag: (label: string) => Tag | null;
}) {
  return (
    <div className="stack">
      <Field
        label="Summary"
        info="One or two sentences. It appears on article cards, in search results and when the article is shared."
      >
        <textarea value={article.summary} onChange={(e) => update({ summary: e.target.value })} />
      </Field>

      <Field label="Cover image" info="Shown above the article and on its cards. Optional.">
        {article.cover ? (
          <div className="row">
            <span className="badge badge-tag">🖼 {article.cover.src}</span>
            <button className="btn btn-sm" onClick={() => update({ cover: null })}>
              Remove
            </button>
          </div>
        ) : (
          <button
            className="btn btn-sm"
            onClick={() => update({ cover: { src: "uploaded-cover.jpg", alt: "Cover image" } })}
          >
            Upload a cover image
          </button>
        )}
      </Field>

      <Field
        label="Publication date"
        info="Describes and sorts the article. It does not schedule anything — nothing publishes itself on this date."
      >
        <input
          type="date"
          value={article.date}
          onChange={(e) => update({ date: e.target.value })}
        />
      </Field>

      <TagPicker
        site={site}
        label="Tags"
        selected={article.tagIds}
        onChange={(tagIds) => update({ tagIds })}
        onCreateTag={createTag}
        info="Tags are shared across the whole site and across languages. Article lists set to “By tag” pick articles up automatically."
      />

      <Field label="Web address">
        <input
          type="text"
          value={article.slug}
          onChange={(e) => update({ slug: slugify(e.target.value) })}
        />
        <span className="hint">{articleUrl(site, article)}</span>
      </Field>

      <Field label="Language">
        <span className="badge badge-lang">{LANG_LABEL[article.lang]}</span>
      </Field>
    </div>
  );
}

function StateSelector({ value, onChange }: { value: PubState; onChange: (v: PubState) => void }) {
  return (
    <div className="row">
      <span className="field-label">Publication</span>
      <Segmented
        ariaLabel="Publication state"
        value={value}
        onChange={onChange}
        options={[
          { value: "draft", label: STATE_LABEL.draft },
          { value: "published", label: STATE_LABEL.published },
          { value: "unlisted", label: STATE_LABEL.unlisted },
        ]}
      />
      <Info label="publication states">
        <strong>Draft</strong> is yours alone — it is left out of the exported website.{" "}
        <strong>Published</strong> appears on the website and in automatic lists.{" "}
        <strong>Unlisted</strong> is on the website but only reachable through a link you add
        yourself.
        <br />
        <br />
        Changing this does not touch the live website. Your visitors see the change after you export
        the website and upload it again.
      </Info>
    </div>
  );
}

/* ---------------- the workspace ---------------- */

export function Workspace(props: WorkspaceProps) {
  const { site, setSite, target, onBack, onOpen, createTag, toast, isPhone } = props;
  const [drill, setDrill] = useState<Drill>({ kind: "outline" });
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(target);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    setDrill({ kind: "outline" });
    setPreviewTarget(target);
  }, [target]);

  const page = target.kind === "page" ? site.pages.find((p) => p.id === target.id) : undefined;
  const article =
    target.kind === "article" ? site.articles.find((a) => a.id === target.id) : undefined;
  const content = page ?? article;
  const lang: Lang = content?.lang ?? site.defaultLang;

  const blocks = content?.blocks ?? [];

  const setBlocks = (next: Block[]) =>
    setSite((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === target.id && target.kind === "page" ? { ...p, blocks: next } : p,
      ),
      articles: s.articles.map((a) =>
        a.id === target.id && target.kind === "article" ? { ...a, blocks: next } : a,
      ),
    }));

  const updateArticle = (patch: Partial<Article>) =>
    setSite((s) => ({
      ...s,
      articles: s.articles.map((a) => (a.id === target.id ? { ...a, ...patch } : a)),
    }));

  const updatePage = (patch: Partial<Page>) =>
    setSite((s) => ({
      ...s,
      pages: s.pages.map((p) => (p.id === target.id ? { ...p, ...patch } : p)),
    }));

  /** Warn when a "By tag" list has just become empty (issue #97's author toast). */
  const warnIfEmptied = (
    before: ListConfig,
    after: ListConfig,
    listLang: Lang,
    excludeId?: string,
  ) => {
    if (after.mode !== "tag") return;
    const wasEmpty = matchesByTag(site, before, listLang, excludeId).length === 0;
    const nowEmpty = matchesByTag(site, after, listLang, excludeId).length === 0;
    if (!wasEmpty && nowEmpty)
      toast(
        "That list no longer matches any article. The website will show “No articles yet.”",
        "warn",
      );
  };

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBlocks(next);
  };

  const addBlock = (type: Block["type"]) => {
    const created: Block =
      type === "richText"
        ? { id: uid("blk"), type, html: "<p>Write here…</p>" }
        : type === "articleList"
          ? { id: uid("blk"), type, config: emptyListConfig("More articles") }
          : type === "heading"
            ? { id: uid("blk"), type, text: "New heading", level: 2 }
            : type === "cta"
              ? {
                  id: uid("blk"),
                  type,
                  text: "Come to our next event",
                  buttonLabel: "See the calendar",
                }
              : { id: uid("blk"), type, src: "uploaded-image.jpg", alt: "", caption: "" };
    setBlocks([...blocks, created]);
    setDrill({ kind: "block", id: created.id });
  };

  const activeBlock = drill.kind === "block" ? blocks.find((b) => b.id === drill.id) : undefined;
  const contentTitle = content?.title ?? "Missing content";

  const previewedIsTarget = previewTarget.kind === target.kind && previewTarget.id === target.id;
  const previewedTitle = useMemo(() => {
    if (previewTarget.kind === "page")
      return site.pages.find((p) => p.id === previewTarget.id)?.title ?? "";
    return site.articles.find((a) => a.id === previewTarget.id)?.title ?? "";
  }, [previewTarget, site]);

  if (!content) return <div className="page-pad">This content no longer exists.</div>;

  const editPane = (
    <div className="edit-pane" data-hidden={isPhone && mobileTab !== "edit"}>
      <div className="pane-bar">
        {drill.kind === "outline" ? (
          <button className="back-btn" onClick={onBack}>
            <span aria-hidden="true">←</span>
            <span className="truncate">
              {target.kind === "page" ? "All pages" : "All articles"}
            </span>
          </button>
        ) : (
          <button
            className="back-btn"
            onClick={() => setDrill({ kind: "outline" })}
            title={`Back to “${contentTitle}”`}
          >
            <span aria-hidden="true">←</span>
            <span className="truncate">Back to “{contentTitle}”</span>
          </button>
        )}
        <span className="topbar-spacer" />
        {article && <StateBadge state={article.state} />}
        <LangBadge lang={lang} />
      </div>

      <div className="pane-body stack">
        {drill.kind === "outline" && (
          <>
            <div className="field title-field">
              <span className="field-label">{article ? "Article title" : "Page title"}</span>
              <input
                type="text"
                value={content.title}
                aria-label={article ? "Article title" : "Page title"}
                onChange={(e) =>
                  article
                    ? updateArticle({ title: e.target.value })
                    : updatePage({ title: e.target.value })
                }
              />
              <span className="hint">
                {article ? articleUrl(site, article) : pageUrl(site, page!)}
              </span>
            </div>

            {article && (
              <div className="card">
                <StateSelector
                  value={article.state}
                  onChange={(state) => updateArticle({ state })}
                />
              </div>
            )}

            <button
              className="list-row"
              onClick={() => setDrill({ kind: "settings" })}
              style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-card)" }}
            >
              <span className="list-row-main">
                <span className="list-row-title">
                  {article ? "Article settings" : "Page settings"}
                </span>
                <span className="meta">
                  {article
                    ? "Summary, cover image, publication date, tags, web address"
                    : "Menu label, web address, search preview"}
                </span>
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </button>

            <BlockOutline
              site={site}
              blocks={blocks}
              onOpenBlock={(id) => setDrill({ kind: "block", id })}
              onReorder={reorder}
              onAdd={addBlock}
              onRemove={(id) => setBlocks(blocks.filter((b) => b.id !== id))}
            />

            {article && (
              <div className="card stack">
                <div className="row-between">
                  <span className="field-label">
                    Related articles
                    <Info label="related articles">
                      A single list shown at the end of this article. Turn it off and your settings
                      are kept — the list simply stops appearing on the website.
                    </Info>
                  </span>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={article.related.enabled}
                      onChange={(e) =>
                        updateArticle({
                          related: { ...article.related, enabled: e.target.checked },
                        })
                      }
                    />
                    <span>{article.related.enabled ? "On" : "Off"}</span>
                  </label>
                </div>
                {article.related.enabled ? (
                  <button className="btn btn-sm" onClick={() => setDrill({ kind: "related" })}>
                    Configure the related list →
                  </button>
                ) : (
                  <span className="hint">
                    Off.{" "}
                    {article.related.config.tagIds.length +
                      article.related.config.articleIds.length >
                    0
                      ? "Settings kept."
                      : ""}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {drill.kind === "settings" && (
          <>
            <div className="inspector-header">
              <div className="kicker">{article ? "Article settings" : "Page settings"}</div>
              <h2 className="h2">{contentTitle}</h2>
            </div>
            {article ? (
              <div className="stack">
                <StateSelector
                  value={article.state}
                  onChange={(state) => updateArticle({ state })}
                />
                <ArticleSettings
                  site={site}
                  article={article}
                  update={updateArticle}
                  createTag={createTag}
                />
              </div>
            ) : (
              <div className="stack">
                <Field label="Web address">
                  <input
                    type="text"
                    value={page!.slug}
                    onChange={(e) => updatePage({ slug: slugify(e.target.value) })}
                  />
                  <span className="hint">{pageUrl(site, page!)}</span>
                </Field>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={page!.showInNav}
                    onChange={(e) => updatePage({ showInNav: e.target.checked })}
                  />
                  <span>Show this page in the website menu</span>
                </label>
              </div>
            )}
          </>
        )}

        {drill.kind === "related" && article && (
          <>
            <div className="inspector-header">
              <div className="kicker">Related articles</div>
              <h2 className="h2">
                {contentTitle}{" "}
                <Info label="the related list">
                  This list is shown at the end of the article. “By tag” never includes the article
                  itself; you can still select it explicitly.
                </Info>
              </h2>
            </div>
            <ListConfigEditor
              site={site}
              config={article.related.config}
              lang={lang}
              excludeId={article.id}
              onCreateTag={createTag}
              onChange={(config) => {
                warnIfEmptied(article.related.config, config, lang, article.id);
                updateArticle({ related: { ...article.related, config } });
              }}
              onOpenArticle={(id) => onOpen({ kind: "article", id })}
            />
          </>
        )}

        {drill.kind === "block" && activeBlock && (
          <>
            <div className="inspector-header">
              <div className="kicker">{BLOCK_LABEL[activeBlock.type]}</div>
              <h2 className="h2">{contentTitle}</h2>
            </div>
            <BlockInspector
              site={site}
              block={activeBlock}
              lang={lang}
              excludeId={article?.id}
              createTag={createTag}
              onOpen={onOpen}
              onChange={(next) => {
                if (activeBlock.type === "articleList" && next.type === "articleList")
                  warnIfEmptied(activeBlock.config, next.config, lang, article?.id);
                setBlocks(blocks.map((b) => (b.id === next.id ? next : b)));
              }}
            />
          </>
        )}

        {drill.kind === "block" && !activeBlock && <p>That block was removed.</p>}
      </div>
    </div>
  );

  const previewPane = (
    <div className="preview-pane" data-hidden={isPhone && mobileTab !== "preview"}>
      <div className="pane-bar">
        <span className="kicker">
          Preview{" "}
          <Info label="the preview">
            Links and cards here behave like the real website, so you can click through it the way a
            visitor would. Use “Edit this Page/Article” to open whatever you are looking at.
          </Info>
        </span>
        <span className="meta truncate">{previewedTitle}</span>
        <span className="topbar-spacer" />
        {!previewedIsTarget && (
          <button className="btn btn-sm" onClick={() => setPreviewTarget(target)}>
            Back to this {target.kind}
          </button>
        )}
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            onOpen(previewTarget);
            if (isPhone) setMobileTab("edit");
          }}
        >
          Edit this {previewTarget.kind === "page" ? "Page" : "Article"}
        </button>
      </div>
      <PublicPreview site={site} target={previewTarget} onNavigate={setPreviewTarget} />
    </div>
  );

  return (
    <div className="workspace">
      {isPhone && (
        <div className="mobile-tabs">
          <Segmented
            ariaLabel="Show editing or preview"
            value={mobileTab}
            onChange={setMobileTab}
            options={[
              { value: "edit", label: "Edit" },
              { value: "preview", label: "Preview" },
            ]}
          />
        </div>
      )}
      {editPane}
      {previewPane}
    </div>
  );
}

/* Re-exported for the Articles list screen. */
export { ArticleCard, formatDate };
