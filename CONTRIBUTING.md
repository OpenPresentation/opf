# Contributing to OPF

Thanks for your interest in contributing to OpenPresentation (OPF). This project is MIT-licensed and welcomes issues and pull requests from anyone.

## Project architecture

Before making changes, it helps to understand how the pieces fit together:

- [`spec/`](./spec) is the **source of truth** for the format: JSON Schemas (`spec/schemas/`) and bundled catalog records (`spec/catalogs/<kind>/`, one JSON file per record plus an `index.json` per kind). If you are proposing a change to the format itself, this is where it lives.
- [`packages/javascript`](./packages/javascript) publishes `@openpresentation/opf` to npm. Its TypeScript types, generated content, and layout previews are **generated from `spec/` at build time** by `packages/javascript/scripts/generate*.mjs`. Generated output (e.g. `src/generated/`) is never edited by hand — it is produced fresh on every build and would simply be overwritten.
- [`packages/cli`](./packages/cli) is the local-only `@openpresentation/cli` package, published separately with the matching core bundled inside.
- [`examples/`](./examples) contains `*.opf.json` decks that are validated against the schema in CI and, for the top-level `examples/` tree, bundled into the npm package.
- [`docs/`](./docs) holds human-facing reference material (schema reference, catalog reference, conceptual guides) plus `docs/plans/` (design proposals, not all of which are fully shipped — check each plan's status banner) and `docs/migrations/` (upgrade notes for breaking changes).

## Development setup

Requirements: [pnpm](https://pnpm.io) and Node.js **24.x** (see `.nvmrc`). Node 20 and 22 users must upgrade before using the next coordinated release; see [migration instructions](docs/migrations/node24.md).

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Run these from the repo root — they fan out to both workspace packages (`@openpresentation/opf` and `@openpresentation/cli`). `pnpm build` and `pnpm typecheck` regenerate TypeScript from `spec/` before compiling, so they will pick up any schema or catalog edits automatically.

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
`skipLibCheck: false`. It also exercises the published renderer, editor, and PPTX
converter versions in `release-plan.json` against the candidate core tarball.
The CLI publishes a bundled executable, not a TypeScript library; its source is
typechecked with TypeScript 7 and `pnpm test:cli:packed` verifies isolated global
and npx-style installs. OPF CI and CLI portability together run these checks on
Node 24 and Linux/Windows/macOS, retaining schema and runtime-floor checks.

## Proposing changes

### Format and schema changes

Changes to `spec/schemas/*.schema.json` or the shape of catalog records affect every consumer of the format. **Open an issue first** using the "Schema/catalog change proposal" issue template before sending a pull request, so the change can be discussed. Note whether the proposal is breaking (removes or renames fields/ids that existing documents may reference) or additive.

When a schema or catalog change is accepted:

- Keep individual catalog record files and their directory's `index.json` in sync — adding, removing, or renaming a record without updating `index.json` will fail catalog checks.
- Update any affected reference docs (`docs/schema-reference.md`, `docs/catalog-schema-reference.md`, `docs/content-payloads.md`, etc.) alongside the schema change.
- Add or update an entry in `docs/migrations/` if the change is breaking.
- Make sure `examples/**/*.opf.json` still validates, or update the affected examples.

### Package code and other changes

Bug fixes, generator script changes, and documentation improvements can go straight to a pull request. Please don't hand-edit generated TypeScript under `packages/javascript/src/generated` (or similar generated output) — change the generator or the underlying `spec/` data instead.

### Tests and scripts

`pnpm test` discovers its tests instead of listing them: a package runs every `test/*.mjs` (`node ../../scripts/run-tests.mjs`, with `test/suites.json` for the few helpers and separately-run files that are excluded) and the root runs every `check:*` script (`scripts/run-checks.mjs`, with `scripts/checks.json`). A new test is one new file and a new check is one new `check:*` script, so two pull requests that each add one never conflict.

### Generated trackers

The gallery tracker (`docs/programs/release-readiness/gallery-tracker.*`) and the font tracker (`docs/programs/font-fidelity-everywhere/font-tracker.*`) are derived from committed data. A pull request does not have to regenerate them: when it changes a tracker input, CI only warns that the committed tracker is stale (`OPF_TRACKER_STALE=warn`), and after the merge the "Tracker refresh" workflow regenerates both and offers the result as one pull request from `bot/tracker-refresh`. Regenerate in your own pull request (`pnpm build:font-tracker`, then `pnpm build:gallery-tracker`) only when that pull request changes a tracker generator, its overrides or its tests. A local `pnpm test` and the CI runs on `main`, tags and releases still fail on a stale tracker; if `main` is red for that reason, merge the refresh pull request.

### Releases

Only maintainers cut releases. The owner has authorized agents to prepare and publish npm releases through the documented workflow when a release is required (authorized 2026-09-29; see [`docs/release-process.md`](./docs/release-process.md#agent-authorization-and-coordinated-release-order)). See that runbook for the full procedure (tagging, npm trusted publishing with provenance, coordinated package order and release notes).

## Pull requests

Please fill out the pull request template, make sure `pnpm test` passes, and add a changelog fragment `changes/<slug>.md` for any user-facing change (see [`changes/README.md`](./changes/README.md); do not edit `CHANGELOG.md` or `## Unreleased` by hand, the release-prep PR assembles the fragments). See [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) for the full checklist.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
