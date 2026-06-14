# Student Org Site Builder

A free, open-source, no-backend site builder for student organizations.

> Status: v1 in active development. The [v1 PRD](docs/PRD.md) is the source of
> truth for scope and design intent. Implementation is tracked through the
> [issues backlog](../../issues).

## What this is

A cross-platform desktop app (Electron) and hosted browser SPA, sharing one
codebase, that lets a student organization produce a polished, accessible,
multi-page website without writing code, hosting a backend, or being locked
into a vendor.

The output is a portable zip containing the org's canonical content
(`data.json`), assets (`assets/`), and a built static site (`dist/`) ready to
deploy to Cloudflare Pages.

## Who it's for

Romanian student organizations, and similar contexts elsewhere. The realities
the tool is designed around:

- A small leadership team (President, Vice-Presidents, Directors), most
  non-technical.
- Membership that turns over yearly, so every September the team page changes
  meaningfully.
- A standard set of recurring sections: about, mission, vision, values,
  activities, team, contact.
- Romanian-primary content, occasional bilingual needs (RO + EN) for
  international conferences, diaspora, exchange contexts.
- No budget for hosting and no in-house designer or developer.
- Real quality expectations: the public site must look like a serious student
  organization's, not a free-template carnival.

See the [PRD problem statement](docs/PRD.md#problem-statement) for the full
context on why existing tools (SaaS site builders, WordPress, hand-built sites,
Linktree) fall short.

## Highlights (planned for v1)

- Cross-platform desktop app + hosted browser SPA, same codebase.
- Block-based content authoring with a side-by-side live preview.
- 15 blocks covering About / Mission / Values / Team / Activities / Contact /
  Gallery / Quotes / CTAs / Partners / FAQ / Embeds / Documents / Events /
  custom HTML.
- Multi-page sites; optional bilingual (RO + EN) with separate page trees and
  `hreflang` annotations.
- 5 themes (Academic, Modern, Editorial, Civic, Minimal) with token-based
  per-org customization (palette, fonts, density, corner radius).
- Portable zip artifact: `data.json` + `assets/` + `dist/` round-trip.
- Accessible (WCAG 2.2 AA), performant (Lighthouse 95+), SEO-rich (full
  Schema.org JSON-LD).
- No telemetry, no backend, no third-party scripts by default.
- Cloudflare Pages as the documented deploy target; zip output is portable to
  any static host.

## Editor distributions

Two distributions are planned, both running the same Preact-based editor and
the same renderer:

- **Browser editor** — a hosted SPA. Useful when the user prefers not to
  install software, or works on a school-managed device. Round-trips through
  in-browser persistence (OPFS / IndexedDB) and a downloadable zip.
- **Electron desktop app** — Windows / macOS / Linux. Useful when the user
  wants offline work, native filesystem access, and a long-lived workspace.

The split is owned by the host shells (`@sosb/browser-shell`,
`@sosb/electron-shell`); the editor itself is environment-agnostic.

## Quick start (dev)

Prerequisites: **Node.js 20.9.0+** and **Corepack** (no global pnpm install
needed). See [CONTRIBUTING.md](CONTRIBUTING.md#prerequisites).

```bash
git clone https://github.com/dobrerares/student-org-site-builder.git
cd student-org-site-builder
corepack enable
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

A clean clone walks through `install -> typecheck -> lint -> test -> build`
without manual fixups. CI runs the same four checks on every PR against
`main` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

For a deeper dive — repo layout, package boundaries, testing conventions,
how to add a block, how to add a theme, how to add an ADR, commit message
conventions — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Repo layout (high level)

```
.
|-- .github/             # Issue + PR templates, CI workflow
|-- docs/
|   |-- PRD.md           # v1 product specification (source of truth)
|   |-- adr/             # Architecture Decision Records
|   |-- agents/          # Conventions for AI / agent contributors
|   `-- how-to-add-a-block.md   # Block implementation walkthrough
|-- e2e/                 # Playwright end-to-end tests
|-- packages/            # pnpm workspace packages (one per module)
|-- AGENTS.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- LICENSE
`-- README.md            # this file
```

## Documentation map

| Audience                               | Start here                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Reading the project for the first time | [docs/PRD.md](docs/PRD.md) — the v1 spec.                                                        |
| Setting up locally to contribute       | [CONTRIBUTING.md](CONTRIBUTING.md).                                                              |
| Adding a new block type                | [docs/how-to-add-a-block.md](docs/how-to-add-a-block.md).                                        |
| Adding a new theme                     | [ADR 0032](docs/adr/0032-renderer-skeleton-and-determinism.md).                                  |
| Architectural decisions                | [docs/adr/](docs/adr/) — numbered, dated, immutable.                                             |
| Filing an issue                        | [Issue templates](.github/ISSUE_TEMPLATE/) and the [agents notes](docs/agents/issue-tracker.md). |
| Conduct                                | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).                                                        |

## Status

v1 implementation is substantially complete: all 15 workspace packages have
landed real implementations, including schema, renderer (15 Blocks x 5
themes with a golden-file matrix), markdown, vfs, assets, zip round-trip,
build pipeline, i18n (RO/EN), editor state, preview bridge, editor app with
the universal Asset picker, wizard, themes, and both host shells (browser and
Electron). Current work focuses on the theme visual refresh
(`docs/superpowers/specs/2026-05-28-themes-pizzaz-design.md`) and items in
the [issues backlog](../../issues). [`docs/PRD.md`](docs/PRD.md) remains the
source of truth for scope.

## License

[MIT](LICENSE) — copyright the Student Org Site Builder contributors.
