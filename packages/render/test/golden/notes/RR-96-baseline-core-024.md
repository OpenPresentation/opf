# RR-96 example baseline for core 0.24 (gallery 4.0.0)

Core 0.24.0 adopts `@openpresentation/gallery` 4.0.0 (core opf#749). Two changes in the gallery move the ordinary example corpus, which the renderer renders and compares with its own baseline:

- The `dark` theme is removed. 25 gallery example decks moved from theme `dark` to `classic`; the dark look now comes from a theme variant, not from a separate theme.
- Every theme record embedded in an example deck gained `variants` (the RR-96 color variants), so the example sources differ even where the rendered slide does not.

The renderer's 0.24.0 publish run (https://github.com/OpenPresentation/opf-render/actions/runs/39344770687) failed in `npm test` with "Golden corpus changed; inspect candidate and review the new corpus." because the ordinary baseline still recorded core 0.23's corpus (`opf-examples-png.rr96-color-variants/`). Renderer code did not change; the tag `opf-render-v0.24.0` stays where it is and the renderer ships 0.24.1.

The ordinary selection (`exampleBaseline(...)` in `scripts/example-baseline.mjs`, used by `test/golden.mjs` and `test/golden-gate.mjs`) now picks `opf-examples-png.rr96-gallery-4/` for the variants contract. That directory started as a copy of the core 0.23 baseline, which keeps its bytes (`VARIANTS_EXAMPLE_BASELINE_CORE_023`), and is rewritten by the `regenerate-goldens` workflow in the pinned Playwright image, never from a local run.

## Review

The `regenerate-goldens` run [39345605849](https://github.com/OpenPresentation/opf-render/actions/runs/39345605849) (pinned image `mcr.microsoft.com/playwright:v1.64.0-noble`) rewrote only `_baseline.json`: 0 slides in 0 decks changed. The 25 decks that moved from `dark` to `classic` set their own light, picture or pattern background (one sets `dark1` and gains `variant: "dark1"`), so they draw the same; what moved is the corpus digest, from the embedded theme records gaining `variants`. The temporary `ci.yml` override that selected this directory for the run is restored to the core fixture in the same pull request.
