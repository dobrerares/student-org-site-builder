import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";

import { Fragment, h } from "preact";

import { uploadAsset } from "../packages/assets/src/pipeline.ts";
import { createSharpImageProcessor } from "../packages/assets/src/sharp-processor.ts";
import { build } from "../packages/build/src/index.ts";
import type { Site } from "../packages/schema/src/site.ts";
import { validate } from "../packages/schema/src/validate.ts";
import { MemoryDriver } from "../packages/vfs/src/memory.ts";
import { exportToZip } from "../packages/zip/src/export.ts";

Object.assign(globalThis, { React: { createElement: h, Fragment } });

const rootDir = process.cwd();
const sourceDir = join(rootDir, "historipol");
const outDir = join(rootDir, "build", "historipol-sitebuilder");
const require = createRequire(import.meta.url);
const sharp = require("../packages/assets/node_modules/sharp") as typeof import("sharp");

interface AssetRef {
  hash: string;
  path: string;
  metadataPath: string;
  mime: string;
  width: number;
  height: number;
  alt: string;
}

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

async function uploadLocalImage(
  vfs: MemoryDriver,
  processor: Awaited<ReturnType<typeof createSharpImageProcessor>>,
  relativePath: string,
  alt: string,
  crop?: CropBox,
): Promise<AssetRef> {
  const fullPath = join(sourceDir, relativePath);
  const inputBytes = await readFile(fullPath);
  const bytes =
    crop !== undefined
      ? await sharp(inputBytes)
          .rotate()
          .extract({
            left: Math.round(crop.left),
            top: Math.round(crop.top),
            width: Math.round(crop.width),
            height: Math.round(crop.height),
          })
          .jpeg({ quality: 92 })
          .toBuffer()
      : await sharp(inputBytes).rotate().toBuffer();

  return uploadAsset(
    {
      kind: "bytes",
      bytes: new Uint8Array(bytes),
      name: basename(fullPath),
      alt,
    },
    vfs,
    { processor },
  );
}

async function writeVfsAssets(vfs: MemoryDriver): Promise<void> {
  for (const path of await vfs.list("assets/")) {
    const bytes = await vfs.read(path);
    await writeFile(join(outDir, path), bytes);
  }
}

async function writeDist(dist: Map<string, string>): Promise<void> {
  for (const [path, text] of dist) {
    const fullPath = join(outDir, "dist", path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, text);
  }
}

async function copyAssetsForLocalPreview(vfs: MemoryDriver, site: Site): Promise<void> {
  const pageDirs = ["dist", ...site.pages.map((page) => join("dist", page.slug))];
  for (const dir of pageDirs) {
    await mkdir(join(outDir, dir, "assets"), { recursive: true });
  }

  for (const path of await vfs.list("assets/")) {
    const bytes = await vfs.read(path);
    for (const dir of pageDirs) {
      await writeFile(join(outDir, dir, path), bytes);
    }
  }
}

