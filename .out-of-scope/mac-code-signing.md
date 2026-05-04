# Mac Code Signing & Notarization

This project does not pursue Apple Developer notarization for macOS builds.

## Why this is out of scope

The desktop builds ship unsigned on both Windows and macOS for v1. On macOS, users can still open the app via the "right-click → Open" Gatekeeper override, which is documented in the install guide.

Apple Developer notarization requires:

- A paid Apple Developer Program membership ($99/year, recurring)
- Certificate management and credential storage in CI
- A notarization step that adds latency and an additional failure surface to every release

The cost-benefit doesn't land for a project of this size. An extra Gatekeeper click on first launch is acceptable for a tool whose primary audience — student organisations setting up a website — installs once and rarely re-installs.

If the project later acquires institutional backing that covers the membership fee, or if user volume justifies the recurring cost, this decision can be revisited.

## Prior requests

- #44 — Code signing for Mac (Apple Developer notarization)
