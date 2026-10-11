---
type: fixed
---
opf-render#189 changes the default output of PNG and raster PDF for Indic, Thai, Lao, Khmer and Myanmar text. The raster path now places each complex-script cluster at HarfBuzz's pen position (`fonts.outlines.shape`, the shaper browsers use) instead of fontkit's.
    - **Who it affects:** conversions that have HarfBuzz, which the Node fonts handle and the bundled faces always have. The default `toPng` and raster PDF therefore change for this text.
    - **Fallback to fontkit's pens:** without a shaper, output stays byte-identical. A run HarfBuzz cannot map back to its characters also falls back.
    - **Why:** fontkit kerns after a decomposed Thai sara am differently from HarfBuzz, so a cluster after it (ใจ after น้ำ) was about 0.7 px off at 25 px.
    - **Script corpora:** six samples change, measured as mean pixel difference against HarfBuzz's own outlines, before → after. All six now draw exactly like HarfBuzz's outlines, and no other sample changes:
        - `thai-title`: 0.46 → 0
        - `thai-sara-am`: 1.48 → 0
        - `thai-no-spaces`: 0.47 → 0
        - `taml-title`: 5.7 → 0
        - `telu-title`: 2.79 → 0
        - `mymr-medials`: 12.96 → 0
    - **Against Chromium:** seven of eight Thai checks (three lines and the issue's own line, at 25 and 60 px) come closer. For example, `thai-sara-am` at 60 px drops from 266 channel values off by more than 64 to 43. What remains is the anti-aliasing difference that HarfBuzz's own outlines show too.
    - **One regression:** `thai-no-spaces` at 25 px moves slightly away from Chromium (mean difference 1.298 → 1.329). The output there is exactly HarfBuzz's; fontkit's old offset happened to land nearer Chromium's pixels.
    - **Raster goldens:** unchanged, because no golden deck has complex-script text.
