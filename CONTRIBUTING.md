# Contributing to OPF

Thanks for your interest in contributing to OpenPresentation (OPF). This project is MIT-licensed and welcomes issues and pull requests from anyone.

## Project architecture

Before making changes, it helps to understand how the pieces fit together:

- [`spec/`](./spec) is the **source of truth** for the format: JSON Schemas (`spec/schemas/`) and the engine reference data (`spec/reference/`). If you are proposing a change to the format itself, this is where it lives.
- [`packages/gallery`](./packages/gallery) publishes `@openpresentation/gallery`: the default catalog (layouts, themes, color and font schemes and the other records) and layout previews. It owns every default record; records are authored by pull request here (`docs/default-catalog.md`). pptx.gallery presents the published package and does not write records.
- [`packages/javascript`](./packages/javascript) publishes `@openpresentation/opf` to npm. Its TypeScript types, generated content, and layout previews are **generated from `spec/` at build time** by `packages/javascript/scripts/generate*.mjs`. Generated output (e.g. `src/generated/`) is never edited by hand — it is produced fresh on every build and would simply be overwritten.
- [`packages/cli`](./packages/cli) is the local-only `@openpresentation/cli` package (the `opf` command), depending on `@openpresentation/opf`; rendering and PPTX conversion use optional engine peers.
- [`packages/render`](./packages/render) (`@openpresentation/opf-render`: SVG, PNG and PDF, the font packs and the golden corpus), [`packages/pptx`](./packages/pptx) (`@openpresentation/opf-pptx`: PPTX export and import) and [`packages/editor`](./packages/editor) (`@openpresentation/opf-editor`: the headless editor and its playground) are the engines. Each has its own `AGENTS.md` with the package rules (font licensing and deterministic output, the byte-exact vendored PptxGenJS, the browser suites). [`packages/integration`](./packages/integration) holds the private tests that need several packages at once.
- All six published packages share one version and are released together (`docs/release-process.md`). They used to live in separate repositories; the old `opf-render`, `opf-pptx`, `opf-editor` and `gallery` repositories are archived, and references such as `opf-render#199` in older docs name them.
- [`examples/`](./examples) contains `*.opf.json` decks that are validated against the schema in CI and, for the top-level `examples/` tree, bundled into the npm package.
- [`docs/`](./docs) holds human-facing reference material (schema reference, catalog reference, conceptual guides) plus `docs/plans/` (design proposals, not all of which are fully shipped — check each plan's status banner) and `docs/migrations/` (upgrade notes for breaking changes).

## Development setup

Requirements: [pnpm](https://pnpm.io) and Node.js **24.x** for development (see `.nvmrc`). The packages themselves declare the open-ended `engines.node` `>=22` (RR-20), tested on Node 22, 24 and 26: never declare a closed range such as `24.x`, which makes npm on any other Node silently install an old release (`pnpm check:engines-range` fails on one). See also the [Node 24 migration notes](docs/migrations/node24.md).

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Run these from the repo root — they fan out to the six workspace packages. `pnpm build` and `pnpm typecheck` regenerate TypeScript from `spec/` before compiling, so they will pick up any schema or catalog edits automatically. The browser suites of the renderer, PPTX and editor packages run in the pinned Playwright image in CI (one image string in every workflow, kept equal to the Playwright version by `pnpm check:playwright-pin`); locally, install Chromium with `pnpm --filter @openpresentation/opf-render exec playwright install --with-deps chromium`. After each change run `pnpm check:changed`, which checks only what your branch changed; leave the full `pnpm test` to CI and your last run before a PR. For a cheap checkout of one task, `node scripts/agent-worktree.mjs add <task>` makes a small blobless worktree with a shared pnpm store.

Typechecking uses TypeScript 7 through the root `@typescript/native` npm alias
and `scripts/typecheck.mjs`. Declaration builds deliberately retain the
package-local `typescript` dependency on the `~5.9.3` patch line: tsup 8's
declaration bundler requires the legacy compiler API and fails with TypeScript 7.
The explicit runner avoids ambiguous `tsc` binaries when both compilers are
installed. Do not replace the declaration compiler with TypeScript 7 until the
bundler supports it and public declarations have been compared. This follows
Microsoft's [side-by-side compiler guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0),
while keeping our existing declaration output stable. Compatible compiler patches
remain eligible; security advisories must be triaged independently of this pin.

`node packages/javascript/test/packed-install-smoke.mjs` checks every typed export
with TypeScript 5.9 and 7, under both NodeNext and Bundler resolution with
`skipLibCheck: false`. It also exercises the renderer, editor, and PPTX
converter tarballs built from this checkout against the core tarball.
The CLI publishes a bundled executable, not a TypeScript library; its source is
typechecked with TypeScript 7 and `pnpm test:cli:packed` verifies isolated global
and npx-style installs. The nightly workflow runs these checks on
Node 22, 24 and 26 and on Linux, Windows and macOS (pull requests run Linux on Node 24), retaining schema and runtime-floor checks.

## Proposing changes

### Format and schema changes

Changes to `spec/schemas/*.schema.json` or the shape of catalog records affect every consumer of the format. **Open an issue first** using the "Schema/catalog change proposal" issue template before sending a pull request, so the change can be discussed. Note whether the proposal is breaking (removes or renames fields/ids that existing documents may reference) or additive.

When a schema or catalog change is accepted:

- Catalog records change in `packages/gallery` by pull request, in the same pull request as any engine change they need. Keep individual records and their `index.json` in sync (`pnpm --filter @openpresentation/gallery rehash` and `previews`). A changed drawing or a removed record id is declared in the `changes/` fragment (`drawing:`), and a declared change makes the next release a minor one (`changes/README.md`).
- Update any affected reference docs (`docs/schema-reference.md`, `docs/catalog-schema-reference.md`, `docs/content-payloads.md`, etc.) alongside the schema change.
- Add or update an entry in `docs/migrations/` if the change is breaking.
- Make sure `examples/**/*.opf.json` still validates, or update the affected examples.

### Package code and other changes

Bug fixes, generator script changes, and documentation improvements can go straight to a pull request. Please don't hand-edit generated TypeScript under `packages/javascript/src/generated` (or similar generated output) — change the generator or the underlying `spec/` data instead.

### Pull requests that span packages

A change that touches several packages is one pull request with one `changes/<slug>.md` fragment naming each affected package. There is no `Depends-On`, no lock-roll pull request and no merge queue: the one required check, **`verify`**, runs the affected packages together, and a pull request merges (squash) when it is green. Slow cross-platform and Node-range legs run nightly and before every release, not on pull requests; add the `full-ci` label if your change is OS- or Node-version-specific. `verify` also runs on every push to `main`.

### Tests and scripts

`pnpm test` discovers its tests instead of listing them: a package runs every `test/*.mjs` (`node ../../scripts/run-tests.mjs`, with `test/suites.json` for the few helpers and separately-run files that are excluded) and the root runs every `check:*` script (`scripts/run-checks.mjs`, with `scripts/checks.json`). A new test is one new file and a new check is one new `check:*` script, so two pull requests that each add one never conflict.

### Generated trackers

The gallery tracker (`docs/programs/release-readiness/gallery-tracker.*`) and the font tracker (`docs/programs/font-fidelity-everywhere/font-tracker.*`) are derived from committed data. A pull request does not have to regenerate them: when it changes a tracker input, CI only warns that the committed tracker is stale (`OPF_TRACKER_STALE=warn`), and after the merge the "Tracker refresh" workflow regenerates both and offers the result as one pull request from `bot/tracker-refresh`. Regenerate in your own pull request (`pnpm build:font-tracker`, then `pnpm build:gallery-tracker`) only when that pull request changes a tracker generator, its overrides or its tests. A local `pnpm test` and the CI runs on `main`, tags and releases still fail on a stale tracker; if `main` is red for that reason, merge the refresh pull request.

### Releases

Only maintainers cut releases, with one click: Actions, **Release**, **Run workflow**. The workflow runs the slow gate, assembles the changelogs from `changes/`, tags `vX.Y.Z`, and `npm-publish.yml` publishes all six packages with npm trusted publishing and provenance, then verifies them. The owner has authorized agents to run it when a release is required (authorized 2026-09-29). See [`docs/release-process.md`](./docs/release-process.md) for the procedure, retry and the version rules. After a release, the three sites receive "bump to vX.Y.Z" pull requests automatically.

### Dependencies

One `.github/dependabot.yml` covers the workspace: grouped minor and patch updates, one group each for Playwright, the Expo Google Fonts packages, CodeMirror and the native image and PDF libraries. A Playwright bump must also move the pinned container image tag and digest in `.github/workflows` (`pnpm check:playwright-pin` fails until it does), and a font bump changes an exact optional peer, which needs the owner's review (`pnpm check:pins`).

## Pull requests

Please fill out the pull request template, make sure `pnpm check:changed` passes locally (CI runs the full check, `verify`), and add a changelog fragment `changes/<slug>.md` for any user-facing change (see [`changes/README.md`](./changes/README.md); do not edit a `CHANGELOG.md` or `## Unreleased` by hand, the release workflow assembles the fragments). See [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) for the full checklist.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
