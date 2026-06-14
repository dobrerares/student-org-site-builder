/**
 * `@sosb/zip/deploy-md` — DEPLOY.md generator.
 *
 * Pure function `generateDeployMd(input) -> string`. The same string is:
 *  - bundled into every export zip as the user-facing handoff doc, and
 *  - rendered by the in-app "Open guide" modal so the on-screen guide and
 *    the file in the zip stay in lockstep.
 *
 * This module has zero runtime dependencies and no Node-only built-ins —
 * the same code runs in the in-browser editor (export path) and in any
 * Node-side build path that wraps the export.
 *
 * Tracking issue: #43.
 *
 * AC contract for #43:
 *  - DEPLOY.md describes both deploy paths: direct upload via the
 *    Cloudflare dashboard, and Git-connected.
 *  - Content language matches the editor language at export time
 *    (RO default, EN parity).
 *  - The custom-domain section explains DNS pointing and HTTPS.
 *  - The in-app modal renders the same string this function produces.
 *  - Screenshot references resolve to a stable repo-relative path
 *    (`docs/deploy/screenshots/`) so a maintainer can drop real
 *    Cloudflare-dashboard captures alongside the generator.
 */

/**
 * Languages we ship copy for in v1.
 *
 * The PRD pins RO (default) and EN parity from day one. Adding a new
 * language is two changes: extend this union, and add a copy bundle in
 * `COPY` below. The shape of `Copy` keeps the columns honest — the
 * compiler will refuse to add a language that's missing strings.
 */
export type DeployLanguage = "ro" | "en";

/**
 * Caller-supplied input.
 *
 * `language` and `org.name` are required because every doc starts with
 * "Deploying <Org Name> to Cloudflare Pages" in the user's language.
 *
 * `siteUrl` and `customDomain` are optional. When present, they're folded
 * into copy-pasteable instructions; when absent, the doc renders generic
 * placeholders so an export with no hosting decisions yet still produces
 * a usable guide.
 *
 * `screenshotsBaseUrl` lets the in-app modal point screenshots at a
 * different origin than the file-on-disk version (e.g. when the docs site
 * hosts the captures separately). Defaults to a repo-relative path that
 * matches where a maintainer would drop real dashboard captures.
 */
export interface DeployMdInput {
  readonly language: DeployLanguage;
  readonly org: { readonly name: string };
  readonly siteUrl?: string;
  readonly customDomain?: string;
  readonly screenshotsBaseUrl?: string;
}

/**
 * Per-language copy bundle.
 *
 * Strings are kept here instead of `@sosb/i18n` because that package is
 * still empty in v1 (#42). When #42 lands, the bundles can move behind
 * the same key-lookup interface — the export path will keep calling
 * `generateDeployMd()` either way.
 */
interface Copy {
  readonly title: (orgName: string) => string;
  readonly intro: string;
  readonly prerequisites: {
    readonly heading: string;
    readonly items: readonly string[];
  };
  readonly directUpload: {
    readonly heading: string;
    readonly intro: string;
    readonly steps: readonly string[];
    readonly screenshots: readonly { readonly file: string; readonly alt: string }[];
  };
  readonly gitConnected: {
    readonly heading: string;
    readonly intro: string;
    readonly steps: readonly string[];
    readonly screenshots: readonly { readonly file: string; readonly alt: string }[];
  };
  readonly customDomain: {
    readonly heading: string;
    readonly intro: string;
    readonly dnsHeading: string;
    readonly dnsBody: (domain: string) => string;
    readonly httpsHeading: string;
    readonly httpsBody: string;
    readonly placeholderDomain: string;
  };
  readonly siteUrlNote: (siteUrl: string) => string;
  readonly nextSteps: {
    readonly heading: string;
    readonly items: readonly string[];
  };
  readonly footer: string;
}

const DEFAULT_SCREENSHOTS_BASE = "docs/deploy/screenshots/";

