# Contributing

This project is MIT-licensed and follows the OpenPresentation OSS boundary: local deterministic libraries only.

Before opening a pull request:

```sh
npm ci
npm run build
npm run validate
```

Dependency changes must preserve the runtime policy in `README.md`: no hosted service, no telemetry, no commercial SDK, and no required AI or LibreOffice dependency in the critical path.

## Changelog fragments, tests and scripts

- Add `changes/<slug>.md` for a user-facing change (front matter `type: added|changed|fixed`; see [`changes/README.md`](./changes/README.md)). Do not edit `CHANGELOG.md` or `## Unreleased` by hand: the release-prep pull request runs `node scripts/changelog-fragments.mjs assemble --version X.Y.Z`, which moves the fragments into the release section. CI warns (never fails) when `src/` changes without a fragment.
- `npm test` discovers its tests: `scripts/run-tests.mjs` runs every `test/*.mjs` in name order, except the files `test/suites.json` lists (helpers, fixtures, files that other steps run) and the browser suites (`*-browser*.mjs`, run through `scripts/quarantine.mjs`). A new test is one new file. `npm run typecheck` runs `node --check` over `src`, `test` and `scripts` (`scripts/check-syntax.mjs`). Do not add file lists to `package.json`.
