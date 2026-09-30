# Gallery catalog sync

`sync-gallery-catalogs.mjs` built the FF-28 narrative and audience records from pptx.gallery `data/narratives.json` and `data/audiences.json` at gallery commit f17e9ae. `gallery-layout-map.json` records how each gallery beat layout (`stats-metrics`, `title-center`, and so on) was mapped onto a bundled layout id, both as rules and as a per-beat table. Use that table to restore gallery layout ids mechanically (FF-37).

```sh
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery          # add missing ids; never overwrites existing records
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery --check  # verify records and the per-beat table
```

Starting from the pre-FF-28 catalogs, a run reproduces the committed records byte for byte. The one exception is the audiences `index.json` description sentence about singular gallery ids, which was edited by hand. The gallery checkout is not available in CI, so this is a maintenance tool, not a gate.

Since FF-37, `spec/catalogs/` is a pinned snapshot of the default catalog that pptx.gallery publishes. New catalog content goes into the gallery first; then `scripts/sync-gallery-catalog.mjs --gallery ../pptx-gallery` updates the snapshot and `spec/catalogs/manifest.json` (see `docs/default-catalog.md`). This converter stays as the record of how FF-28 derived its narrative and audience records. `gallery-layout-map.json` stays as the table for restoring gallery layout hints.
