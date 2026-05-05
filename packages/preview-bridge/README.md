# @sosb/preview-bridge

postMessage protocol between the editor host and the preview iframe.

## Protocol

Every message is wrapped in an envelope `{ channel, version, payload }`.
Decoders reject envelopes from a different channel or from a future
protocol version.

- Host → Iframe: `{ type: "siteData", siteData, themeId, pageIndex? }`.
- Iframe → Host: `{ type: "ready" }`, `{ type: "error", message }`.

## Surface

- `encodeHostMessage` / `decodeHostMessage`
- `encodePreviewMessage` / `decodePreviewMessage`
- `createPreviewHost({ iframe, onPreviewEvent? })` — the host-side helper
  with `postSiteData` and `handleIncomingMessage`.
- `PREVIEW_BRIDGE_CHANNEL`, `PREVIEW_BRIDGE_VERSION`.

See ADR-0005 for the design.
