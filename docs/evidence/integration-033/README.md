# v0.33.0 integration: template golden review

`templates-before-after.png` shows the 49 of 624 renderer template-golden slides that moved, each as a pair: origin/main `aeee8db93` (the integration base; #1079, merged since, changes no template) on the left and the integration branch on the right. `changed-slides.json` lists them. To rebuild it, copy `render-keys.mjs` and `sheet.mjs` into `packages/render/artifacts/i033/` of each checkout (built), run `node artifacts/i033/render-keys.mjs changed-slides.json <out>` in both, then run `sheet.mjs <keys> <before> <after> <png> <title>` once.
