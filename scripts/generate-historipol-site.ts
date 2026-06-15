import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";
import { Fragment, h } from "preact";

import { uploadAsset } from "../packages/assets/src/pipeline.ts";
import { createSharpImageProcessor } from "../packages/assets/src/sharp-processor.ts";
import { build } from "../packages/build/src/index.ts";
import type { Site } from "../packages/schema/src/site.ts";
import { validate } from "../packages/schema/src/validate.ts";
import { MemoryDriver } from "../packages/vfs/src/memory.ts";
import { exportToZip } from "../packages/zip/src/export.ts";

Object.assign(globalThis, { React: { createElement: h, Fragment } });

const outDir = join(process.cwd(), "build", "historipol-reference-site");

const pages = {
  despre: "https://sites.google.com/osubb.ro/historipol/despre-noi",
  activitati: "https://sites.google.com/osubb.ro/historipol/activit%C4%83%C8%9Bi",
  echipa: "https://sites.google.com/osubb.ro/historipol/echipa",
  contact: "https://sites.google.com/osubb.ro/historipol/unde-ne-g%C4%83se%C8%99ti",
} as const;

type PageKey = keyof typeof pages;

interface ScrapedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface AssetRef {
  hash: string;
  path: string;
  metadataPath: string;
  mime: string;
  width: number;
  height: number;
  alt: string;
}

async function scrapeImages(): Promise<Record<PageKey, ScrapedImage[]>> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
    const result = {} as Record<PageKey, ScrapedImage[]>;
    for (const [key, url] of Object.entries(pages) as [PageKey, string][]) {
      await page.goto(url, { waitUntil: "networkidle" });
      result[key] = await page.$$eval("img", (imgs) =>
        imgs
          .map((img) => ({
            src: img.currentSrc || img.src,
            alt: img.alt || "",
            width: img.naturalWidth,
            height: img.naturalHeight,
          }))
          .filter((img) => img.src.startsWith("http") && img.width >= 80 && img.height >= 80),
      );
    }
    return result;
  } finally {
    await browser.close();
  }
}

function uniqueBySrc(images: ScrapedImage[]): ScrapedImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const normalised = img.src.replace(/=w\d+.*$/, "");
    if (seen.has(normalised)) return false;
    seen.add(normalised);
    return true;
  });
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function uploadRemoteImage(
  vfs: MemoryDriver,
  processor: Awaited<ReturnType<typeof createSharpImageProcessor>>,
  image: ScrapedImage,
  name: string,
  alt: string,
): Promise<AssetRef> {
  const bytes = await fetchBytes(image.src);
  const ref = await uploadAsset(
    {
      kind: "bytes",
      bytes,
      name,
      declaredMime: "image/jpeg",
      alt,
    },
    vfs,
    { processor },
  );
  return ref;
}

async function writeVfsAssets(vfs: MemoryDriver): Promise<void> {
  const assetPaths = await vfs.list("assets/");
  const previewAssetDirs = ["dist", "dist/activitati", "dist/echipa", "dist/unde-ne-gasesti"];
  for (const dir of previewAssetDirs) {
    await mkdir(join(outDir, dir, "assets"), { recursive: true });
  }
  for (const path of assetPaths) {
    const bytes = await vfs.read(path);
    await writeFile(join(outDir, path), bytes);
    for (const dir of previewAssetDirs) {
      await writeFile(join(outDir, dir, path), bytes);
    }
  }
}