/**
 * Romanian copy.
 *
 * Conventions: org name passes through unchanged; "Cloudflare Pages" stays
 * untranslated (it's a product name); diacritics are emitted as-is — the
 * file is UTF-8.
 */
const RO: Copy = {
  title: (orgName) => `Publicarea site-ului ${orgName} pe Cloudflare Pages`,
  intro:
    "Acest document este ghidul de publicare pentru site-ul tău, generat din editor. " +
    "Sunt documentate două căi: una pentru utilizatori non-tehnici (încărcare directă " +
    "în panoul Cloudflare) și una pentru utilizatori cu cont GitHub (conectare prin Git).",
  prerequisites: {
    heading: "Ce îți trebuie",
    items: [
      "Un cont gratuit pe [Cloudflare](https://dash.cloudflare.com/sign-up) (la momentul scrierii, planul Free este suficient pentru un site de organizație studențească).",
      "Folderul `dist/` din zip-ul exportat — acesta este site-ul tău complet, gata de publicat.",
      "(Opțional) Un domeniu personalizat (ex. `historipol.ro`) dacă vrei o adresă proprie.",
    ],
  },
  directUpload: {
    heading: "Calea 1: Încărcare directă (recomandată dacă nu ai cont GitHub)",
    intro:
      "Această cale folosește panoul Cloudflare pentru a încărca site-ul construit. " +
      "Nu ai nevoie de Git, GitHub sau de linia de comandă.",
    steps: [
      "Autentifică-te în [panoul Cloudflare](https://dash.cloudflare.com/) și deschide secțiunea **Workers & Pages** din meniul lateral.",
      "Apasă **Create application** → fila **Pages** → **Upload assets**.",
      "Dă un nume proiectului (ex. `historipol-site`). Acesta devine subdomeniul implicit, de forma `historipol-site.pages.dev`.",
      "Trage și plasează folderul `dist/` (sau apasă **Select from computer** și alege-l). Așteaptă ca toate fișierele să fie încărcate.",
      "Apasă **Deploy site**. În câteva secunde, site-ul va fi accesibil la `https://<numele-tău>.pages.dev`.",
      "Pentru actualizări, repetă pașii 4–5 în același proiect: încarcă noul folder `dist/` și Cloudflare va publica versiunea nouă.",
    ],
    screenshots: [
      {
        file: "01-direct-upload-create-application.png",
        alt: "Panoul Cloudflare cu butonul Create application evidențiat",
      },
      {
        file: "02-direct-upload-drop-dist.png",
        alt: "Zona de drag-and-drop pentru folderul dist",
      },
      {
        file: "03-direct-upload-deployed.png",
        alt: "Confirmarea publicării cu URL-ul *.pages.dev",
      },
    ],
  },
  gitConnected: {
    heading: "Calea 2: Conectat prin Git (recomandată dacă ai deja un repository GitHub)",
    intro:
      "Această cale conectează un repository GitHub la Cloudflare Pages. La fiecare commit pe ramura " +
      "principală, Cloudflare publică automat versiunea actualizată. Nu există un pas separat de " +
      "construire — site-ul tău este deja static; Cloudflare îl servește direct din `dist/`.",
    steps: [
      "Creează un repository GitHub și încarcă conținutul folderului `dist/` la rădăcina repository-ului. (Alternativ: încarcă întregul zip exportat și marchează `dist/` ca folder de output mai jos.)",
      "În [panoul Cloudflare](https://dash.cloudflare.com/), deschide **Workers & Pages** → **Create application** → fila **Pages** → **Connect to Git**.",
      "Autorizează Cloudflare să acceseze repository-urile tale GitHub (o singură dată per cont) și selectează repository-ul site-ului.",
      "La pasul **Set up builds and deployments**, lasă **Build command** gol (site-ul este deja construit) și setează **Build output directory** la `/` dacă ai încărcat doar `dist/`, sau la `dist` dacă ai încărcat tot zip-ul.",
      "Apasă **Save and Deploy**. Cloudflare va clona repository-ul și va publica site-ul la `https://<numele-tău>.pages.dev`.",
      "La fiecare push pe ramura principală, Cloudflare publică automat versiunea nouă. Branch-urile non-principale primesc deploy-uri de previzualizare la URL-uri unice — utile pentru a vedea modificările înainte de a le îmbina.",
    ],
    screenshots: [
      {
        file: "04-git-connect-authorize.png",
        alt: "Ecranul de autorizare GitHub pentru Cloudflare Pages",
      },
      {
        file: "05-git-connect-build-settings.png",
        alt: "Setările de build cu Build output directory completat",
      },
      {
        file: "06-git-connect-deployed.png",
        alt: "Lista de deploy-uri cu commit-uri și URL-uri unice",
      },
    ],
  },
  customDomain: {
    heading: "Domeniu personalizat (opțional)",
    intro:
      "Subdomeniul `*.pages.dev` funcționează imediat, dar majoritatea organizațiilor preferă un " +
      "domeniu propriu, de tip `historipol.ro`. Conectarea se face în două etape: configurarea " +
      "DNS și activarea HTTPS.",
    dnsHeading: "Pasul 1: configurarea DNS (CNAME)",
    dnsBody: (domain) =>
      `În proiectul Pages, deschide fila **Custom domains** → **Set up a custom domain** și introdu ${domain}. ` +
      "Cloudflare îți va arăta o înregistrare CNAME de adăugat la furnizorul tău DNS — de regulă " +
      "`<domeniul-tău>` cu valoare `<numele-proiectului>.pages.dev`. Adăugarea se face în panoul " +
      "registrarului tău (GoDaddy, Namecheap, RoTLD etc.). Propagarea DNS poate dura între câteva " +
      "minute și câteva ore.\n\n" +
      "Dacă domeniul tău este deja gestionat în Cloudflare (transferat ca nameserver), pașii sunt " +
      "automatizați: bifezi domeniul în lista din panou și înregistrarea CNAME se adaugă singură.",
    httpsHeading: "Pasul 2: activarea HTTPS (TLS)",
    httpsBody:
      "După ce CNAME-ul propagă, Cloudflare emite automat un certificat TLS gratuit (Let's Encrypt " +
      "sau Cloudflare Origin CA, în funcție de configurație). HTTPS devine activ în câteva minute " +
      "după ce domeniul apare ca **Active** în panou. Nu este nevoie să copiezi sau să încarci " +
      "vreun certificat manual.\n\n" +
      "Verifică că `https://<domeniul-tău>` se deschide fără avertismente de securitate înainte de " +
      "a anunța public adresa.",
    placeholderDomain: "domeniul tău (ex. historipol.ro)",
  },
  siteUrlNote: (siteUrl) =>
    `Site-ul tău a fost construit pentru \`${siteUrl}\`. Asigură-te că adresa publică finală ` +
    `(fie \`*.pages.dev\`, fie domeniul personalizat) corespunde cu această valoare. Dacă ` +
    `decizi altă adresă, re-exportă din editor cu noul \`siteUrl\` pentru ca link-urile ` +
    `canonice și sitemap-ul să fie corecte.`,
  nextSteps: {
    heading: "Ce urmează după publicare",
    items: [
      "Trimite adresa publică membrilor și verifică că totul se vede corect pe telefon și pe desktop.",
      "Salvează zip-ul exportat într-un loc sigur (Drive, e-mail) — este sursa unică de adevăr a site-ului tău.",
      "La predarea către conducerea următoare, dă-le zip-ul plus acest fișier — au tot ce le trebuie pentru a continua.",
    ],
  },
  footer:
    "Generat automat de editor. Dacă pașii din panoul Cloudflare arată diferit, " +
    "consultă [documentația oficială Cloudflare Pages](https://developers.cloudflare.com/pages/) — " +
    "este mai actualizată decât acest fișier.",
};

