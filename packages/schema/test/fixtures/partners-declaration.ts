/**
 * The Partners Custom Block declaration the tests share: every field kind in
 * the vocabulary, nested lists of groups, translated labels, and each
 * supported validation rule at least once.
 */
export const PARTNERS_DECLARATION = {
  formatVersion: 1,
  type: "org.example/partners",
  version: 1,
  label: { default: "Partners", ro: "Parteneri" },
  description: "A heading and groups of partner logos.",
  fields: [
    { name: "heading", kind: "text", label: "Heading", required: true, maxLength: 80 },
    { name: "intro", kind: "richText", label: { default: "Intro", ro: "Introducere" } },
    { name: "showHeadings", kind: "boolean", label: "Show group headings", default: true },
    {
      name: "layout",
      kind: "choice",
      label: "Layout",
      options: [
        { value: "tight", label: "Tight" },
        { value: "roomy", label: { default: "Roomy", ro: "Aerisit" } },
      ],
      default: "tight",
    },
    { name: "count", kind: "number", label: "Count", min: 0, max: 10 },
    { name: "brochure", kind: "document", label: "Brochure" },
    {
      name: "contact",
      kind: "group",
      label: "Contact",
      fields: [
        { name: "email", kind: "text", label: "Email" },
        { name: "phone", kind: "text", label: "Phone" },
      ],
    },
    {
      name: "groups",
      kind: "list",
      label: "Groups",
      itemLabel: "Group",
      maxItems: 5,
      item: {
        kind: "group",
        fields: [
          { name: "heading", kind: "text", label: "Group heading", required: true },
          {
            name: "partners",
            kind: "list",
            label: "Partners",
            itemLabel: "Partner",
            item: {
              kind: "group",
              fields: [
                { name: "name", kind: "text", label: "Name", required: true, maxLength: 60 },
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
