---
type: added
---
RR-53 (tooling, no package change): `npm run test:contract` runs the contract suite, the part of `npm test` that exercises core's APIs; core's pull-request checks run it instead of the full suite, while core's merge queue, pushes to main and nightly run `npm test`. `test/suites.json` `contractExclude` lists, with a reason each, the tests it leaves out, and `node scripts/run-tests.mjs --suite contract` selects it.
