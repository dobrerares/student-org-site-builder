/** THROWAWAY prototype (issue #102) — overview, lists, tags, theme, settings, export. */
import { useMemo, useState } from "react";
import {
  LANG_LABEL,
  STATE_LABEL,
  computeFindings,
  type Finding,
  type Lang,
  type PubState,
  type Site,
} from "../model";
import type { PreviewTarget } from "./preview";
import { Dialog, Field, Info, LangBadge, Segmented, StateBadge, formatDate } from "./ui";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------------- content overview ---------------- */

export function Overview({
  site,
  onOpen,
  onGo,
  onCreatePage,
  onCreateArticle,
  findings,
}: {
  site: Site;
  onOpen: (t: PreviewTarget) => void;
  onGo: (screen: "pages" | "articles" | "theme" | "settings") => void;
  onCreatePage: () => void;
  onCreateArticle: () => void;
  findings: Finding[];
}) {
  const counts = (state: PubState) => site.articles.filter((a) => a.state === state).length;
  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");

  return (
    <div className="page-pad stack">
      <div>
        <div className="eyebrow">Site</div>
        <h1 style={{ fontSize: "var(--step-4)" }}>{site.name}</h1>
        <p className="muted">
          {LANG_LABEL[site.defaultLang]} and{" "}
          {site.languages
            .filter((l) => l !== site.defaultLang)
            .map((l) => LANG_LABEL[l])
            .join(", ")}{" "}
          · Theme: {site.theme}
        </p>
      </div>

      <div className="grid-2">
        <section className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Pages</h2>
            <span className="badge">{site.pages.length}</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            The fixed parts of your website: home, about, join, and any listing page you build.
          </p>
          <div className="list">
            {site.pages.slice(0, 4).map((p) => (
              <button
                key={p.id}
                className="list-row"
                onClick={() => onOpen({ kind: "page", id: p.id })}
              >
                <span className="list-row-main">
                  <span className="list-row-title">{p.title}</span>
                  <span className="small muted">{p.blocks.length} blocks</span>
                </span>
                <LangBadge lang={p.lang} />
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={onCreatePage}>
              Create Page
            </button>
            <button className="btn" onClick={() => onGo("pages")}>
              All pages
            </button>
          </div>
        </section>

        <section className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Articles</h2>
            <span className="badge">{site.articles.length}</span>
          </div>
          <div className="row">
            <span className="badge badge-published">{counts("published")} Published</span>
            <span className="badge badge-draft">{counts("draft")} Draft</span>
            <span className="badge badge-unlisted">{counts("unlisted")} Unlisted</span>
          </div>
          <div className="list">
            {[...site.articles]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 4)
              .map((a) => (
                <button
                  key={a.id}
                  className="list-row"
                  onClick={() => onOpen({ kind: "article", id: a.id })}
                >
                  <span className="list-row-main">
                    <span className="list-row-title">{a.title}</span>
                    <span className="small muted">{formatDate(a.date)}</span>
                  </span>
                  <LangBadge lang={a.lang} />
                  <StateBadge state={a.state} />
                </button>
              ))}
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={onCreateArticle}>
              Create Article
            </button>
            <button className="btn" onClick={() => onGo("articles")}>
              All articles
            </button>
          </div>
        </section>
      </div>

      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>
            Site Health{" "}
            <Info label="site health">
              Everything the builder has noticed about this project. Errors marked “blocks export”
              must be fixed before you can export the website; warnings are advice you can act on
              whenever you like. Saving your project always works.
            </Info>
          </h2>
          <span className={`badge ${errors.length ? "badge-draft" : "badge-published"}`}>
            {errors.length === 0 && warnings.length === 0
              ? "All good"
              : `${errors.length} to fix · ${warnings.length} to look at`}
          </span>
        </div>
        <FindingList findings={findings} onOpen={onOpen} />
      </section>

      <div className="row">
        <button className="btn" onClick={() => onGo("theme")}>
          Theme
        </button>
        <button className="btn" onClick={() => onGo("settings")}>
          Site settings
        </button>
      </div>
    </div>
  );
}

export function FindingList({
  findings,
  onOpen,
}: {
  findings: Finding[];
  onOpen: (t: PreviewTarget) => void;
}) {
  if (findings.length === 0) return <div className="empty">Nothing needs your attention.</div>;
  return (
    <div className="stack" style={{ gap: "var(--sp-1)" }}>
      {findings.map((f) => (
        <div className="finding" data-sev={f.severity} key={f.id}>
          <span aria-hidden="true">{f.severity === "error" ? "✕" : "⚠"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>
              <strong>{f.message}</strong> <Info label="this problem">{f.detail}</Info>
            </div>
            <div className="small muted">
              {f.blocksExport ? "Blocks exporting the website." : "Does not block exporting."}
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => onOpen({ kind: f.where.kind, id: f.where.id })}
          >
            Fix
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- pages list ---------------- */

export function PagesScreen({
  site,
  onOpen,
  onCreatePage,
}: {
  site: Site;
  onOpen: (t: PreviewTarget) => void;
  onCreatePage: () => void;
}) {
  const [query, setQuery] = useState("");
  const rows = site.pages.filter((p) => p.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="page-pad stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>Pages</h1>
        <button className="btn btn-primary" onClick={onCreatePage}>
          Create Page
        </button>
      </div>
      <input
        type="search"
        placeholder="Search pages"
        aria-label="Search pages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="list">
        {rows.map((p) => (
          <button
            key={p.id}
            className="list-row"
            onClick={() => onOpen({ kind: "page", id: p.id })}
          >
            <span className="list-row-main">
              <span className="list-row-title">{p.title}</span>
              <span className="small muted">
                {p.blocks.length} blocks {p.showInNav ? "· in the menu" : "· not in the menu"}
              </span>
            </span>
            <LangBadge lang={p.lang} />
            <span aria-hidden="true">›</span>
          </button>
        ))}
        {rows.length === 0 && <div className="list-row muted">No pages match “{query}”.</div>}
      </div>
    </div>
  );
}

/* ---------------- articles list ---------------- */

export function ArticlesScreen({
  site,
  onOpen,
  onCreateArticle,
  onManageTags,
}: {
  site: Site;
  onOpen: (t: PreviewTarget) => void;
  onCreateArticle: () => void;
  onManageTags: () => void;
}) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang | "all">("all");
  const [state, setState] = useState<PubState | "all">("all");
  const [tag, setTag] = useState<string>("all");

  const rows = useMemo(
    () =>
      [...site.articles]
        .sort((a, b) => b.date.localeCompare(a.date))
        .filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase()))
        .filter((a) => lang === "all" || a.lang === lang)
        .filter((a) => state === "all" || a.state === state)
        .filter((a) => tag === "all" || a.tagIds.includes(tag)),
    [site.articles, query, lang, state, tag],
  );

  return (
    <div className="page-pad stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>Articles</h1>
        <div className="row">
          <button className="btn" onClick={onManageTags}>
            Manage tags
          </button>
          <button className="btn btn-primary" onClick={onCreateArticle}>
            Create Article
          </button>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search articles by title"
        aria-label="Search articles"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="filters">
        <Field label="Language">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang | "all")}
            aria-label="Filter by language"
          >
            <option value="all">All languages</option>
            {site.languages.map((l) => (
              <option key={l} value={l}>
                {LANG_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Publication state">
          <select
            value={state}
            onChange={(e) => setState(e.target.value as PubState | "all")}
            aria-label="Filter by publication state"
          >
            <option value="all">All states</option>
            {(["draft", "published", "unlisted"] as PubState[]).map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="all">All tags</option>
            {site.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="btn"
          onClick={() => {
            setQuery("");
            setLang("all");
            setState("all");
            setTag("all");
          }}
        >
          Clear filters
        </button>
      </div>

      <p className="hint">
        {rows.length} of {site.articles.length} articles
      </p>

      <div className="list">
        {rows.map((a) => (
          <button
            key={a.id}
            className="list-row"
            onClick={() => onOpen({ kind: "article", id: a.id })}
          >
            <span className="list-row-main">
              <span className="list-row-title">{a.title}</span>
              <span className="row" style={{ gap: 4 }}>
                {a.tagIds.map((id) => (
                  <span className="badge" key={id}>
                    {site.tags.find((t) => t.id === id)?.label ?? "(deleted tag)"}
                  </span>
                ))}
              </span>
            </span>
            <LangBadge lang={a.lang} />
            <StateBadge state={a.state} />
            <span className="small muted" style={{ minWidth: 92, textAlign: "right" }}>
              {formatDate(a.date)}
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="list-row muted">
            No articles match these filters. Try clearing one of them.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- manage tags ---------------- */

export function TagsScreen({
  site,
  setSite,
  onBack,
  toast,
}: {
  site: Site;
  setSite: (fn: (s: Site) => Site) => void;
  onBack: () => void;
  toast: (t: string, k?: "ok" | "warn" | "info") => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const norm = (s: string) => s.trim().toLowerCase();
  const duplicate = (label: string, exceptId?: string) =>
    site.tags.some((t) => t.id !== exceptId && norm(t.label) === norm(label));

  const usage = (id: string) => site.articles.filter((a) => a.tagIds.includes(id));

  /** Lists (page blocks, article blocks, related lists) that filter on this tag. */
  const listsUsing = (id: string) => {
    const out: { where: string; willShowAll: boolean }[] = [];
    const check = (where: string, tagIds: string[], mode: string) => {
      if (mode !== "tag" || !tagIds.includes(id)) return;
      out.push({ where, willShowAll: tagIds.length === 1 });
    };
    for (const p of site.pages)
      for (const b of p.blocks)
        if (b.type === "articleList")
          check(`${p.title} — “${b.config.heading}”`, b.config.tagIds, b.config.mode);
    for (const a of site.articles) {
      for (const b of a.blocks)
        if (b.type === "articleList")
          check(`${a.title} — “${b.config.heading}”`, b.config.tagIds, b.config.mode);
      if (a.related.enabled)
        check(`${a.title} — related articles`, a.related.config.tagIds, a.related.config.mode);
    }
    return out;
  };

  const doDelete = (id: string) => {
    const label = site.tags.find((t) => t.id === id)?.label ?? "";
    setSite((s) => ({
      ...s,
      tags: s.tags.filter((t) => t.id !== id),
      articles: s.articles.map((a) => ({
        ...a,
        tagIds: a.tagIds.filter((t) => t !== id),
        related: {
          ...a.related,
          config: { ...a.related.config, tagIds: a.related.config.tagIds.filter((t) => t !== id) },
        },
        blocks: a.blocks.map((b) =>
          b.type === "articleList"
            ? { ...b, config: { ...b.config, tagIds: b.config.tagIds.filter((t) => t !== id) } }
            : b,
        ),
      })),
      pages: s.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.type === "articleList"
            ? { ...b, config: { ...b.config, tagIds: b.config.tagIds.filter((t) => t !== id) } }
            : b,
        ),
      })),
    }));
    setDeleting(null);
    toast(`Tag “${label}” deleted and removed from every article and list.`, "warn");
  };

  const deletingTag = site.tags.find((t) => t.id === deleting);
  const renamingTag = site.tags.find((t) => t.id === renaming);

  return (
    <div className="page-pad stack">
      <button className="back-btn" onClick={onBack}>
        ← All articles
      </button>
      <h1 style={{ fontSize: "var(--step-3)" }}>
        Manage tags{" "}
        <Info label="tags">
          Tags belong to the whole site and are shared across languages. Renaming one updates its
          name everywhere and keeps every article and list filter as it is.
        </Info>
      </h1>

      <div className="list">
        {site.tags.map((t) => (
          <div className="list-row" key={t.id}>
            <span className="list-row-main">
              <span className="list-row-title">{t.label}</span>
              <span className="small muted">
                {plural(usage(t.id).length, "article")} · {plural(listsUsing(t.id).length, "list")}{" "}
                filter on it
              </span>
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                setRenaming(t.id);
                setDraftLabel(t.label);
              }}
            >
              Rename
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setDeleting(t.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card row" style={{ alignItems: "flex-end" }}>
        <Field label="New tag">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Sports"
          />
        </Field>
        <button
          className="btn"
          disabled={!newLabel.trim()}
          onClick={() => {
            if (duplicate(newLabel)) {
              toast(`A tag called “${newLabel.trim()}” already exists.`, "warn");
              return;
            }
            setSite((s) => ({
              ...s,
              tags: [
                ...s.tags,
                { id: `tag-${norm(newLabel).replace(/\s+/g, "-")}`, label: newLabel.trim() },
              ],
            }));
            setNewLabel("");
          }}
        >
          Add tag
        </button>
      </div>

      {renamingTag && (
        <Dialog
          title={`Rename “${renamingTag.label}”`}
          onClose={() => setRenaming(null)}
          actions={
            <>
              <button className="btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!draftLabel.trim()}
                onClick={() => {
                  if (duplicate(draftLabel, renamingTag.id)) {
                    toast(
                      `A tag called “${draftLabel.trim()}” already exists. Names that differ only in capitalisation or spacing count as the same tag.`,
                      "warn",
                    );
                    return;
                  }
                  setSite((s) => ({
                    ...s,
                    tags: s.tags.map((t) =>
                      t.id === renamingTag.id ? { ...t, label: draftLabel.trim() } : t,
                    ),
                  }));
                  setRenaming(null);
                  toast("Tag renamed everywhere. Articles and list filters are unchanged.", "ok");
                }}
              >
                Rename tag
              </button>
            </>
          }
        >
          <Field
            label="Tag name"
            info="Names that differ only in capitalisation or surrounding spaces count as the same tag. Your capitalisation is kept for display."
          >
            <input type="text" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
          </Field>
          <p className="hint">
            Used by {plural(usage(renamingTag.id).length, "article")} and{" "}
            {plural(listsUsing(renamingTag.id).length, "list")}. Both keep working.
          </p>
        </Dialog>
      )}

      {deletingTag && (
        <Dialog
          title={`Delete “${deletingTag.label}”?`}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => doDelete(deletingTag.id)}>
                Delete tag
              </button>
            </>
          }
        >
          <div className="stack">
            <p>
              This tag is on <strong>{plural(usage(deletingTag.id).length, "article")}</strong>.
              Deleting it removes the tag from all of them. The articles themselves are not deleted.
            </p>
            {listsUsing(deletingTag.id).length > 0 && (
              <div className="finding" data-sev="warning">
                <span aria-hidden="true">⚠</span>
                <div>
                  <strong>
                    {plural(listsUsing(deletingTag.id).length, "article list")} filter on this tag:
                  </strong>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    {listsUsing(deletingTag.id).map((l) => (
                      <li key={l.where} className="small">
                        {l.where}
                        {l.willShowAll && (
                          <>
                            {" "}
                            —{" "}
                            <strong>
                              this is its only tag, so the list will show every eligible article.
                            </strong>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    Lists that keep other tags carry on matching any of those.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- theme + site settings ---------------- */

export function ThemeScreen({
  site,
  setSite,
}: {
  site: Site;
  setSite: (fn: (s: Site) => Site) => void;
}) {
  const themes = ["Modern", "Editorial", "Civic", "Minimal", "Academic"];
  return (
    <div className="page-pad stack">
      <h1 style={{ fontSize: "var(--step-3)" }}>Theme</h1>
      <p className="muted">
        The look of the whole website. Changes show in every preview straight away.
      </p>
      <div className="card stack">
        <Field label="Theme">
          <select
            value={site.theme}
            onChange={(e) => setSite((s) => ({ ...s, theme: e.target.value }))}
          >
            {themes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Accent colour"
          info="One accent colour is used for links, buttons and highlights across the website."
        >
          <div className="row">
            {["#0f766e", "#1d4ed8", "#9d174d", "#b45309"].map((c) => (
              <button
                key={c}
                className="btn btn-sm"
                aria-pressed={site.accent === c}
                onClick={() => {
                  setSite((s) => ({ ...s, accent: c }));
                  document.documentElement.style.setProperty("--accent", c);
                }}
                style={{
                  background: c,
                  color: "#fff",
                  borderColor: c,
                  outline: site.accent === c ? "2px solid var(--ink)" : undefined,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

export function SettingsScreen({
  site,
  setSite,
}: {
  site: Site;
  setSite: (fn: (s: Site) => Site) => void;
}) {
  return (
    <div className="page-pad stack">
      <h1 style={{ fontSize: "var(--step-3)" }}>Site settings</h1>
      <div className="card stack">
        <Field label="Organisation name">
          <input
            type="text"
            value={site.name}
            onChange={(e) => setSite((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>
        <Field
          label="Main language"
          info="Pages and articles in the main language sit at the top level of the website; other languages get a language prefix such as /ro/."
        >
          <Segmented
            ariaLabel="Main language"
            value={site.defaultLang}
            onChange={(defaultLang) => setSite((s) => ({ ...s, defaultLang }))}
            options={site.languages.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
          />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- export readiness ---------------- */

export function ExportDialog({
  site,
  onClose,
  onExported,
  onOpen,
}: {
  site: Site;
  onClose: () => void;
  onExported: () => void;
  onOpen: (t: PreviewTarget) => void;
}) {
  const findings = computeFindings(site);
  const blockers = findings.filter((f) => f.blocksExport);
  const warnings = findings.filter((f) => !f.blocksExport);

  return (
    <Dialog
      title="Export website"
      wide
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={blockers.length > 0}
            onClick={() => {
              onExported();
              onClose();
            }}
          >
            Export website
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          Builds the public website as a folder you can upload.{" "}
          <Info label="exporting">
            Exporting downloads files to this computer. It does <strong>not</strong> update the
            website your visitors see — you still have to upload the exported folder to your
            hosting. Drafts are never part of the export.
          </Info>
        </p>

        {blockers.length > 0 ? (
          <>
            <h3 style={{ fontSize: "var(--step-1)" }}>Fix these first ({blockers.length})</h3>
            <FindingList
              findings={blockers}
              onOpen={(t) => {
                onClose();
                onOpen(t);
              }}
            />
          </>
        ) : (
          <div className="finding" data-sev="warning" style={{ borderLeftColor: "var(--ok)" }}>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Ready to export.</strong>
              <div className="small muted">
                {site.articles.filter((a) => a.state !== "draft").length} articles and{" "}
                {site.pages.length} pages will be written out.{" "}
                {site.articles.filter((a) => a.state === "draft").length} drafts stay behind.
              </div>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <>
            <h3 style={{ fontSize: "var(--step-1)" }}>
              Worth a look ({warnings.length}){" "}
              <Info label="warnings">
                These do not stop the export. Fix them when you have time.
              </Info>
            </h3>
            <FindingList
              findings={warnings}
              onOpen={(t) => {
                onClose();
                onOpen(t);
              }}
            />
          </>
        )}

        <p className="hint" style={{ margin: 0 }}>
          Saving your project is always available, even while there are problems here.
        </p>
      </div>
    </Dialog>
  );
}