/**
 * English copy.
 *
 * Mirrors the RO bundle's structure 1:1 so a translator can diff the two
 * files and confirm parity.
 */
const EN: Copy = {
  title: (orgName) => `Deploying ${orgName} to Cloudflare Pages`,
  intro:
    "This document is your deployment handoff, generated from the editor. " +
    "It covers two paths: a no-Git path (Direct upload via the Cloudflare dashboard) " +
    "and a Git-connected path (for users with a GitHub account).",
  prerequisites: {
    heading: "What you need",
    items: [
      "A free [Cloudflare](https://dash.cloudflare.com/sign-up) account (at the time of writing, the Free plan is sufficient for a student-organization site).",
      "The `dist/` folder from your exported zip — this is the complete static site, ready to publish.",
      "(Optional) A custom domain (e.g. `historipol.ro`) if you want your own address.",
    ],
  },
  directUpload: {
    heading: "Path 1: Direct upload (recommended if you do not have GitHub)",
    intro:
      "This path uses the Cloudflare dashboard to upload the built site. " +
      "You do not need Git, GitHub, or the command line.",
    steps: [
      "Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and open **Workers & Pages** in the sidebar.",
      "Click **Create application** → the **Pages** tab → **Upload assets**.",
      "Give the project a name (e.g. `historipol-site`). This becomes the default subdomain, e.g. `historipol-site.pages.dev`.",
      "Drag and drop the `dist/` folder (or click **Select from computer** and pick it). Wait for all files to upload.",
      "Click **Deploy site**. Within a few seconds, the site is live at `https://<your-name>.pages.dev`.",
      "To update, repeat steps 4–5 in the same project: upload a new `dist/` folder and Cloudflare publishes the new version.",
    ],
    screenshots: [
      {
        file: "01-direct-upload-create-application.png",
        alt: "Cloudflare dashboard with the Create application button highlighted",
      },
      {
        file: "02-direct-upload-drop-dist.png",
        alt: "The drag-and-drop area for the dist folder",
      },
      {
        file: "03-direct-upload-deployed.png",
        alt: "The deploy confirmation showing the *.pages.dev URL",
      },
    ],
  },
  gitConnected: {
    heading: "Path 2: Git-connected (recommended if you already have a GitHub repository)",
    intro:
      "This path connects a GitHub repository to Cloudflare Pages. On every commit to the " +
      "main branch, Cloudflare publishes the updated version automatically. There is no " +
      "separate build step — your site is already static; Cloudflare serves it from `dist/`.",
    steps: [
      "Create a GitHub repository and push the contents of the `dist/` folder to the repository root. (Alternatively: push the whole exported zip and set `dist/` as the build-output folder below.)",
      "In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Workers & Pages** → **Create application** → the **Pages** tab → **Connect to Git**.",
      "Authorize Cloudflare to read your GitHub repositories (once per account), then select the site repository.",
      "On the **Set up builds and deployments** screen, leave **Build command** empty (the site is already built) and set **Build output directory** to `/` if you pushed only `dist/`, or to `dist` if you pushed the whole zip.",
      "Click **Save and Deploy**. Cloudflare clones the repository and publishes the site to `https://<your-name>.pages.dev`.",
      "On every push to the main branch, Cloudflare auto-deploys. Non-main branches get preview deploys at unique URLs — useful for reviewing changes before merging.",
    ],
    screenshots: [
      {
        file: "04-git-connect-authorize.png",
        alt: "GitHub authorization screen for Cloudflare Pages",
      },
      {
        file: "05-git-connect-build-settings.png",
        alt: "Build settings with Build output directory filled in",
      },
      {
        file: "06-git-connect-deployed.png",
        alt: "Deploy list showing commits and unique URLs",
      },
    ],
  },
  customDomain: {
    heading: "Custom domain (optional)",
    intro:
      "The `*.pages.dev` subdomain works out of the box, but most organizations prefer a " +
      "branded address such as `historipol.ro`. Setup is two steps: DNS configuration and " +
      "HTTPS activation.",
    dnsHeading: "Step 1: DNS configuration (CNAME)",
    dnsBody: (domain) =>
      `In the Pages project, open the **Custom domains** tab → **Set up a custom domain** and enter ${domain}. ` +
      "Cloudflare shows a CNAME record to add at your DNS provider — typically " +
      "`<your-domain>` with the value `<project-name>.pages.dev`. Add it in your registrar's " +
      "panel (GoDaddy, Namecheap, RoTLD, etc.). DNS propagation can take from a few minutes " +
      "to a few hours.\n\n" +
      "If your domain is already managed by Cloudflare (nameservers transferred), the steps " +
      "are automated: tick the domain in the dashboard list and the CNAME is added for you.",
    httpsHeading: "Step 2: HTTPS activation (TLS)",
    httpsBody:
      "Once the CNAME propagates, Cloudflare automatically issues a free TLS certificate " +
      "(Let's Encrypt or Cloudflare Origin CA depending on your setup). HTTPS becomes active " +
      "within a few minutes of the domain showing as **Active** in the dashboard. There is no " +
      "manual certificate to copy or upload.\n\n" +
      "Verify that `https://<your-domain>` opens without security warnings before announcing " +
      "the address publicly.",
    placeholderDomain: "your domain (e.g. historipol.ro)",
  },
  siteUrlNote: (siteUrl) =>
    `Your site was built for \`${siteUrl}\`. Make sure the final public address ` +
    `(either \`*.pages.dev\` or your custom domain) matches that value. If you ` +
    `pick a different address, re-export from the editor with the new \`siteUrl\` ` +
    `so the canonical links and sitemap are correct.`,
  nextSteps: {
    heading: "After publishing",
    items: [
      "Share the public URL with your members and double-check the site renders well on mobile and desktop.",
      "Save the exported zip somewhere safe (Drive, email) — it is the single source of truth for your site.",
      "When handing the site to next year's leadership, give them the zip plus this file — they have everything they need to continue.",
    ],
  },
  footer:
    "Generated by the editor. If the Cloudflare dashboard steps look different in practice, " +
    "consult the [official Cloudflare Pages documentation](https://developers.cloudflare.com/pages/) — " +
    "it is more current than this file.",
};