async function main(): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "assets"), { recursive: true });

  const vfs = new MemoryDriver();
  const processor = await createSharpImageProcessor();

  const logoRef = await uploadLocalImage(
    vfs,
    processor,
    "historipol-logo-transparent.png",
    "Sigla Asociației Studențești HISTORIPOL",
  );
  const anosrLogoRef = await uploadLocalImage(
    vfs,
    processor,
    "3.-Logo-ANOSR_fundal-negru(sigla-full-alb).png",
    "Sigla Alianței Naționale a Organizațiilor Studențești din România",
  );

  const activityRefs = await Promise.all([
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Puterea Cuvintelor 2025(1).JPG"),
      "Participanți la concursul de discursuri Puterea Cuvintelor",
      { left: 0, top: 220, width: 2040, height: 1148 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Zilele Europene ale Arheologiei 2024.JPG"),
      "Studenți HISTORIPOL la Zilele Europene ale Arheologiei",
      { left: 0, top: 0, width: 1600, height: 900 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Sesiune de îndrumare despre finalizarea studiilor.JPG"),
      "Sesiune de îndrumare despre finalizarea studiilor",
      { left: 0, top: 160, width: 1600, height: 900 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Activitate caritabilă 2025.JPG"),
      "Activitate caritabilă HISTORIPOL în 2025",
      { left: 0, top: 210, width: 2048, height: 1152 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Conferința HISTORY-SEA, ed1.JPG"),
      "Conferința HISTORY-SEA organizată de HISTORIPOL",
      { left: 0, top: 260, width: 1035, height: 582 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Activități", "Seară de film la Zbor Hub.JPG"),
      "Seară de film organizată la Zbor Hub",
      { left: 0, top: 80, width: 1600, height: 900 },
    ),
  ]);

  const teamPhotos = await Promise.all([
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "Președinte-Bianca Maria Nicolae.JPG"),
      "Portret Bianca Maria Nicolae, președinte HISTORIPOL",
      { left: 250, top: 760, width: 620, height: 620 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "VP Irina-Cristina Stoenică.jpg"),
      "Portret Irina-Cristina Stoenică, vicepreședinte HISTORIPOL",
      { left: 170, top: 190, width: 380, height: 380 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "VP Mihaela Stancana.JPG"),
      "Portret Mihaela Stancana, vicepreședinte HISTORIPOL",
      { left: 170, top: 170, width: 760, height: 760 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "VP- Lavinia-Georgiana Marcu.jpg"),
      "Portret Lavinia-Georgiana Marcu, vicepreședinte HISTORIPOL",
      { left: 130, top: 130, width: 850, height: 850 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "Cenzor - Emi Andrei Iacob.JPG"),
      "Portret Emi Andrei Iacob, cenzor HISTORIPOL",
      { left: 400, top: 1040, width: 600, height: 600 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "Director Comunicare-PR – Ana-Maria Tudoran.JPG"),
      "Portret Ana-Maria Tudoran, director Comunicare-PR HISTORIPOL",
      { left: 80, top: 70, width: 1100, height: 1100 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "Director Educațional-Social – Alexandru Stănescu.JPG"),
      "Portret Alexandru Stănescu, director Educațional-Social HISTORIPOL",
      { left: 70, top: 260, width: 930, height: 930 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join(
        "Poze site",
        "Echipa",
        "Director Fundrasing – Scriere proiecte - Diana-Violeta Rădulescu .JPG",
      ),
      "Portret Diana-Violeta Rădulescu, director Fundraising și Scriere proiecte HISTORIPOL",
      { left: 0, top: 160, width: 1060, height: 1060 },
    ),
    uploadLocalImage(
      vfs,
      processor,
      join("Poze site", "Echipa", "Director HR – Alexandru Marcu.JPG"),
      "Portret Alexandru Marcu, director HR HISTORIPOL",
      { left: 310, top: 310, width: 820, height: 820 },
    ),
  ]);

  const teamPeople = [
    {
      name: "Bianca Maria Nicolae",
      role: "Președinte",
      department: "Biroul executiv",
      photo: teamPhotos[0],
    },
    {
      name: "Irina-Cristina Stoenică",
      role: "Vicepreședinte",
      department: "Biroul executiv",
      photo: teamPhotos[1],
    },
    {
      name: "Mihaela Stancana",
      role: "Vicepreședinte",
      department: "Biroul executiv",
      photo: teamPhotos[2],
    },
    {
      name: "Lavinia-Georgiana Marcu",
      role: "Vicepreședinte",
      department: "Biroul executiv",
      photo: teamPhotos[3],
    },
    {
      name: "Mert Emurla",
      role: "Secretar",
      department: "Biroul executiv",
    },
    {
      name: "Emi Andrei Iacob",
      role: "Cenzor",
      department: "Control intern",
      photo: teamPhotos[4],
    },
    {
      name: "Ana-Maria Tudoran",
      role: "Director Comunicare-PR",
      department: "Departamente",
      photo: teamPhotos[5],
    },
    {
      name: "Alexandru Stănescu",
      role: "Director Educațional-Social",
      department: "Departamente",
      photo: teamPhotos[6],
    },
    {
      name: "Diana-Violeta Rădulescu",
      role: "Director Fundraising - Scriere proiecte",
      department: "Departamente",
      photo: teamPhotos[7],
    },
    {
      name: "Alexandru Marcu",
      role: "Director HR",
      department: "Departamente",
      photo: teamPhotos[8],
    },
  ];

  const footerBlock = (id: string) => ({
    id,
    type: "siteFooter" as const,
    version: 1 as const,
    data: {
      contactTitle: "Contact",
      email: "asociatia.historipol@gmail.com",
      socials: [
        {
          platform: "instagram",
          url: "https://www.instagram.com/asociatia_historipol?igsh=MXcyYTh3YjY3YWxtcw==",
        },
        {
          platform: "facebook",
          url: "https://www.facebook.com/share/1And48qLPo/?mibextid=wwXIfr",
        },
      ],
      membership: {
        text: "HISTORIPOL este membră ANOSR",
        name: "Alianța Națională a Organizațiilor Studențești din România",
        url: "https://anosr.ro",
        logo: anosrLogoRef,
      },
    },
  });

  const site: Site = {
    schemaVersion: 1,
    org: {
      name: "Asociația Studențească HISTORIPOL",
      tagline: "Istorie, identitate, comunitate",
      foundedYear: 2024,
      logo: logoRef,
      logoAlt: "Sigla Asociației Studențești HISTORIPOL",
      address: "Aleea Universității nr. 1, Campus, Corp A, etaj 1, sala 114, Constanța",
      email: "asociatia.historipol@gmail.com",
      social: [
        {
          platform: "instagram",
          url: "https://www.instagram.com/asociatia_historipol?igsh=MXcyYTh3YjY3YWxtcw==",
        },
        { platform: "facebook", url: "https://www.facebook.com/share/1And48qLPo/?mibextid=wwXIfr" },
      ],
    },
    theme: {
      id: "academic",
      tokens: {
        colorPrimary: "#1f3a5f",
        colorAccent: "#8f5f18",
        fontHeadline: "Source Serif 4",
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
              title: "Asociația Studențească HISTORIPOL",
              subtitle:
                "O comunitate academică unită pentru studenți și absolvenți pasionați de istorie, relații internaționale, studii europene și științe politice.",
              backgroundImage: activityRefs[2],
              backgroundAlt: "Studenți HISTORIPOL la o sesiune de îndrumare academică",
            },
          },
          {
            id: "blk_about_intro",
            type: "richText",
            version: 1,
            data: {
              titleAlign: "left",
              paragraphAlign: "justify",
              markdown:
                "## Despre noi\n\nAsociația Studențească HISTORIPOL este o organizație non-guvernamentală, apolitică și non-profit, fondată în 2024 de studenți ai Facultății de Istorie și Științe Politice din cadrul Universității „Ovidius” din Constanța. Asociația a luat naștere din dorința de a dezvolta o comunitate academică unită, în care studenții și absolvenții pasionați de istorie, relații internaționale, studii europene și științe politice să se poată dezvolta personal, profesional și civic.\n\n## Misiunea noastră\n\nNe propunem să reprezentăm interesele, nevoile și drepturile studenților FISP și să contribuim la dezvoltarea lor prin proiecte educaționale și culturale. Prin activitățile noastre, promovăm responsabilitatea civică, valorile democratice și implicarea activă în comunitate.\n\n## Viziunea noastră\n\nCredem într-o comunitate academică constănțeană puternică, conectată la instituțiile de profil. Ne dorim ca HISTORIPOL să devină un spațiu de formare pentru tineri care înțeleg rolul istoriei, politicii și culturii în dezvoltarea societății.",
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
                    "Lucrăm transparent și asumăm deciziile luate pentru comunitatea FISP.",
                },
                {
                  icon: "book",
                  label: "Cunoaștere și gândire critică",
                  description: "Încurajăm cercetarea, argumentarea și dialogul academic deschis.",
                },
                {
                  icon: "users",
                  label: "Comunitate și colaborare",
                  description:
                    "Aducem împreună studenți, absolvenți, profesori și parteneri instituționali.",
                },
                {
                  icon: "scale",
                  label: "Implicare civică și solidaritate",
                  description:
                    "Transformăm preocupările academice în proiecte utile pentru comunitatea locală.",
                },
                {
                  icon: "graduation-cap",
                  label: "Dezvoltare personală și profesională",
                  description:
                    "Construim contexte prin care studenții își pot testa și forma competențele.",
                },
              ],
            },
          },
          {
            id: "blk_about_gallery",
            type: "imageGallery",
            version: 1,
            data: {
              title: "Din activitățile noastre",
              layout: "grid",
              columns: 3,
              lightbox: true,
              images: [
                {
                  asset: activityRefs[0],
                  alt: "Concursul de discursuri Puterea Cuvintelor",
                  caption: "Puterea Cuvintelor",
                },
                {
                  asset: activityRefs[1],
                  alt: "Zilele Europene ale Arheologiei",
                  caption: "Zilele Europene ale Arheologiei",
                },
                {
                  asset: activityRefs[4],
                  alt: "Conferința HISTORY-SEA",
                  caption: "Conferința HISTORY-SEA",
                },
              ],
            },
          },
          footerBlock("blk_about_footer"),
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
            "Concursuri, conferințe, activități educaționale, campanii sociale și proiecte culturale organizate de HISTORIPOL.",
        },
        blocks: [
          {
            id: "blk_activities_hero",
            type: "hero",
            version: 1,
            data: {
              title: "Activități",
              subtitle:
                "Proiecte academice, culturale și civice destinate studenților, liceenilor și comunității locale.",
              backgroundImage: activityRefs[2],
              backgroundAlt: "Studenți la o sesiune de îndrumare HISTORIPOL",
            },
          },
          {
            id: "blk_activities_list",
            type: "activitiesList",
            version: 1,
            data: {
              title: "Activitățile noastre",
              intro:
                "Asociația desfășoară activități diverse, destinate atât studenților, cât și comunității locale.",
              layout: "cards",
              items: [
                {
                  title: "Concursul de discursuri „Puterea Cuvintelor”",
                  description:
                    "Un proiect dedicat exprimării publice, argumentării și încrederii în propria voce.",
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
                    "Întâlniri despre trasee profesionale și pașii de după finalizarea studiilor.",
                  image: activityRefs[2],
                  badge: "Carieră",
                },
                {
                  title:
                    "Campanie anuală de donații pentru copiii din familii cu posibilități financiare reduse",
                  description:
                    "O inițiativă de solidaritate prin care studenții contribuie la nevoi sociale concrete.",
                  image: activityRefs[3],
                  badge: "Solidaritate",
                },
                {
                  title: "Conferința Națională a Studenților, Masteranzilor și Doctoranzilor",
                  description:
                    "Conferință dedicată domeniilor Istorie, Științe Politice și Relații Internaționale.",
                  image: activityRefs[4],
                  badge: "Academic",
                },
                {
                  title: "Seri de film și cercuri de lectură",
                  description:
                    "Spații de dialog cultural și apropiere între studenții interesați de istorie și politică.",
                  image: activityRefs[5],
                  badge: "Comunitate",
                },
                {
                  title: "Activități educaționale pentru liceeni",
                  description:
                    "Programele „Student pentru o zi” și „Student pentru 3 zile” îi familiarizează pe liceeni cu viața universitară.",
                  badge: "Orientare",
                },
                {
                  title: "Sesiuni de informare despre finalizarea studiilor",
                  description:
                    "Întâlniri utile pentru licență, disertație și pașii administrativi finali.",
                  badge: "Sprijin",
                },
              ],
            },
          },
          footerBlock("blk_activities_footer"),
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
                "HISTORIPOL este formată din 41 de membri și voluntari, organizați în departamente care susțin proiectele și reprezentarea studenților.",
            },
          },
          {
            id: "blk_team_grid",
            type: "teamGrid",
            version: 1,
            data: {
              title: "Echipa noastră",
              intro:
                "Conducerea asociației și coordonatorii departamentelor Educațional & Social, Comunicare & PR, Fundraising & Scriere de proiecte și Human Resources.",
              columns: 3,
              groupBy: "department",
              people: teamPeople,
            },
          },
          footerBlock("blk_team_footer"),
        ],
      },
      {
        slug: "unde-ne-gasesti",
        lang: "ro",
        navLabel: "Unde ne găsești",
        navOrder: 3,
        showInNav: true,
        seo: {
          title: "Unde ne găsești - HISTORIPOL",
          description:
            "Adresa, emailul și conturile de social media ale Asociației Studențești HISTORIPOL.",
        },
        blocks: [
          {
            id: "blk_contact_hero",
            type: "hero",
            version: 1,
            data: {
              title: "Unde ne găsești",
              subtitle:
                "Ne găsești în Campusul Universității „Ovidius” din Constanța și pe canalele sociale ale asociației.",
            },
          },
          {
            id: "blk_contact_card",
            type: "contactCard",
            version: 1,
            data: {
              headline: "Contact",
              address:
                "Aleea Universității nr. 1, Campus, Corp A, etaj 1, sala 114, Constanța, România",
              email: "asociatia.historipol@gmail.com",
              socials: [
                {
                  platform: "instagram",
                  url: "https://www.instagram.com/asociatia_historipol?igsh=MXcyYTh3YjY3YWxtcw==",
                },
                {
                  platform: "facebook",
                  url: "https://www.facebook.com/share/1And48qLPo/?mibextid=wwXIfr",
                },
              ],
              mapEmbed: {
                enabled: true,
                provider: "osm",
                coordinates: [44.217041, 28.623704],
                zoom: 16,
              },
            },
          },
          {
            id: "blk_contact_cta",
            type: "ctaBanner",
            version: 1,
            data: {
              title: "Vrei să iei legătura cu noi?",
              subtitle:
                "Scrie-ne pentru colaborări, întrebări despre activități sau informații despre înscriere.",
              button: {
                label: "Trimite email",
                url: "mailto:asociatia.historipol@gmail.com",
                style: "primary",
              },
            },
          },
          footerBlock("blk_contact_footer"),
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
  await writeDist(build(site));
  await copyAssetsForLocalPreview(vfs, site);

  const zip = await exportToZip(site, vfs);
  await writeFile(
    join(outDir, "historipol-sitebuilder.zip"),
    new Uint8Array(await zip.arrayBuffer()),
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir,
    output: {
      dataJson: "data.json",
      preview: "dist/index.html",
      zip: "historipol-sitebuilder.zip",
    },
    validationWarnings: validation.warnings,
    pages: site.pages.map((page) => page.slug),
    assets: (await vfs.list("assets/")).length,
  };
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Wrote ${outDir}`);
  console.log(`Pages: ${site.pages.map((page) => page.slug).join(", ")}`);
  console.log(`Assets: ${manifest.assets}`);
  console.log(`Warnings: ${validation.warnings.length}`);
}

await main();
