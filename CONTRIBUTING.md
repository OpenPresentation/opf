# Contributing to OPF

Thanks for your interest in contributing to OpenPresentation (OPF). This project is MIT-licensed and welcomes issues and pull requests from anyone.

## Project architecture

Before making changes, it helps to understand how the pieces fit together:

- [`spec/`](./spec) is the **source of truth** for the format: JSON Schemas (`spec/schemas/`) and bundled catalog records (`spec/catalogs/<kind>/`, one JSON file per record plus an `index.json` per kind). If you are proposing a change to the format itself, this is where it lives.
- [`packages/javascript`](./packages/javascript) publishes `@openpresentation/opf` to npm. Its TypeScript types, generated content, and layout previews are **generated from `spec/` at build time** by `packages/javascript/scripts/generate*.mjs`. Generated output (e.g. `src/generated/`) is never edited by hand — it is produced fresh on every build and would simply be overwritten.
- [`packages/cli`](./packages/cli) is a local-only CLI built on top of the same package; it is not currently published separately.
- [`examples/`](./examples) contains `*.opf.json` decks that are validated against the schema in CI and, for the top-level `examples/` tree, bundled into the npm package.
- [`docs/`](./docs) holds human-facing reference material (schema reference, catalog reference, conceptual guides) plus `docs/plans/` (design proposals, not all of which are fully shipped — check each plan's status banner) and `docs/migrations/` (upgrade notes for breaking changes).

## Development setup

Requirements: [pnpm](https://pnpm.io) and Node.js **>= 20**.

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Run these from the repo root — they fan out to both workspace packages (`@openpresentation/opf` and `@openpresentation/cli`). `pnpm build` and `pnpm typecheck` regenerate TypeScript from `spec/` before compiling, so they will pick up any schema or catalog edits automatically.

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

### Releases

Only maintainers cut releases. See [`docs/release-process.md`](./docs/release-process.md) for the full release runbook (tagging, npm trusted publishing, and release notes).

## Pull requests

Please fill out the pull request template, make sure `pnpm test` passes, and update `CHANGELOG.md` for any user-facing change. See [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) for the full checklist.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).
