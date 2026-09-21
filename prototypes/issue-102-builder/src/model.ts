/**
 * THROWAWAY prototype (issue #102) — fake in-memory Site model.
 * Deliberately simplified: no schema, no persistence, no migrations.
 */

export type Lang = "en" | "ro";
export type PubState = "draft" | "published" | "unlisted";

export const LANG_LABEL: Record<Lang, string> = { en: "English", ro: "Română" };
export const STATE_LABEL: Record<PubState, string> = {
  draft: "Draft",
  published: "Published",
  unlisted: "Unlisted",
};

export type Tag = { id: string; label: string };

export type ListConfig = {
  heading: string;
  mode: "tag" | "select";
  tagIds: string[];
  articleIds: string[];
};

export type LinkTarget =
  | { kind: "page"; id: string }
  | { kind: "article"; id: string }
  | { kind: "url"; href: string }
  | { kind: "email"; href: string }
  | { kind: "tel"; href: string };

export type RichTextBlock = {
  id: string;
  type: "richText";
  html: string;
};

export type ArticleListBlock = {
  id: string;
  type: "articleList";
  config: ListConfig;
};

export type HeadingBlock = { id: string; type: "heading"; text: string; level: 2 | 3 };
export type CtaBlock = { id: string; type: "cta"; text: string; buttonLabel: string };
export type ImageBlock = { id: string; type: "image"; src: string; alt: string; caption: string };

export type Block = RichTextBlock | ArticleListBlock | HeadingBlock | CtaBlock | ImageBlock;

export const BLOCK_LABEL: Record<Block["type"], string> = {
  richText: "Rich text",
  articleList: "Article list",
  heading: "Heading",
  cta: "Call to action",
  image: "Image",
};

export type Article = {
  id: string;
  title: string;
  slug: string;
  lang: Lang;
  state: PubState;
  date: string; // ISO yyyy-mm-dd
  summary: string;
  cover: { src: string; alt: string } | null;
  tagIds: string[];
  blocks: Block[];
  related: { enabled: boolean; config: ListConfig };
};

export type Page = {
  id: string;
  title: string;
  slug: string;
  lang: Lang;
  showInNav: boolean;
  blocks: Block[];
};

export type Site = {
  name: string;
  defaultLang: Lang;
  languages: Lang[];
  theme: string;
  accent: string;
  tags: Tag[];
  pages: Page[];
  articles: Article[];
};

let counter = 0;
export const uid = (prefix: string) =>
  `${prefix}-${++counter}-${Math.random().toString(36).slice(2, 6)}`;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "untitled";

export const today = () => new Date().toISOString().slice(0, 10);

export const emptyListConfig = (heading: string): ListConfig => ({
  heading,
  mode: "tag",
  tagIds: [],
  articleIds: [],
});

const rt = (html: string): RichTextBlock => ({ id: uid("blk"), type: "richText", html });

export const articleUrl = (site: Site, a: Article) =>
  a.lang === site.defaultLang ? `/articles/${a.slug}/` : `/${a.lang}/articles/${a.slug}/`;

export const pageUrl = (site: Site, p: Page) =>
  p.lang === site.defaultLang
    ? `/${p.slug === "home" ? "" : p.slug + "/"}`
    : `/${p.lang}/${p.slug === "home" ? "" : p.slug + "/"}`;

