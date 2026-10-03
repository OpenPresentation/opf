---
type: changed
---
RR-46 (repository tooling; no package change): changelog fragments and discovered tests. A change adds `changes/<slug>.md` instead of editing `## Unreleased`; the release-prep PR runs `node scripts/changelog-fragments.mjs assemble --version X.Y.Z`. `npm test` runs every `test/*.mjs` through `scripts/run-tests.mjs` (`test/suites.json` lists the helpers and separately-run files; browser suites still run through `scripts/quarantine.mjs`) and `npm run typecheck` is `scripts/check-syntax.mjs` over `src`, `test`, `scripts` and `examples`, so adding a test touches only its own file. The set of tests `npm test` runs is unchanged.
