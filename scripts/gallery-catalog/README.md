# Gallery catalog sync

`sync-gallery-catalogs.mjs` built the FF-28 narrative and audience records from pptx.gallery `data/narratives.json` and `data/audiences.json` at gallery commit f17e9ae. `gallery-layout-map.json` records how each gallery beat layout (`stats-metrics`, `title-center`, and so on) was mapped onto a bundled layout id, both as rules and as a per-beat table. Use that table to restore gallery layout ids mechanically (FF-37).

```sh
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery          # add missing ids; never overwrites existing records
node scripts/gallery-catalog/sync-gallery-catalogs.mjs --gallery ../pptx-gallery --check  # verify records and the per-beat table
```

Starting from the pre-FF-28 catalogs, a run reproduces the committed records byte for byte. The one exception is the audiences `index.json` description sentence about singular gallery ids, which was edited by hand. The gallery checkout is not available in CI, so this is a maintenance tool, not a gate.
