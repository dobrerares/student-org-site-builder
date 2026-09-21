/** THROWAWAY prototype (issue #102) — a fake "public website" preview you can click through. */
import type { Block, Lang, ListConfig, Site } from "../model";
import { resolveList } from "../model";
import { formatDate } from "./ui";

export type PreviewTarget = { kind: "page" | "article"; id: string };

/** Drop links whose target is missing or still a Draft, matching the public output rule. */
function publicHtml(site: Site, html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  doc.querySelectorAll("a[data-target]").forEach((a) => {
    const target = a.getAttribute("data-target") ?? "";
    const [kind, id] = target.split(":");
    const ok =
      kind === "page"
        ? site.pages.some((p) => p.id === id)
        : site.articles.some((x) => x.id === id && x.state !== "draft");
    if (!ok) {
      const span = doc.createElement("span");
      span.textContent = a.textContent ?? "";
      a.replaceWith(span);
    }
  });
  return doc.body.firstElementChild?.innerHTML ?? html;
}

function ListView({
  site,
  config,
  lang,
  excludeId,
  onNavigate,
}: {
  site: Site;
  config: ListConfig;
  lang: Lang;
  excludeId?: string;
  onNavigate: (t: PreviewTarget) => void;
}) {
  const items = resolveList(site, config, lang, excludeId).filter((a) => a.state !== "draft");
  return (
    <section className="site-list">
      <h2>{config.heading}</h2>
      {items.length === 0 ? (
        <p className="site-meta">No articles yet.</p>
      ) : (
        <div className="card-grid">
          {items.map((a) => (
            <button
              key={a.id}
              className="site-card"
              onClick={() => onNavigate({ kind: "article", id: a.id })}
            >
              <span className="cover" aria-hidden="true" style={{ width: 44, height: 44 }}>
                {a.cover ? "🖼" : "¶"}
              </span>
              <span className="list-row-main">
                <span className="card-title">{a.title}</span>
                <span className="site-meta">{formatDate(a.date)}</span>
                {a.summary && <span>{a.summary}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {items.length > 3 && (
        <p className="site-meta">‹ › Arrow navigation reaches every matching article.</p>
      )}
    </section>
  );
}

function BlockView({
  site,
  block,
  lang,
  excludeId,
  onNavigate,
}: {
  site: Site;
  block: Block;
  lang: Lang;
  excludeId?: string;
  onNavigate: (t: PreviewTarget) => void;
}) {
  switch (block.type) {
    case "richText":
      return (
        <div
          onClick={(e) => {
            const a = (e.target as HTMLElement).closest("a[data-target]");
            if (!a) return;
            e.preventDefault();
            const [kind, id] = (a.getAttribute("data-target") ?? "").split(":");
            if (kind === "page" || kind === "article") onNavigate({ kind, id });
          }}
          dangerouslySetInnerHTML={{ __html: publicHtml(site, block.html) }}
        />
      );
    case "articleList":
      return (
        <ListView
          site={site}
          config={block.config}
          lang={lang}
          excludeId={excludeId}
          onNavigate={onNavigate}
        />
      );
    case "heading":
      return block.level === 2 ? <h2>{block.text}</h2> : <h3>{block.text}</h3>;
    case "cta":
      return (
        <div className="site-cta">
          <strong>{block.text}</strong>
          <span className="btn btn-primary">{block.buttonLabel}</span>
        </div>
      );
    case "image":
      return (
        <figure className="site-figure">
          <div className="cover" aria-label={block.alt} role="img">
            🖼 {block.src}
          </div>
          {block.caption && <figcaption className="site-meta">{block.caption}</figcaption>}
        </figure>
      );
  }
}

export function PublicPreview({
  site,
  target,
  onNavigate,
}: {
  site: Site;
  target: PreviewTarget;
  onNavigate: (t: PreviewTarget) => void;
}) {
  const page = target.kind === "page" ? site.pages.find((p) => p.id === target.id) : undefined;
  const article =
    target.kind === "article" ? site.articles.find((a) => a.id === target.id) : undefined;
  const lang: Lang = page?.lang ?? article?.lang ?? site.defaultLang;

  return (
    <div className="site">
      <nav className="site-nav" aria-label="Website menu">
        <span className="site-name">{site.name}</span>
        {site.pages
          .filter((p) => p.lang === lang && p.showInNav)
          .map((p) => (
            <button
              key={p.id}
              className="site-link"
              onClick={() => onNavigate({ kind: "page", id: p.id })}
            >
              {p.title}
            </button>
          ))}
      </nav>
      <div className="site-body">
        {page && (
          <>
            <h1>{page.title}</h1>
            {page.blocks.map((b) => (
              <BlockView key={b.id} site={site} block={b} lang={lang} onNavigate={onNavigate} />
            ))}
          </>
        )}
        {article && (
          <>
            {article.state !== "published" && (
              <span className={`badge badge-${article.state} site-state`}>
                {article.state === "draft"
                  ? "Draft — not on the public website yet"
                  : "Unlisted — reachable only by a direct link"}
              </span>
            )}
            {article.cover && (
              <div className="cover" role="img" aria-label={article.cover.alt}>
                🖼 {article.cover.src}
              </div>
            )}
            <h1>{article.title}</h1>
            <p className="site-meta">{formatDate(article.date)}</p>
            {article.summary && <p className="site-lede">{article.summary}</p>}
            {article.blocks.map((b) => (
              <BlockView
                key={b.id}
                site={site}
                block={b}
                lang={lang}
                excludeId={article.id}
                onNavigate={onNavigate}
              />
            ))}
            {article.related.enabled && (
              <ListView
                site={site}
                config={article.related.config}
                lang={lang}
                excludeId={article.id}
                onNavigate={onNavigate}
              />
            )}
          </>
        )}
        {!page && !article && <p>This content no longer exists.</p>}
      </div>
    </div>
  );
}
