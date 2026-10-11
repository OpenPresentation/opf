Native Pareto export accepts multi-series OPF data but writes only the first series. Export followed by import therefore loses the additional series. The exporter reports `chart-data-adapted` with `adaptation: "series-dropped"`; this is an existing documented limitation, not a newly established regression.

The T31 offline acceptance packet reproduced this on reviewed PPTX source `25ecc82dce8ac5018837924d5f559315fde5f9b0`, core `3e8cc60e9aef14b9caa325d2dfbf0a59fcabdaa0`, renderer `d57236802c8746fde430998bf2ddc9d16fe86712`, and gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99`. No native PowerPoint execution is needed to reproduce the data difference.

```json
{"slides":[{"chart":{"type":"pareto","data":{"columns":["Quarter","North","South","West"],"rows":[["Q1",4,3,2],["Q2",5,2,3],["Q3",6,4,1]]}}}]}
```

After export/import, the columns are `["Quarter","North"]` and the rows are `[["Q1",4],["Q2",5],["Q3",6]]`. The diagnostic explicitly names South and West as omitted. `README.md` documents the one-series chart contract, and the existing `test/chartex.mjs` Pareto fixture covers the adaptation. Successful single-series chart/native coverage does not prove multi-series source preservation.

Acceptance for resolving this limitation:

- Decide and document the intended multi-series contract: preserve the complete authored data through export/import with a truthful native representation, or reject unsupported multi-series input clearly before producing an apparently complete export. Do not silently drop data or fabricate native support.
- Add a regression that checks all source series and values against that chosen contract, including export diagnostics and re-import.
- Keep the release-readiness note and internal catalog tracker explicit about the supported single-series case and unresolved multi-series limitation.

This issue records an unresolved limitation for RR-20/T31. Filing it does not close native acceptance, authorize a new release-scope descope, or claim final registry/cross-platform verification.
