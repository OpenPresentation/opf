# Contributing

This project is MIT-licensed and follows the OpenPresentation OSS boundary: local deterministic libraries only.

Before opening a pull request:

```sh
pnpm install --frozen-lockfile   # from the repository root
pnpm --filter @openpresentation/opf-editor test:contract
pnpm --filter @openpresentation/opf-editor validate
```

This package is part of the OPF monorepo: the root [`AGENTS.md`](../../AGENTS.md) and `CONTRIBUTING.md` describe the shared workflow (`pnpm check:changed`, CI, releases). `dist/` is generated (`pnpm run build`) and not tracked.

Dependency changes must preserve the runtime policy in `README.md`: no hosted service, no telemetry, and no commercial SDK in the critical path.

## Changelog fragments, tests and scripts

- Add `changes/<slug>.md` at the repository root for a user-facing change (front matter `type: added|changed|fixed`, `packages: [editor]`; see [`changes/README.md`](../../changes/README.md)). Do not edit `CHANGELOG.md` or `## Unreleased` by hand: the release-prep pull request runs the root `node scripts/changelog-fragments.mjs assemble`, which moves the fragments into the release section. CI warns (never fails) when `src/` changes without a fragment.
- `pnpm test` discovers its tests: the root `scripts/run-tests.mjs` runs every `test/*.mjs` in name order, except the files `test/suites.json` lists (helpers, fixtures, files that other steps run) and the browser suites (`*-browser*.mjs`, run through the root `scripts/quarantine.mjs`). A new test is one new file. `pnpm run typecheck` runs `node --check` over `src`, `test`, `scripts` and `examples` (`scripts/check-syntax.mjs`). Do not add file lists to `package.json`.
