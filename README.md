# Student Org Site Builder

A free, open-source, no-backend site builder for student organizations.

**Status:** v1 in design. See the [v1 PRD](docs/PRD.md) for the full specification.

## What this is

A cross-platform desktop app (Electron) and hosted browser SPA that lets a student organization produce a polished, accessible, multi-page website without writing code, hosting a backend, or being locked into a vendor.

Output is a portable zip containing the org's data (`data.json`), assets, and a built static site (`dist/`) ready to deploy to Cloudflare Pages.

## Highlights (planned for v1)

- Cross-platform desktop app + hosted browser SPA, same codebase
- Block-based content authoring with live preview
- 15 blocks covering About / Mission / Values / Team / Activities / Contact / Gallery / Quotes / CTAs / Partners / FAQ / Embeds / Documents / Events / custom HTML
- Multi-page sites, optional bilingual (RO + EN) with separate page trees and `hreflang`
- 5 themes (Academic, Modern, Editorial, Civic, Minimal) with token-based per-org customization
- Portable zip artifact: `data.json` + `assets/` + `dist/` round-trip
- WCAG 2.2 AA, Lighthouse 95+ on built sites, full Schema.org JSON-LD
- No telemetry, no backend, no third-party scripts by default
- Cloudflare Pages as the documented deploy target

## Status

This repository was created from an architectural grilling session that produced the v1 specification. Implementation has not started. Track v1 progress via the [issues backlog](../../issues), with [`docs/PRD.md`](docs/PRD.md) as the source of truth.

## License

[MIT](LICENSE) — copyright the Student Org Site Builder contributors.