export function createSeedSite(): Site {
  const tags: Tag[] = [
    { id: "tag-events", label: "Events" },
    { id: "tag-volunteering", label: "Volunteering" },
    { id: "tag-alumni", label: "Alumni" },
    { id: "tag-workshops", label: "Workshops" },
    { id: "tag-announcements", label: "Announcements" },
  ];

  const articles: Article[] = [
    {
      id: "art-welcome-week",
      title: "Welcome Week 2026: everything you need to know",
      slug: "welcome-week-2026",
      lang: "en",
      state: "published",
      date: "2026-09-02",
      summary: "Five days of tours, free coffee and a very competitive quiz night.",
      cover: { src: "welcome-week.jpg", alt: "Students queueing at the society fair" },
      tagIds: ["tag-events", "tag-announcements"],
      blocks: [
        rt(
          "<p>Welcome Week returns on <strong>28 September</strong>. Every new member is invited, and most events are free.</p><h2>What is happening</h2><ul><li>Campus tours, twice daily</li><li>The society fair in the Old Hall</li><li>Quiz night, with actual prizes</li></ul><p>Bring your student card and a friend.</p>",
        ),
      ],
      related: {
        enabled: true,
        config: {
          heading: "Related articles",
          mode: "tag",
          tagIds: ["tag-events"],
          articleIds: [],
        },
      },
    },
    {
      id: "art-volunteer-day",
      title: "Volunteer day at the river clean-up",
      slug: "volunteer-day-river-clean-up",
      lang: "en",
      state: "published",
      date: "2026-08-19",
      summary: "Forty members, eleven bin bags and one recovered shopping trolley.",
      cover: null,
      tagIds: ["tag-volunteering"],
      blocks: [
        rt("<p>We spent Saturday morning on the riverbank. Thank you to everyone who came.</p>"),
      ],
      related: { enabled: false, config: emptyListConfig("Related articles") },
    },
    {
      id: "art-alumni-panel",
      title: "Alumni panel: first jobs, honestly described",
      slug: "alumni-panel-first-jobs",
      lang: "en",
      state: "unlisted",
      date: "2026-07-30",
      summary: "A recording of the June panel, shared with members only via a direct link.",
      cover: null,
      tagIds: ["tag-alumni"],
      blocks: [
        rt(
          "<p>Six graduates answered questions for ninety minutes. The recording link is below.</p>",
        ),
      ],
      related: { enabled: false, config: emptyListConfig("Related articles") },
    },
    {
      id: "art-grant-results",
      title: "Grant results and what we will spend them on",
      slug: "grant-results-2026",
      lang: "en",
      state: "draft",
      date: "2026-09-18",
      summary: "",
      cover: null,
      tagIds: ["tag-announcements"],
      blocks: [rt("<p>Draft. Waiting for the finance committee to confirm the numbers.</p>")],
      related: { enabled: false, config: emptyListConfig("Related articles") },
    },
    {
      id: "art-workshop-cv",
      title: "CV workshop: bring a printed copy",
      slug: "cv-workshop",
      lang: "en",
      state: "published",
      date: "2026-06-11",
      summary: "Careers service staff will mark up your CV in person.",
      cover: null,
      tagIds: ["tag-workshops", "tag-events"],
      blocks: [rt("<p>Room 2.14, Thursday at 18:00. No booking needed.</p>")],
      related: { enabled: false, config: emptyListConfig("Related articles") },
    },
    {
      id: "art-saptamana-bobocilor",
      title: "Săptămâna bobocilor 2026: tot ce trebuie să știi",
      slug: "saptamana-bobocilor-2026",
      lang: "ro",
      state: "published",
      date: "2026-09-02",
      summary: "Cinci zile de tururi, cafea gratuită și o seară de quiz.",
      cover: null,
      tagIds: ["tag-events", "tag-announcements"],
      blocks: [rt("<p>Săptămâna bobocilor începe pe <strong>28 septembrie</strong>.</p>")],
      related: { enabled: false, config: emptyListConfig("Articole similare") },
    },
    {
      id: "art-voluntariat",
      title: "Zi de voluntariat pe malul râului",
      slug: "zi-de-voluntariat",
      lang: "ro",
      state: "draft",
      date: "2026-08-20",
      summary: "",
      cover: null,
      tagIds: ["tag-volunteering"],
      blocks: [rt("<p>Traducere în lucru.</p>")],
      related: { enabled: false, config: emptyListConfig("Articole similare") },
    },
    {
      id: "art-atelier-cv",
      title: "Atelier de CV: adu un exemplar printat",
      slug: "atelier-cv",
      lang: "ro",
      state: "published",
      date: "2026-06-12",
      summary: "Colegii de la centrul de carieră îți corectează CV-ul pe loc.",
      cover: null,
      tagIds: ["tag-workshops"],
      blocks: [rt("<p>Sala 2.14, joi la 18:00.</p>")],
      related: { enabled: false, config: emptyListConfig("Articole similare") },
    },
  ];

  const pages: Page[] = [
    {
      id: "page-home",
      title: "Home",
      slug: "home",
      lang: "en",
      showInNav: true,
      blocks: [
        { id: uid("blk"), type: "heading", text: "Riverside Students' Society", level: 2 },
        rt(
          '<p>We are a student society of about 300 members. We run weekly events, volunteering days and a mentoring scheme. New members are always welcome — see <a data-target="page:page-join" href="/join/">Join us</a>.</p>',
        ),
        {
          id: uid("blk"),
          type: "articleList",
          config: {
            heading: "Latest news",
            mode: "tag",
            tagIds: ["tag-events", "tag-announcements"],
            articleIds: [],
          },
        },
      ],
    },
    {
      id: "page-about",
      title: "About us",
      slug: "about",
      lang: "en",
      showInNav: true,
      blocks: [
        rt(
          '<p>Founded in 2011 by four students who wanted a better common room. Still going.</p><p>Our spending is set out in the <a data-target="article:art-grant-results" href="/articles/grant-results-2026/">grant results</a> write-up.</p>',
        ),
        {
          id: uid("blk"),
          type: "cta",
          text: "Want to help run the society?",
          buttonLabel: "Email the committee",
        },
      ],
    },
    {
      id: "page-join",
      title: "Join us",
      slug: "join",
      lang: "en",
      showInNav: true,
      blocks: [
        rt(
          '<p>Membership costs £5 for the year. Start with <a data-target="article:art-welcome-week" href="/articles/welcome-week-2026/">Welcome Week 2026</a>, then come to anything you like.</p>',
        ),
        {
          id: uid("blk"),
          type: "articleList",
          config: {
            heading: "Picked for new members",
            mode: "select",
            tagIds: [],
            // Seeded with a Draft target on purpose: this is the export blocker
            // the walkthrough asks the reviewer to find and repair.
            articleIds: ["art-welcome-week", "art-grant-results", "art-alumni-panel"],
          },
        },
      ],
    },
    {
      id: "page-acasa",
      title: "Acasă",
      slug: "acasa",
      lang: "ro",
      showInNav: true,
      blocks: [
        rt("<p>Suntem o asociație studențească cu aproximativ 300 de membri.</p>"),
        { id: uid("blk"), type: "articleList", config: emptyListConfig("Noutăți") },
      ],
    },
  ];

  return {
    name: "Riverside Students' Society",
    defaultLang: "en",
    languages: ["en", "ro"],
    theme: "Modern",
    accent: "#2f6f5e",
    tags,
    pages,
    articles,
  };
}

