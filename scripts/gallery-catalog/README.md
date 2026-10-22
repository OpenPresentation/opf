# Gallery catalog sync

`sync-gallery-catalogs.mjs` built the FF-28 narrative and audience records from pptx.gallery `data/narratives.json` and `data/audiences.json` at gallery commit f17e9ae. `gallery-layout-map.json` records how each gallery beat layout (`stats-metrics`, `title-center`, and so on) was mapped onto a bundled layout id, both as rules and as a per-beat table. Use that table to restore gallery layout ids mechanically (FF-37).

Historical commands (the converter is not present in the current checkout):

```sh
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery          # add missing ids; never overwrites existing records
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery --check  # verify records and the per-beat table
```

Starting from the pre-FF-28 catalogs, a run reproduces the committed records byte for byte. The one exception is the audiences `index.json` description sentence about singular gallery ids, which was edited by hand. The gallery checkout is not available in CI, so this was a maintenance tool, not a gate.

Since FF-37 the records are a pinned snapshot of the default catalog that pptx.gallery publishes; since RR-78 the gallery package owns that snapshot and publishes `@openpresentation/gallery`; since the monorepo move (MR-23) it is `packages/gallery` of this repository. Change records there by pull request (see [the current catalog contract](../../docs/default-catalog.md)). `gallery-layout-map.json` preserves how FF-28 mapped narrative layout hints; it is historical data, not a current v2 layout migration tool.
