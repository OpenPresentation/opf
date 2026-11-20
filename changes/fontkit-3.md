---
type: changed
packages: [render]
---
fontkit 3.0.0 (was 2.0.4) shapes text wherever the renderer measures or draws without HarfBuzz (a fonts handle without a shaper, the PDF without one, the raster cluster rewrite). It shapes like HarfBuzz where fontkit 2 did not: Myanmar (it had no Myanmar shaper: no medial ra and e vowel reordering, no kinzi), the Syriac word whose first letter it left unjoined, Noto Nastaliq Urdu's marks (it threw on their null anchors) and Noto Sans Mongolian (it could not decode a GSUB type 8 lookup). Every script corpus sample now measures the same through fontkit and HarfBuzz on every bundled face, so the renderer's retries for those defects are removed. fontkit is ESM-only from 3.0.0 and needs Node 22 or later; the renderer already requires both.