/* ---------- derived helpers ---------- */

export function tagLabels(site: Site, ids: string[]) {
  return ids.map((id) => site.tags.find((t) => t.id === id)?.label ?? "(deleted tag)");
}

export function matchesByTag(site: Site, config: ListConfig, lang: Lang, excludeId?: string) {
  return site.articles
    .filter((a) => a.state === "published")
    .filter((a) => a.lang === lang)
    .filter((a) => a.id !== excludeId)
    .filter((a) => config.tagIds.length === 0 || config.tagIds.some((t) => a.tagIds.includes(t)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function resolveList(
  site: Site,
  config: ListConfig,
  lang: Lang,
  excludeId?: string,
): Article[] {
  if (config.mode === "tag") return matchesByTag(site, config, lang, excludeId);
  return config.articleIds
    .map((id) => site.articles.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a));
}

export type Finding = {
  id: string;
  severity: "error" | "warning";
  blocksExport: boolean;
  message: string;
  detail: string;
  where: { kind: "page" | "article"; id: string; blockId?: string };
};

/** Site Health + export readiness findings, computed from the fake Site. */
export function computeFindings(site: Site): Finding[] {
  const out: Finding[] = [];

  const scanList = (
    owner: { kind: "page" | "article"; id: string; title: string; lang: Lang },
    blockId: string,
    config: ListConfig,
    isDraftOwner: boolean,
  ) => {
    if (config.mode !== "select") return;
    for (const id of config.articleIds) {
      const target = site.articles.find((a) => a.id === id);
      if (!target) {
        out.push({
          id: `${blockId}-missing-${id}`,
          severity: "error",
          blocksExport: !isDraftOwner,
          message: `“${owner.title}” selects an Article that no longer exists.`,
          detail: isDraftOwner
            ? "The problem is confined to a Draft Article, so it does not block public export."
            : "Unavailable targets in an active explicit selection block public export. Remove or replace the selection.",
          where: { kind: owner.kind, id: owner.id, blockId },
        });
      } else if (target.state === "draft") {
        out.push({
          id: `${blockId}-draft-${id}`,
          severity: "error",
          blocksExport: !isDraftOwner,
          message: `“${owner.title}” selects the Draft Article “${target.title}”.`,
          detail: isDraftOwner
            ? "The problem is confined to a Draft Article, so it does not block public export."
            : "Draft Articles are not part of the public website. Publish it, or remove it from the selection, then export again.",
          where: { kind: owner.kind, id: owner.id, blockId },
        });
      }
    }
  };

  for (const page of site.pages) {
    for (const block of page.blocks) {
      if (block.type === "articleList")
        scanList(
          { kind: "page", id: page.id, title: page.title, lang: page.lang },
          block.id,
          block.config,
          false,
        );
      if (block.type === "richText") {
        for (const id of draftLinkTargets(site, block.html)) {
          const target = site.articles.find((a) => a.id === id);
          out.push({
            id: `${block.id}-link-${id}`,
            severity: "warning",
            blocksExport: false,
            message: `“${page.title}” links to the Draft Article “${target?.title ?? id}”.`,
            detail:
              "Broken and Draft prose links warn and render as unlinked text in the public website. The link target is kept in the project so you can repair it.",
            where: { kind: "page", id: page.id, blockId: block.id },
          });
        }
      }
      if (block.type === "image" && !block.alt.trim()) {
        out.push({
          id: `${block.id}-alt`,
          severity: "warning",
          blocksExport: false,
          message: `An image on “${page.title}” has no image description.`,
          detail:
            "Missing image descriptions are a warning, not an export blocker. Screen-reader users will not know what the image shows.",
          where: { kind: "page", id: page.id, blockId: block.id },
        });
      }
    }
  }

  for (const article of site.articles) {
    const isDraft = article.state === "draft";
    for (const block of article.blocks) {
      if (block.type === "articleList")
        scanList(
          { kind: "article", id: article.id, title: article.title, lang: article.lang },
          block.id,
          block.config,
          isDraft,
        );
    }
    if (article.related.enabled)
      scanList(
        { kind: "article", id: article.id, title: article.title, lang: article.lang },
        `${article.id}-related`,
        article.related.config,
        isDraft,
      );
    if (article.state === "published" && !article.summary.trim()) {
      out.push({
        id: `${article.id}-summary`,
        severity: "warning",
        blocksExport: false,
        message: `“${article.title}” is Published without a summary.`,
        detail:
          "Cards and search results fall back to the title alone. A one-sentence summary usually reads better.",
        where: { kind: "article", id: article.id },
      });
    }
  }

  return out;
}

/** Ids of Draft Articles referenced by prose links inside a rich-text HTML string. */
export function draftLinkTargets(site: Site, html: string): string[] {
  const ids: string[] = [];
  const re = /data-target="article:([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const target = site.articles.find((a) => a.id === m![1]);
    if (!target || target.state === "draft") ids.push(m[1]);
  }
  return ids;
}
