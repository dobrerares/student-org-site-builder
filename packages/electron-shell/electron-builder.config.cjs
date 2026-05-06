/**
 * electron-builder config for `@sosb/electron-shell`.
 *
 * Three platform targets, one config:
 *
 * - macOS:  .dmg          (unsigned; see ../../.out-of-scope/mac-code-signing.md)
 * - Win:    .exe (NSIS)   (unsigned)
 * - Linux:  .AppImage
 *
 * Per-platform CI runners (see `.github/workflows/release.yml`) build
 * their own native installer; cross-platform builds from a single runner
 * are supported by electron-builder for non-signed Linux, but signed mac
 * builds in particular need to run on macOS.
 *
 * Mac code signing and Apple notarization are deliberately out of scope
 * for v1 (issue #44 closed as wontfix). `mac.identity = null` tells
 * electron-builder explicitly NOT to attempt signing — without this,
 * electron-builder will hunt for a Developer ID and fail on a fresh CI
 * runner.
 *
 * The `files` glob is intentionally narrow: only the compiled `dist/`,
 * the `renderer/` HTML, and the package manifest. Test files, the
 * builder config itself, and the source `.ts` are excluded.
 *
 * The `publish` block declares the GitHub Releases provider that both
 * electron-builder (during `--publish always`) and electron-updater (at
 * runtime) consume. electron-updater reads the same config to know which
 * GitHub repo to poll for new releases.
 *
 * Reference: https://www.electron.build/configuration/configuration
 *            https://www.electron.build/configuration/publish#githuboptions
 *
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: "ro.cta.sosb",
  productName: "Student Org Site Builder",
  copyright: "© 2026 SOSB Contributors",
  directories: {
    output: "dist-electron",
    buildResources: "build",
  },
  files: [
    "dist/**/*",
    "renderer/**/*",
    "package.json",
    "!**/*.map",
    "!**/__tests__/**",
    "!**/test/**",
  ],
  mac: {
    target: [{ target: "dmg", arch: ["x64", "arm64"] }],
    category: "public.app-category.developer-tools",
    // Code signing is OUT OF SCOPE for v1 — see ../../.out-of-scope/mac-code-signing.md
    // and issue #44. Setting `identity: null` makes the unsigned build
    // explicit instead of relying on environment-dependent autodetection.
    identity: null,
  },
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    category: "Development",
  },
  // Auto-update channel for #36. electron-updater consumes this block at
  // runtime via `app-update.yml` (electron-builder generates that file
  // from `publish` and packs it into the installer). Single stable
  // channel for v1 — no `releaseType: "draft"` or per-channel branching.
  publish: [
    {
      provider: "github",
      owner: "dobrerares",
      repo: "student-org-site-builder",
      // PRD: "Single stable channel for v1." Pre-releases are excluded.
      releaseType: "release",
    },
  ],
};
