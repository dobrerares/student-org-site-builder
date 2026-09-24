/**
 * A Theme package that declares the Partners Custom Block (ADR 0055), for
 * the editor tests: installed into a Site VFS the way an archive carries it.
 */
import { MemoryDriver } from "@sosb/vfs/memory";

export const PARTNERS_TYPE = "org.example/partners";
export const PARTNERS_PACKAGE_ID = "org.example.declaring";

export const PARTNERS_DECLARATION = {
  formatVersion: 1,
  type: PARTNERS_TYPE,
  version: 1,
  label: { default: "Partners", ro: "Parteneri" },
  description: { default: "Partner logos in groups.", ro: "Logo-uri de parteneri pe grupuri." },
  fields: [
    {
      name: "heading",
      kind: "text",
      label: { default: "Heading", ro: "Titlu" },
      help: { default: "Shown above the groups.", ro: "Apare deasupra grupurilor." },
      required: true,
      maxLength: 40,
    },
    { name: "intro", kind: "richText", label: "Intro" },
    { name: "count", kind: "number", label: "Count", min: 1, max: 9 },
    { name: "showHeadings", kind: "boolean", label: "Show group headings", default: true },
    {
      name: "layout",
      kind: "choice",
      label: "Layout",
      options: [
        { value: "tight", label: { default: "Tight", ro: "Strâns" } },
        { value: "roomy", label: "Roomy" },
      ],
      default: "tight",
    },
    { name: "brochure", kind: "document", label: "Brochure" },
    {
      name: "contact",
      kind: "group",
      label: "Contact",
      fields: [{ name: "email", kind: "text", label: "Email" }],
    },
    {
      name: "groups",
      kind: "list",
      label: "Groups",
      itemLabel: { default: "group", ro: "grup" },
      maxItems: 2,
      item: {
        kind: "group",
        fields: [
          { name: "heading", kind: "text", label: "Group heading", required: true },
          {
            name: "partners",
            kind: "list",
            label: "Partners",
            itemLabel: "partner",
            item: {
              kind: "group",
              fields: [
                { name: "name", kind: "text", label: "Name", required: true },
                { name: "image", kind: "image", label: "Logo" },
                { name: "link", kind: "link", label: "Link" },
              ],
            },
          },
        ],
      },
    },
  ],
};

const enc = new TextEncoder();

/** The package files, bundle-relative. */
export function partnersPackageFiles(
  overrides: { version?: string; declaration?: unknown; id?: string } = {},
): Map<string, Uint8Array> {
  const manifest = {
    formatVersion: 1,
    id: overrides.id ?? PARTNERS_PACKAGE_ID,
    name: "Declaring",
    version: overrides.version ?? "1.0.0",
    builder: { formatVersion: 1 },
    css: "theme.css",
    blocks: ["blocks/partners/block.json"],
  };
  return new Map<string, Uint8Array>([
    ["theme.json", enc.encode(JSON.stringify(manifest))],
    ["theme.css", enc.encode("body{color:#123}")],
    [
      "blocks/partners/block.json",
      enc.encode(JSON.stringify(overrides.declaration ?? PARTNERS_DECLARATION)),
    ],
  ]);
}

/** A Site VFS with the declaring package installed under `themes/<id>/`. */
export async function vfsWithPartnersPackage(
  overrides: Parameters<typeof partnersPackageFiles>[0] = {},
): Promise<MemoryDriver> {
  const vfs = new MemoryDriver();
  const id = overrides.id ?? PARTNERS_PACKAGE_ID;
  for (const [path, bytes] of partnersPackageFiles(overrides)) {
    await vfs.write(`themes/${id}/${path}`, bytes);
  }
  return vfs;
}
