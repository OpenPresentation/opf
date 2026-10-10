---
type: changed
packages: []
---
RR-78: the default catalog's records and layout previews now live in `packages/gallery` and are released as `@openpresentation/gallery` by `gallery-publish.yml` (`gallery-vX.Y.Z` tags, npm trusted publishing), outside the lockstep train (`release-train.mjs` lists it in `INDEPENDENT_PACKAGES`; `verify gallery@X.Y.Z` checks a release; `release-plan.json` records it under `independentPackages`). `scripts/sync-gallery-catalog.mjs` writes `packages/gallery/catalog`, and keeps core's `spec/catalogs` and `spec/previews/layouts` as byte-identical copies until core drops `/catalog` in OPF 0.19 (`pnpm check:catalog` fails when they differ). New checks: `pnpm check:gallery` (in `pnpm test`) and `pnpm check:gallery-stability`, the pixel-stability rule OPF CI runs on every pull request. The layout preview renderer moved to `packages/gallery/scripts/render-layout-previews.mjs`.
