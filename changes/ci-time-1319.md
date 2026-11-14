---
type: changed
packages: []
---

opf#1319: pull-request CI is faster without dropping a check. The test shards are balanced by seconds measured on a current run (`scripts/ci-test-weights.json`, regenerated from one run's job logs by `scripts/ci-test-weights.mjs`; every shard warns when its weights go stale), PPTX runs in 6 full and 5 contract shards and the editor's standalone browser suite in 4 weighted shards. The editor's absolute wall-clock budgets (`startup-perf`, `studio-perf`, now the `perf` browser suite) and, for a run that does not change `packages/editor`, its playground suite run in `nightly.yml` (also the release gate and the label `full-ci`) instead of `verify`. Four example-wide checks of PPTX machinery (`layout-names`, `slide-object-ids`, `vendor-names`, `rr-104-no-autofit`) are full-tier only. LibreOffice stays nightly and report-only. `scripts/ci-leg-minutes.mjs` prints the planned minutes of every leg: no leg over 8.5 minutes, against 9 to 16 measured before.
