# Node 24 runtime migration

The next coordinated releases require **Node 24 (`24.x`)**. This checkout uses
the same runtime for development, CLI execution, package verification and site
builds. Node 20 and 22 users must upgrade. Node 26 is outside the supported
runtime range. Browser entrypoints keep their existing browser targets.

Use the latest available Node 24 patch. With nvm, run `nvm install` and `nvm use`
from a checkout containing `.nvmrc`; with another manager, select Node 24
explicitly. Confirm `node --version` reports `v24.*`, then install the package
manager version recorded in that repository's `package.json`.

- Core/CLI and all three sites: run `pnpm install --frozen-lockfile`.
- Renderer, editor and PPTX repositories: run `npm ci`, including optional
  platform packages needed by Sharp.
- For unpublished coordinated packages, build core and run
  `node scripts/link-ecosystem.mjs --packages-only` from core before dependent
  builds. Use `pnpm pack:ecosystem`, `pnpm test:packed-ecosystem` and
  `pnpm test:packed-browser` to verify fresh candidate installations.
- Repeat the essential offline author/import → layout/preview → edit/undo →
  export/reimport workflows on Node 24. Linux, Windows, macOS and browser checks
  remain where they cover distinct behavior. Node 20 duplicate jobs are retired.
- The three sites declare `engines.node: "24.x"`. Check the deployed Git commit,
  actual build log runtime and deployed workflows after each public deployment.
  A project setting alone is not evidence that a new deployment succeeded.
- The separate pptx.dev SDK/CLI workspace also targets Node 24. Its Python CLI
  wrapper needs Node 24 on `PATH` or in `PPTX_NODE_BIN`; its Homebrew formula
  selects `node@24` explicitly.

This is a breaking runtime requirement for the next releases. Allocate new
versions and include it in release notes; do not republish an existing version.
`release-plan.json`, registry dependency locks and published-version evidence
continue to describe the actual published set until publication succeeds.

Historical Node 20 results, their immutable verifiers and archived runtime bytes
remain unchanged. They document earlier checkpoints and do not require new
dual-runtime runs. In particular, removing Node 20 does not close native font,
tab-position, image, PowerPoint or Excel gates. The Windows owner should use
Node 24 for future generation after the existing Office recovery prerequisite;
this migration does not authorize retrying the blocked native harness.

The runtime requirement follows the [accepted maintenance objective](../plans/ecosystem-objective-2026-09-09.md#accepted-runtime-simplification--september-10-2026).
Node 20 is end-of-life according to the [Node.js release schedule](https://github.com/nodejs/Release#release-schedule).
Vercel's [Node version selection](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
uses the package engine range for builds and functions.