const COPY: Record<DeployLanguage, Copy> = { ro: RO, en: EN };

/**
 * Markdown-escape a free-form string before embedding it as a heading or
 * inline run. We protect against three concrete failure modes:
 *
 *  - HTML inline (some renderers honour `<script>` inline). Angle brackets
 *    become entities.
 *  - Markdown inline emphasis collisions (`*`, `_`) — escaped with a
 *    leading backslash.
 *  - Backtick collisions inside `code` runs — escaped likewise.
 *
 * We deliberately do NOT escape ampersand: `AT&T` should render as
 * `AT&T`, not `AT&amp;T`. Markdown treats `&` as literal in text.
 */
function escapeMarkdownInline(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`");
}

/**
 * Normalise a screenshots base URL so concatenating `<base><file>` always
 * yields a single slash between them.
 */
function normaliseScreenshotsBase(base: string | undefined): string {
  const value = base ?? DEFAULT_SCREENSHOTS_BASE;
  return value.endsWith("/") ? value : `${value}/`;
}

/**
 * Render a numbered Markdown list. Numbers are emitted as `1.`, `2.`, ...
 * (compact form) — most Markdown renderers re-number based on order, but
 * we emit literal numbers so the file remains legible as plain text.
 */
function renderNumberedList(items: readonly string[]): string {
  return items.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
}

/**
 * Render a bulleted Markdown list using `-` (most-portable bullet).
 */
function renderBulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Render a screenshot block as a Markdown image. The alt text is escaped
 * so a future translation containing brackets or pipes doesn't break the
 * image syntax.
 */
function renderScreenshot(screenshot: { file: string; alt: string }, baseUrl: string): string {
  const safeAlt = screenshot.alt.replace(/\]/g, "\\]").replace(/\[/g, "\\[");
  return `![${safeAlt}](${baseUrl}${screenshot.file})`;
}

/**
 * Generate the DEPLOY.md content as a Markdown string.
 *
 * @param input  Caller-supplied generator input (see {@link DeployMdInput}).
 * @returns      The full DEPLOY.md text, ending with a single newline.
 *
 * @throws TypeError if `input.language` is not one of the supported
 *         languages. Other fields are not validated — callers are expected
 *         to pass values from the parsed site schema, which is already
 *         validated upstream.
 */
export function generateDeployMd(input: DeployMdInput): string {
  const copy = COPY[input.language];
  if (copy === undefined) {
    throw new TypeError(`generateDeployMd: unsupported language "${String(input.language)}"`);
  }

  const orgNameSafe = escapeMarkdownInline(input.org.name);
  const screenshotsBase = normaliseScreenshotsBase(input.screenshotsBaseUrl);
  // Real domains render as Markdown code spans (`historipol.ro`); the
  // language placeholders ("your domain (e.g. ...)") render as plain text
  // because they're prose, not literals.
  const customDomain =
    input.customDomain !== undefined && input.customDomain.length > 0
      ? `\`${input.customDomain}\``
      : copy.customDomain.placeholderDomain;
  const siteUrl =
    input.siteUrl !== undefined && input.siteUrl.length > 0 ? input.siteUrl : undefined;

  const sections: string[] = [];

  // Title + intro.
  sections.push(`# ${copy.title(orgNameSafe)}`);
  sections.push(copy.intro);

  // Optional siteUrl note (only when the build was given a real origin).
  if (siteUrl !== undefined) {
    sections.push(copy.siteUrlNote(siteUrl));
  }

  // Prerequisites.
  sections.push(`## ${copy.prerequisites.heading}`);
  sections.push(renderBulletList(copy.prerequisites.items));

  // Path 1 — direct upload.
  sections.push(`## ${copy.directUpload.heading}`);
  sections.push(copy.directUpload.intro);
  sections.push(renderNumberedList(copy.directUpload.steps));
  for (const shot of copy.directUpload.screenshots) {
    sections.push(renderScreenshot(shot, screenshotsBase));
  }

  // Path 2 — Git-connected.
  sections.push(`## ${copy.gitConnected.heading}`);
  sections.push(copy.gitConnected.intro);
  sections.push(renderNumberedList(copy.gitConnected.steps));
  for (const shot of copy.gitConnected.screenshots) {
    sections.push(renderScreenshot(shot, screenshotsBase));
  }

  // Custom domain.
  sections.push(`## ${copy.customDomain.heading}`);
  sections.push(copy.customDomain.intro);
  sections.push(`### ${copy.customDomain.dnsHeading}`);
  sections.push(copy.customDomain.dnsBody(customDomain));
  sections.push(`### ${copy.customDomain.httpsHeading}`);
  sections.push(copy.customDomain.httpsBody);

  // Next steps.
  sections.push(`## ${copy.nextSteps.heading}`);
  sections.push(renderBulletList(copy.nextSteps.items));

  // Footer.
  sections.push(`---`);
  sections.push(copy.footer);

  // Sections are separated by a single blank line; the file ends with a
  // single trailing newline.
  return `${sections.join("\n\n")}\n`;
}

/**
 * Compatibility default for older callers that imported a static `DEPLOY_MD`.
 * New export code calls `generateDeployMd()` with the site's language and org.
 */
export const DEPLOY_MD = generateDeployMd({
  language: "en",
  org: { name: "your organisation" },
});
