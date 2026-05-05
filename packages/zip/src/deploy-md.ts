/**
 * Placeholder content for `DEPLOY.md` in the exported zip.
 *
 * v1 of issue #6 ships a single English placeholder. The real
 * bilingual deployment guide lives in its own documentation issue
 * (it is the user-visible "how to publish to Cloudflare Pages" guide
 * the PRD pins as a quality commitment for v1). The placeholder is
 * still useful: it gives importers something to grep for in case
 * they want to verify the zip layout looks right.
 *
 * The text is exported as a constant (not read from disk) so the
 * exported zip is fully self-contained — no runtime file read needed
 * either in the browser or in Node.
 */
export const DEPLOY_MD = `# Deploy

This zip contains your site's canonical data, your assets, and a placeholder
\`dist/\` folder. Real \`dist/\` content (the built static site) is filled in
by the build step (issue #5).

## Layout

\`\`\`
data.json              # canonical site data — the source of truth
assets/                # content-addressed media (images, documents)
dist/                  # built static site (placeholder in v1)
DEPLOY.md              # this file
\`\`\`

## Importing back into the editor

Drag this zip onto the editor's welcome screen, or use the "Import" option
on the welcome screen, to resume editing exactly where you left off.

## Publishing to Cloudflare Pages

The full bilingual deployment guide is shipped with later releases. In
the meantime: the \`dist/\` folder is a static site — upload it to any
static host. Cloudflare Pages is the recommended target.
`;
