# Renderer ordinary baseline refresh for core 0.22.2 (corpus with the chart-colors and table-cell-types examples)

Renderer main's local ordinary baseline (`opf-examples-png.rr89-chart-palette-text/`, 127 decks) predates the `chart-colors` example that core main now ships (128 decks). The guard step of `regenerate-candidate-goldens` ("Reproduce unchanged main") renders renderer main with core main and `test/golden.mjs` against that baseline, so it fails with "Golden corpus changed" for every candidate run, including the RR-96 template baseline (opf-render#259).

This change refreshes that directory with the `regenerate-goldens` workflow in the pinned image against the locked core, using a temporary `golden-override` of `ci.yml` that selects the directory (the workflow refuses a core fixture). Fixtures only; no renderer code. The `ci.yml` override is restored to the core fixture before merge.
