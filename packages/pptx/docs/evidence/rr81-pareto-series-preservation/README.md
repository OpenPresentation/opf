# RR-81: multi-series Pareto preservation (0.19)

Base: `95a2f22fc2ecbef2c359649ea4b308c649923fb4`. This change is held for 0.19 and does not alter the frozen native packet05 graph or establish native acceptance.

The native Pareto record accepts one independent value series; its cumulative line refers to that series. Previously the shared series limit discarded additional resolved series before writing both chartEx and its workbook/classic fallback. In auto mode, multiple resolved Pareto series now export as an explicitly diagnosed editable clustered column chart. Explicit native mode rejects with `unsupported-chart-data` before returning bytes. Single-series native output is unchanged.

Regression coverage checks all three classic series, labels, workbook values and gaps, number formats, dataset/mapping order, and reimport after removing all OPF tags. A mapping selecting one series remains supported natively. The existing single-series native checks and fallback fixture hashes remain unchanged. Other single-series chart truncation expectations remain intact.

Node 24.21.0; own frozen `npm ci --ignore-scripts` registry dependencies. Replay:

```sh
npm run typecheck
node test/pareto-multi-series.mjs
node test/chart-types.mjs
node test/chartex.mjs
npm test
```

Typecheck passed 270 syntax files. Full test passed all 129 suites, browser bundle, runner checks and changelog checks; `full-test.log` records the complete run. The first full run exposed the old chart-types oracle expecting Pareto `series-dropped`; only that Pareto expectation was replaced with explicit fallback and complete-series assertions. No archive baseline, tolerance, package version, dependency range or lock changed.
