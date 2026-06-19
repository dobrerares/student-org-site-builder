/**
 * Default rows for BlockForm array editors.
 *
 * BlockForm is schema-generic, so production callers provide block-aware
 * defaults for arrays whose element schemas require non-empty fields.
 */

function normalizedPath(path: readonly (string | number)[]): string {
  return path.map((segment) => (typeof segment === "number" ? "[]" : segment)).join(".");
}

function makeItemId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const tick = Date.now().toString(36);
  return `${prefix}_${tick}${rand}`;
}

export function defaultArrayItemForBlock(
  blockType: string,
  arrayPath: readonly (string | number)[],
): unknown {
  switch (`${blockType}:${normalizedPath(arrayPath)}`) {
    case "activitiesList:items":
      return { title: "New activity" };
    case "contactCard:socials":
      return { platform: "website", url: "/" };
    case "eventList:events":
      return {
        id: makeItemId("evt"),
        title: "New event",
        startsAt: "2099-01-01T18:00:00+02:00",
      };
    case "faq:items":
      return { question: "Question?", answer: "Answer." };
    case "teamGrid:people":
      return { name: "Member name", role: "Role" };
    case "teamGrid:people.[].socials":
      return { platform: "website", url: "/" };
    case "valueList:items":
      return { label: "New value" };
    default:
      return {};
  }
}
