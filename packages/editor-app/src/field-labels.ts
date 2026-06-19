import type { FieldNode } from "./form-generator.js";

const FIELD_LABELS: Readonly<Record<string, string>> = {
  org: "Organization",
  pages: "Pages",
  seo: "Google result",
  legalName: "Official organization name",
  shortName: "Display name",
  logo: "Logo",
  logoAlt: "Logo description",
  defaultLanguage: "Main language",
  defaultLang: "Main language",
  languages: "Languages",
  lang: "Language",
  slug: "Page link name",
  navLabel: "Menu label",
  localizedAs: "Linked translation",
  title: "Title",
  description: "Description",
  subtitle: "Subtitle",
  intro: "Intro text",
  layout: "Layout",
  columns: "Columns",
  lightbox: "Open images in a larger view",
  images: "Images",
  image: "Image",
  backgroundImage: "Background image",
  backgroundAlt: "Image description",
  authorImageAlt: "Image description",
  imageAlt: "Image description",
  alt: "Image description",
  asset: "File",
  files: "Files",
  file: "File",
  label: "Label",
  url: "Link",
  href: "Link",
  button: "Button",
  style: "Style",
  items: "Items",
  item: "Item",
  icon: "Icon",
  caption: "Caption",
  partners: "Partners",
  partner: "Partner",
  people: "People",
  person: "Person",
  name: "Name",
  role: "Role",
  bio: "Bio",
  photo: "Photo",
  events: "Events",
  event: "Event",
  date: "Date",
  location: "Location",
  address: "Address",
  email: "Email",
  phone: "Phone",
  socials: "Social links",
  socialLinks: "Social links",
  question: "Question",
  answer: "Answer",
  quote: "Quote",
  author: "Author",
  text: "Text",
  markdown: "Text",
  titleAlign: "Title alignment",
  paragraphAlign: "Paragraph alignment",
  presentation: "Presentation",
  html: "Embed code",
  sanitize: "Keep embed code safe",
};

const VALUE_LABELS: Readonly<Record<string, string>> = {
  en: "English",
  ro: "Romanian",
  grid: "Grid",
  list: "List",
  cards: "Cards",
  alternating: "Alternating",
  masonry: "Masonry",
  primary: "Primary",
  secondary: "Secondary",
  solid: "Solid",
  outline: "Outline",
  left: "Left",
  center: "Center",
  right: "Right",
  justify: "Justify",
  footer: "Footer",
};

export function fieldLabel(node: FieldNode): string {
  return node.label ?? labelForName(node.name);
}

export function labelForName(name: string): string {
  return FIELD_LABELS[name] ?? humanizeIdentifier(name);
}

export function optionLabel(value: string): string {
  return VALUE_LABELS[value] ?? humanizeIdentifier(value);
}

export function issuePathLabel(path: readonly (string | number)[]): string {
  if (path.length === 0) return "Site";

  const parts: string[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (segment === undefined) continue;
    if (typeof segment === "number") {
      const parent = path[index - 1];
      if (parent === "pages") {
        parts.push(`page ${segment + 1}`);
      } else if (parent === "blocks") {
        parts.push(`section ${segment + 1}`);
      } else {
        parts.push(`item ${segment + 1}`);
      }
      continue;
    }
    parts.push(segment === "blocks" ? "Page sections" : labelForName(segment));
  }

  return parts.filter((part, index) => part !== parts[index - 1]).join(" > ");
}

function humanizeIdentifier(value: string): string {
  if (value.length === 0) return value;
  const expanded = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return expanded.charAt(0).toUpperCase() + expanded.slice(1);
}
