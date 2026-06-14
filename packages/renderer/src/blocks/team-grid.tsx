/** @jsxImportSource preact */
import type { TeamGridBlock, TeamGridPerson, TeamGridSocialLink } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * teamGrid block — structural HTML only.
 *
 * Owns the *semantic* shape: a `<section>` landmark with optional title +
 * intro, a list of people, optional first-level grouping by `data.groupBy`,
 * per-person `<figure>`/`<figcaption>` with photo or initial-letter avatar
 * fallback, role, optional bio, and an optional list of social links.
 *
 * Theme-specific styling lives in the theme's CSS; the block ships the
 * minimum CSS hooks (data-block, BEM-ish classes, --team-grid-columns
 * custom property) so theme CSS can attach without re-templating the HTML.
 *
 * Forward-compat: data is consumed tolerantly. Optional fields are
 * conditionally rendered. Unknown extra fields on `data` and per-person
 * are ignored without throwing — the schema's preserve-unknown-keys
 * carries them through to round-trip persistence; the renderer just
 * doesn't surface them.
 *
 * The PRD calls out single-level grouping only (no nested groups) and
 * the issue's out-of-scope confirms it; this implementation rejects no
 * data, but only one bucketing level is rendered.
 */
export function TeamGrid(props: {
  block: TeamGridBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const people = Array.isArray(data.people) ? data.people : [];

  // Empty-state suppression: a teamGrid with no people renders nothing rather
  // than an empty styled container. (people is `.min(1)` in the schema; this
  // guards the loose-data tolerance path.)
  if (people.length === 0) return null;

  const title = typeof data.title === "string" && data.title.length > 0 ? data.title : undefined;
  const intro = typeof data.intro === "string" && data.intro.length > 0 ? data.intro : undefined;
  const groupBy =
    typeof data.groupBy === "string" && data.groupBy.length > 0 ? data.groupBy : undefined;

  const groups = groupPeople(people, groupBy);
  // Inline custom property so theme CSS / media-queries can adapt the
  // grid-template-columns. The numeric literal goes through the schema's
  // 2/3/4 union, so the value is always safe to inline as a CSS number.
  const gridStyle = `--team-grid-columns: ${data.columns};`;

  return (
    <section
      data-block="teamGrid"
      data-block-id={id}
      class="team-grid"
      aria-labelledby={title !== undefined ? `${id}__title` : undefined}
    >
      <div class="team-grid__inner">
        {title !== undefined && (
          <h2 id={`${id}__title`} class="team-grid__title">
            {title}
          </h2>
        )}
        {intro !== undefined && <p class="team-grid__intro">{intro}</p>}
        {groups.map((group) => (
          <TeamGroup
            key={group.key ?? "__flat__"}
            group={group}
            blockId={id}
            style={gridStyle}
            assetUrlForPath={props.assetUrlForPath}
          />
        ))}
      </div>
    </section>
  );
}

interface PersonGroup {
  /** Group label (e.g. "Conducere"). `null` for the flat / ungrouped case. */
  key: string | null;
  people: TeamGridPerson[];
}

/**
 * Bucket people by the `groupBy` key on each person, preserving first-seen
 * order. People missing the `groupBy` key fall into a trailing "Other"
 * bucket so they aren't dropped silently. When `groupBy` is unset we emit
 * a single flat bucket.
 */
function groupPeople(people: TeamGridPerson[], groupBy: string | undefined): PersonGroup[] {
  if (groupBy === undefined) {
    return [{ key: null, people }];
  }

  const buckets = new Map<string, TeamGridPerson[]>();
  const order: string[] = [];
  const fallbackKey = "Other";

  for (const person of people) {
    const raw = (person as unknown as Record<string, unknown>)[groupBy];
    const key = typeof raw === "string" && raw.length > 0 ? raw : fallbackKey;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(person);
  }

  return order.map((key) => ({ key, people: buckets.get(key)! }));
}

function TeamGroup(props: {
  group: PersonGroup;
  blockId: string;
  style: string;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { group, blockId, style } = props;
  const groupId =
    group.key !== null ? `${blockId}__group-${slugify(group.key)}` : `${blockId}__group-flat`;

  return (
    <div
      class="team-grid__group"
      data-team-group={group.key !== null ? "" : undefined}
      aria-labelledby={group.key !== null ? `${groupId}__heading` : undefined}
    >
      {group.key !== null && (
        <h3 id={`${groupId}__heading`} class="team-grid__group-heading">
          {group.key}
        </h3>
      )}
      <ul class="team-grid__list" style={style}>
        {group.people.map((person, idx) => (
          <Person
            key={`${groupId}-${idx}`}
            person={person}
            assetUrlForPath={props.assetUrlForPath}
          />
        ))}
      </ul>
    </div>
  );
}

function Person(props: {
  person: TeamGridPerson;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { person } = props;
  const photo = person.photo;
  const photoAlt = photo !== undefined ? photo.alt : "";
  const avatarLetter = initialLetter(person.name);
  const bio = typeof person.bio === "string" && person.bio.length > 0 ? person.bio : undefined;
  const socials = Array.isArray(person.socials) ? person.socials : [];

  return (
    <li class="team-person" data-person-card="">
      <figure class="team-person__figure">
        {photo !== undefined ? (
          <img
            class="team-person__photo"
            src={resolveAssetUrl(photo.path, props.assetUrlForPath)}
            alt={photoAlt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
          />
        ) : (
          <span class="team-person__avatar" aria-hidden="true">
            {avatarLetter}
          </span>
        )}
        <figcaption class="team-person__caption">
          <p class="team-person__name">{person.name}</p>
          <p class="team-person__role">{person.role}</p>
          {bio !== undefined && <p class="team-person__bio">{bio}</p>}
          {socials.length > 0 && <SocialList socials={socials} />}
        </figcaption>
      </figure>
    </li>
  );
}

function SocialList(props: { socials: TeamGridSocialLink[] }): preact.JSX.Element {
  return (
    <ul class="team-person__socials">
      {props.socials.map((s, idx) => (
        <li key={`${s.platform}-${idx}`} class="team-person__socials-item">
          <a
            class={`team-person__social team-person__social--${slugify(s.platform)}`}
            href={s.url}
            data-platform={s.platform}
            rel="noopener noreferrer"
          >
            <span class="visually-hidden">{s.platform}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Initial-letter avatar source. Per the PRD the fallback is theme-styled,
 * so we just pick the first grapheme cluster of the name. ASCII-friendly
 * fallback: uppercase the first character, defaulting to "?" for an empty
 * name (the schema rejects empty names but we handle the case defensively
 * to keep the renderer total).
 */
function initialLetter(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  // [...trimmed][0] handles surrogate pairs without needing Intl.Segmenter.
  const first = [...trimmed][0]!;
  return first.toUpperCase();
}

/**
 * Slugify an arbitrary string for class-name / id usage. Lowercases,
 * replaces non-alphanumerics with `-`, strips leading/trailing dashes.
 * The result is deterministic and safe to inline into a CSS selector.
 *
 * Used for: social-platform class hooks (`team-person__social--<platform>`)
 * and group-heading ids.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