async function main(): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "assets"), { recursive: true });
  await mkdir(join(outDir, "dist", "assets"), { recursive: true });
  await mkdir(join(outDir, "dist"), { recursive: true });

  const scrapedRaw = await scrapeImages();
  const scraped = Object.fromEntries(
    Object.entries(scrapedRaw).map(([key, images]) => [key, uniqueBySrc(images)]),
  ) as Record<PageKey, ScrapedImage[]>;

  const vfs = new MemoryDriver();
  const processor = await createSharpImageProcessor();

  const logo =
    scraped.despre.find((img) => img.width === img.height) ??
    scraped.despre[0] ??
    (() => {
      throw new Error("No logo image found");
    })();

  // Google serves the same image under several `=w<width>` size URLs, so an
  // exact-src compare lets a logo variant slip through (and become a "portrait").
  // Compare on the size-stripped key instead.
  const imageKey = (img: ScrapedImage): string => img.src.replace(/=w\d+.*$/, "");
  const logoKey = imageKey(logo);
  const isLogo = (img: ScrapedImage): boolean => imageKey(img) === logoKey;

  const aboutImages = scraped.despre.filter((img) => !isLogo(img));
  const activityImages = scraped.activitati.filter((img) => !isLogo(img)).slice(0, 4);
  const teamImages = scraped.echipa
    .filter((img) => !isLogo(img))
    .filter((img) => Math.abs(img.width - img.height) <= 8)
    .slice(0, 10);
  const contactImages = scraped.contact.filter((img) => !isLogo(img));

  const logoRef = await uploadRemoteImage(
    vfs,
    processor,
    logo,
    "historipol-logo.png",
    "Sigla Asociației Studențești HISTORIPOL",
  );

  const activityRefs = await Promise.all(
    activityImages.map((img, idx) =>
      uploadRemoteImage(
        vfs,
        processor,
        img,
        `historipol-activity-${idx + 1}.jpg`,
        [
          "Concursul de discursuri Puterea Cuvintelor",
          "Zilele Europene ale Arheologiei",
          "Discuție despre trasee profesionale după studenție",
          "Campanie de donații pentru copii",
          "Activitate HISTORIPOL pentru comunitatea studențească",
        ][idx] ?? "Activitate HISTORIPOL",
      ),
    ),
  );

  const teamRefs = await Promise.all(
    teamImages.map((img, idx) =>
      uploadRemoteImage(
        vfs,
        processor,
        img,
        `historipol-team-${idx + 1}.jpg`,
        `Portret ${teamPeople[idx]?.name ?? "membru HISTORIPOL"}`,
      ),
    ),
  );

  // The despre/contact pages' only scrapable <img>s are the logo + the ANOSR
  // banner (the real hero is a CSS background, not an <img>), so they aren't
  // usable as photos. The landing hero instead borrows a genuine student photo
  // from the activities so the homepage opens with people behind a scrim.
  const heroRef = activityRefs[2] ?? activityRefs[1] ?? activityRefs[0];
  void aboutImages;
  void contactImages;

  const site: Site = {
    schemaVersion: 1,
    org: {
      name: "Asociația Studențească HISTORIPOL",
      tagline: "Istorie, identitate, comunitate",
      foundedYear: 2024,
      logo: logoRef,
      logoAlt: "Sigla Asociației Studențești HISTORIPOL",
      address: "Universitatea „Ovidius” din Constanța, Facultatea de Istorie și Științe Politice",
      social: [{ platform: "website", url: pages.despre }],
    },
    theme: {
      // Scholarly identity fits a history & political-science association. We
      // keep academic's AA-tuned navy/gold/cream palette and pair it with the
      // self-hosted Fraunces display serif for an elegant, characterful
      // headline (Cormorant Garamond is NOT self-hosted, so it silently fell
      // back to a generic serif — see self-host-fonts policy).
      id: "academic",
      tokens: {
        fontHeadline: "Fraunces",
        fontBody: "Inter",
        density: "comfortable",
        radius: "soft",
      },
    },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "despre-noi",
        lang: "ro",
        navLabel: "Despre noi",
        navOrder: 0,
        showInNav: true,
        seo: {
          title: "Asociația Studențească HISTORIPOL",
          description:
            "HISTORIPOL este o organizație non-guvernamentală, apolitică și non-profit fondată în 2024 de studenți ai Facultății de Istorie și Științe Politice.",
        },
        blocks: [
          {
            id: "blk_about_hero",
            type: "hero",
            version: 1,
            data: {
              title: 'Asociația Studențească "Historipol"',
              subtitle:
                "O comunitate academică pentru studenți și absolvenți pasionați de istorie, relații internaționale, studii europene și științe politice.",
              ...(heroRef !== undefined
                ? {
                    backgroundImage: heroRef,
                    backgroundAlt: "Studenți HISTORIPOL la o activitate a asociației",
                  }
                : {}),
            },
          },
          {
            id: "blk_about_intro",
            type: "richText",
            version: 1,
            data: {
              markdown:
                "Asociația Studențească HISTORIPOL este o organizație non-guvernamentală, apolitică și non-profit, fondată în 2024 de studenți ai Facultății de Istorie și Științe Politice din cadrul Universității „Ovidius” din Constanța. Asociația a luat naștere din dorința de a dezvolta o comunitate academică unită, în care studenții și absolvenții pasionați de istorie, relații internaționale, studii europene și științe politice să se poată dezvolta personal, profesional și civic.\n\n## Misiunea noastră\n\nNe propunem să reprezentăm interesele, nevoile și drepturile studenților FISP și să contribuim la dezvoltarea lor prin proiecte educaționale și culturale. Prin activitățile noastre, promovăm responsabilitatea civică, valorile democratice și implicarea activă în comunitate.\n\n## Viziunea noastră\n\nCredem într-o comunitate academică constănțeană puternică, conectată la instituțiile de profil. Ne dorim ca HISTORIPOL să devină un spațiu de formare pentru tineri care înțeleg rolul istoriei, politicii și culturii în dezvoltarea societății.",
            },
          },
          {
            id: "blk_about_values",
            type: "valueList",
            version: 1,
            data: {
              title: "Valorile care ne ghidează",
              layout: "grid",
              columns: 3,
              items: [
                {
                  icon: "shield",
                  label: "Integritate și responsabilitate",
                  description:
                    "Construim proiecte publice pe bază de asumare, rigoare și respect față de comunitate.",
                },
                {
                  icon: "book",
                  label: "Cunoaștere și gândire critică",
                  description:
                    "Încurajăm întrebările bine puse, cercetarea și dialogul argumentat.",
                },
                {
                  icon: "users",
                  label: "Comunitate și colaborare",
                  description:
                    "Aducem împreună studenți, absolvenți, profesori și instituții culturale.",
                },
                {
                  icon: "scale",
                  label: "Implicare civică și solidaritate",
                  description:
                    "Promovăm participarea activă la viața comunității și sprijinul reciproc.",
                },
                {
                  icon: "graduation-cap",
                  label: "Dezvoltare personală și profesională",
                  description:
                    "Creăm contexte în care studenții își pot forma competențe utile după facultate.",
                },
              ],
            },
          },
          {
            id: "blk_about_cta",
            type: "ctaBanner",
            version: 1,
            data: {
              title: "Vrei să construiești alături de HISTORIPOL?",
              subtitle:
                "Urmărește activitățile noastre și alătură-te comunității studenților FISP.",
              button: {
                label: "Vezi activitățile",
                url: "/activitati/",
                style: "primary",
              },
            },
          },
        ],
      },
      {
        slug: "activitati",
        lang: "ro",
        navLabel: "Activități",
        navOrder: 1,
        showInNav: true,
        seo: {
          title: "Activități HISTORIPOL",
          description:
            "Concursuri, proiecte educaționale, conferințe, campanii sociale și activități pentru liceeni organizate de HISTORIPOL.",
        },
        blocks: [
          {
            id: "blk_activities_hero",
            type: "hero",
            version: 1,
            data: {
              title: "Activități",
              subtitle:
                "Proiecte academice, culturale și civice prin care studenții FISP învață, dezbat și contribuie la comunitate.",
              backgroundImage: activityRefs[1],
              backgroundAlt: "Activitate educațională HISTORIPOL",
            },
          },
          {
            id: "blk_activities_list",
            type: "activitiesList",
            version: 1,
            data: {
              title: "Ce organizăm",
              intro:
                "Proiectele recurente ale asociației combină formarea academică, orientarea profesională și implicarea civică.",
              layout: "cards",
              items: [
                {
                  title: "Concursul de discursuri „Puterea Cuvintelor”",
                  description:
                    "Un cadru în care studenții își exersează argumentarea, prezența publică și claritatea ideilor.",
                  image: activityRefs[0],
                  badge: "Comunicare",
                },
                {
                  title: "Zilele Europene ale Arheologiei",
                  description:
                    "Activitate realizată în colaborare cu Muzeul de Istorie Națională și Arheologie Constanța.",
                  image: activityRefs[1],
                  badge: "Patrimoniu",
                },
                {
                  title: "Călătorii profesionale: de la studenție la carieră",
                  description:
                    "Întâlniri și discuții despre trasee profesionale posibile după studiile în domeniile FISP.",
                  image: activityRefs[2],
                  badge: "Carieră",
                },
                {
                  title:
                    "Campanie anuală de donații pentru copiii din familii cu posibilități financiare reduse",
                  description:
                    "O inițiativă de solidaritate care conectează comunitatea studențească la nevoi sociale concrete.",
                  image: activityRefs[3],
                  badge: "Solidaritate",
                },
                {
                  title: "Conferința Națională a Studenților, Masteranzilor și Doctoranzilor",
                  description:
                    "Conferință dedicată domeniilor Istorie, Științe Politice și Relații Internaționale.",
                  badge: "Academic",
                },
                {
                  title: "Activități educaționale pentru liceeni",
                  description:
                    "Programele „Student pentru o zi” și „Student pentru 3 zile” îi ajută pe liceeni să înțeleagă viața universitară.",
                  badge: "Orientare",
                },
                {
                  title: "Sesiuni de informare despre finalizarea studiilor",
                  description:
                    "Întâlniri utile pentru studenții care se pregătesc de licență, disertație sau pașii administrativi finali.",
                  badge: "Sprijin",
                },
                {
                  title: "Seri de film și cercuri de lectură",
                  description:
                    "Spații recurente de dialog cultural, lectură critică și apropiere între generații de studenți.",
                  badge: "Comunitate",
                },
              ].filter((item) => item.image !== undefined || !("image" in item)),
            },
          },
        ],
      },
      {
        slug: "echipa",
        lang: "ro",
        navLabel: "Echipa",
        navOrder: 2,
        showInNav: true,
        seo: {
          title: "Echipa HISTORIPOL",
          description: "Echipa de conducere și coordonare a Asociației Studențești HISTORIPOL.",
        },
        blocks: [
          {
            id: "blk_team_hero",
            type: "hero",
            version: 1,
            data: {
              title: "Echipa",
              subtitle:
                "Studenții care coordonează reprezentarea, proiectele, comunicarea, fundraising-ul și activitatea internă a asociației.",
            },
          },
          {
            id: "blk_team_grid",
            type: "teamGrid",
            version: 1,
            data: {
              title: "Echipa de coordonare",
              intro: "Conducerea și coordonatorii menționați pe pagina publică HISTORIPOL.",
              columns: 3,
              people: teamPeople.map((person, idx) => ({
                ...person,
                photo: teamRefs[idx],
              })),
            },
          },
        ],
      },
      {
        slug: "unde-ne-gasesti",
        lang: "ro",
        navLabel: "Unde ne găsești",
        navOrder: 3,
        showInNav: true,
        seo: {
          title: "Unde găsești HISTORIPOL",
          description: "Date de contact și repere pentru Asociația Studențească HISTORIPOL.",
        },
        blocks: [
          {
            id: "blk_contact_hero",
            type: "hero",
            version: 1,
            data: {
              title: "Unde ne găsești",
              subtitle:
                "HISTORIPOL activează în cadrul Facultății de Istorie și Științe Politice, Universitatea „Ovidius” din Constanța.",
            },
          },
          {
            id: "blk_contact_card",
            type: "contactCard",
            version: 1,
            data: {
              // Contact details and campus coordinates taken from the public
              // HISTORIPOL "Unde ne găsești" page (the map iframe centred on the
              // Ovidius campus; social handles + e-mail shown there as widgets).
              address: "Aleea Universității nr. 1, Campus, Corp A, etaj 1, sala 114, Constanța",
              email: "asociatia.historipol@gmail.com",
              socials: [
                { platform: "instagram", url: "https://www.instagram.com/asociatiahistripol/" },
                { platform: "facebook", url: "https://www.facebook.com/asociatiahistripol/" },
              ],
              mapEmbed: {
                enabled: true,
                provider: "osm",
                coordinates: [44.217041, 28.623704],
                zoom: 16,
              },
            },
          },
        ],
      },
    ],
  };

  const validation = validate(site);
  if (validation.errors.length > 0) {
    console.error(JSON.stringify(validation.errors, null, 2));
    throw new Error("Generated site did not validate");
  }

  await writeFile(join(outDir, "data.json"), `${JSON.stringify(site, null, 2)}\n`);
  await writeVfsAssets(vfs);

  const dist = build(site);
  for (const [path, text] of dist) {
    const fullPath = join(outDir, "dist", path);
    await mkdir(fullPath.split(/[\\/]/).slice(0, -1).join("\\"), { recursive: true });
    await writeFile(fullPath, text);
  }

  const zip = await exportToZip(site, vfs);
  await writeFile(join(outDir, "historipol-site.zip"), new Uint8Array(await zip.arrayBuffer()));

  const manifest = {
    generatedAt: new Date().toISOString(),
    referencePages: pages,
    imageCounts: Object.fromEntries(
      Object.entries(scraped).map(([key, images]) => [key, images.length]),
    ),
    validationWarnings: validation.warnings,
  };
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Wrote ${outDir}`);
  console.log(`Pages: ${site.pages.map((page) => page.slug).join(", ")}`);
  console.log(`Assets: ${(await vfs.list("assets/")).length}`);
  console.log(`Warnings: ${validation.warnings.length}`);
}

const teamPeople = [
  { name: "Bianca Maria Nicolae", role: "Președinte" },
  { name: "Irina-Cristina Stoenică", role: "Vicepreședinte" },
  { name: "Mihaela Stancana", role: "Vicepreședinte" },
  { name: "Lavinia-Georgiana Marcu", role: "Vicepreședinte" },
  { name: "Mert Emurla", role: "Secretar" },
  { name: "Ana Maria Tudoran", role: "Director Comunicare-PR" },
  { name: "Alexandru Stanescu", role: "Director Educational-Social" },
  { name: "Diana-Violeta Radulescu", role: "Director Fundraising" },
  { name: "Alexandru Marcu", role: "Director HR" },
  { name: "Emi Andrei Iacob", role: "Cenzor" },
];

await main();
