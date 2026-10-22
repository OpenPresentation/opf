# Contributing

This project is MIT-licensed and follows the OpenPresentation OSS boundary: local deterministic libraries only.

Before opening a pull request:

```sh
pnpm install                  # at the repository root
cd packages/render
pnpm run build:deps
pnpm run build
pnpm run validate
```

The repository root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [AGENTS.md](../../AGENTS.md) describe the monorepo workflow (checks with `pnpm check:changed`, branches, pull requests).

Dependency changes must preserve the runtime policy in `README.md`: no hosted service, no telemetry, and no commercial SDK in the critical path.

## Changelog fragments, tests and scripts

- Add a fragment `changes/<slug>.md` in the repository root `changes/` for a user-facing change (front matter `type: added|changed|fixed` and `packages: [render]`; see [`changes/README.md`](../../changes/README.md)). Do not edit `CHANGELOG.md` or `## Unreleased` by hand: the release-prep pull request assembles the fragments into the release section. CI warns (never fails) when `src/` changes without a fragment.
- `pnpm test` discovers its tests: the root `scripts/run-tests.mjs` runs every `test/*.mjs` in name order, except the files `test/suites.json` lists (helpers, fixtures, files that other steps run) and the browser suites (`*-browser*.mjs`, run through the root `scripts/quarantine.mjs`). A new test is one new file. `pnpm run typecheck` runs `node --check` over `src`, `test` and `scripts` (`scripts/check-syntax.mjs`). Do not add file lists to `package.json`.
