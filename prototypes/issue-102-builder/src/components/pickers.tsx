/** THROWAWAY prototype (issue #102) — tag picker, Article card, Article-list config. */
import { useMemo, useState } from "react";
import {
  LANG_LABEL,
  type Article,
  type Lang,
  type ListConfig,
  type Site,
  type Tag,
  resolveList,
} from "../model";
import { Field, Info, LangBadge, Segmented, StateBadge, formatDate } from "./ui";

/* ---------------- searchable tag picker with inline create ---------------- */

export function TagPicker({
  site,
  selected,
  onChange,
  onCreateTag,
  label,
  info,
}: {
  site: Site;
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreateTag: (label: string) => Tag | null;
  label: string;
  info?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = site.tags.filter((t) => t.label.toLowerCase().includes(q));
  const exact = site.tags.some((t) => t.label.trim().toLowerCase() === q);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="field">
      <span className="field-label">
        {label}
        {info && <Info label={label.toLowerCase()}>{info}</Info>}
      </span>
      {selected.length > 0 && (
        <div className="chips" style={{ marginBottom: 4 }}>
          {selected.map((id) => {
            const tag = site.tags.find((t) => t.id === id);
            return (
              <span className="chip" data-on="true" key={id}>
                {tag?.label ?? "(deleted)"}
                <button
                  className="chip-x"
                  onClick={() => toggle(id)}
                  aria-label={`Remove tag ${tag?.label ?? id}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      <input
        type="search"
        value={query}
        placeholder="Search tags, or type a new one"
        aria-label={`Search ${label.toLowerCase()}`}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips" style={{ marginTop: 6 }}>
        {matches.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            data-on={selected.includes(t.id)}
            aria-pressed={selected.includes(t.id)}
            onClick={() => toggle(t.id)}
          >
            {t.label}
          </button>
        ))}
        {q && !exact && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const created = onCreateTag(query.trim());
              if (created) onChange([...selected, created.id]);
              setQuery("");
            }}
          >
            + Create tag “{query.trim()}”
          </button>
        )}
        {matches.length === 0 && !q && <span className="hint">No tags yet.</span>}
      </div>
    </div>
  );
}

/* ---------------- Article placement card ---------------- */

export function ArticleCard({
  site,
  article,
  onOpen,
  showState = true,
}: {
  site: Site;
  article: Article;
  onOpen?: () => void;
  showState?: boolean;
}) {
  const inner = (
    <>
      <span className="cover" aria-hidden="true">
        {article.cover ? "🖼" : "📄"}
      </span>
      <span className="list-row-main">
        <span style={{ display: "block", fontWeight: 600 }}>{article.title}</span>
        <span className="small muted" style={{ display: "block" }}>
          {formatDate(article.date)}
          {article.summary ? ` — ${article.summary}` : ""}
        </span>
        <span className="row" style={{ gap: 4, marginTop: 4 }}>
          <LangBadge lang={article.lang} />
          {showState && <StateBadge state={article.state} />}
          {article.tagIds.map((id) => (
            <span className="badge" key={id}>
              {site.tags.find((t) => t.id === id)?.label ?? "(deleted tag)"}
            </span>
          ))}
        </span>
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" className="article-card" onClick={onOpen}>
      {inner}
    </button>
  ) : (
    <div className="article-card">{inner}</div>
  );
}

/* ---------------- Article-list configuration (shared) ---------------- */

export function ListConfigEditor({
  site,
  config,
  lang,
  excludeId,
  onChange,
  onCreateTag,
  onOpenArticle,
}: {
  site: Site;
  config: ListConfig;
  lang: Lang;
  excludeId?: string;
  onChange: (next: ListConfig) => void;
  onCreateTag: (label: string) => Tag | null;
  onOpenArticle?: (id: string) => void;
}) {
  const [pickerQuery, setPickerQuery] = useState("");
  const matches = useMemo(
    () => resolveList(site, config, lang, excludeId),
    [site, config, lang, excludeId],
  );

  const set = (patch: Partial<ListConfig>) => onChange({ ...config, ...patch });

  const move = (index: number, delta: number) => {
    const next = [...config.articleIds];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    set({ articleIds: next });
  };

  const candidates = site.articles
    .filter((a) => a.id !== excludeId)
    .filter((a) => !config.articleIds.includes(a.id))
    .filter((a) => a.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  return (
    <div className="stack">
      <Field label="List heading">
        <input
          type="text"
          value={config.heading}
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>

      <div className="field">
        <span className="field-label">
          How articles are chosen
          <Info label="how articles are chosen">
            <strong>By tag</strong> keeps the list up to date on its own: it shows Published
            articles in this content’s language, newest first. <strong>Select articles</strong> lets
            you pick exact articles and put them in the order you want, including Unlisted ones.
          </Info>
        </span>
        <Segmented
          ariaLabel="How articles are chosen"
          value={config.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "tag", label: "By tag" },
            { value: "select", label: "Select articles" },
          ]}
        />
      </div>

      {config.mode === "tag" ? (
        <>
          <TagPicker
            site={site}
            label="Tags"
            selected={config.tagIds}
            onChange={(tagIds) => set({ tagIds })}
            onCreateTag={onCreateTag}
            info={
              <>
                An article is shown if it has <strong>any one</strong> of the selected tags — it
                does not need all of them. Only Published articles in {LANG_LABEL[lang]} appear,
                newest first.
              </>
            }
          />
          {config.tagIds.length === 0 && (
            <p className="hint">
              No tags selected — every eligible article is shown.{" "}
              <Info label="no tags selected">
                With no tags selected this list shows <strong>all</strong> Published articles in{" "}
                {LANG_LABEL[lang]}, newest first. Select one or more tags to narrow it down.
              </Info>
            </p>
          )}
        </>
      ) : (
        <div className="stack">
          <div className="field">
            <span className="field-label">
              Chosen articles ({config.articleIds.length})
              <Info label="chosen articles">
                These articles appear in exactly this order. Unlisted articles can be selected here
                — that is how you link to them. If a selected article becomes a Draft or is deleted,
                exporting the website is blocked until you fix the selection.
              </Info>
            </span>
            {config.articleIds.length === 0 && (
              <div className="empty">Nothing selected yet. Search below to add articles.</div>
            )}
            <div className="list">
              {config.articleIds.map((id, i) => {
                const a = site.articles.find((x) => x.id === id);
                return (
                  <div
                    className="list-row"
                    key={id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      if (Number.isNaN(from) || from === i) return;
                      const next = [...config.articleIds];
                      const [moved] = next.splice(from, 1);
                      next.splice(i, 0, moved);
                      set({ articleIds: next });
                    }}
                  >
                    <span className="drag-handle" aria-hidden="true" title="Drag to reorder">
                      ⠿
                    </span>
                    <span className="list-row-main">
                      <span className="list-row-title">
                        {a ? a.title : "Article no longer exists"}
                      </span>
                      <span className="row" style={{ gap: 4 }}>
                        {a && <LangBadge lang={a.lang} />}
                        {a ? (
                          <StateBadge state={a.state} />
                        ) : (
                          <span className="badge badge-draft">Missing</span>
                        )}
                      </span>
                    </span>
                    <button
                      className="btn btn-sm btn-icon"
                      onClick={() => move(i, -1)}
                      aria-label={`Move ${a?.title ?? "item"} up`}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-sm btn-icon"
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${a?.title ?? "item"} down`}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => set({ articleIds: config.articleIds.filter((x) => x !== id) })}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Add an article">
            <input
              type="search"
              value={pickerQuery}
              placeholder="Search articles by title"
              onChange={(e) => setPickerQuery(e.target.value)}
              aria-label="Search articles to add"
            />
          </Field>
          <div className="list">
            {candidates.slice(0, 6).map((a) => (
              <button
                key={a.id}
                className="list-row"
                onClick={() => {
                  set({ articleIds: [...config.articleIds, a.id] });
                  setPickerQuery("");
                }}
              >
                <span className="list-row-main">
                  <span className="list-row-title">{a.title}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <LangBadge lang={a.lang} />
                    <StateBadge state={a.state} />
                    <span className="small muted">{formatDate(a.date)}</span>
                  </span>
                </span>
                <span className="badge">Add</span>
              </button>
            ))}
            {candidates.length === 0 && <div className="list-row muted">No articles match.</div>}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">
          Articles in this list right now ({matches.length})
          <Info label="this list’s contents">
            These are the cards a visitor would see, in this order. If nothing matches, the website
            keeps the heading and shows “No articles yet.” Drafts never appear on the website.
          </Info>
        </span>
        {matches.length === 0 ? (
          <div className="empty">Nothing matches yet.</div>
        ) : (
          <div className="card-grid">
            {matches.map((a) => (
              <ArticleCard
                key={a.id}
                site={site}
                article={a}
                onOpen={onOpenArticle ? () => onOpenArticle(a.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
