---
type: added
packages: [opf]
---
FA-05: the `surfaceAlt` color role keeps banded table rows visible on light and dark slides. Since `background` is the slide background, a band filled with it vanished on a theme whose background is the dark `surface` (minimal). `surfaceAlt` is derived from `surface` and `text` by `surfaceAltColor()` (the surface mixed a tenth of the way towards the text, further until it differs from the surface by 1.1:1 while the text keeps 4.5:1, or away from the text when the two are close), with `SURFACE_ALT_MIX` and `SURFACE_ALT_MIN_CONTRAST`. `resolveColorRoles` returns it and `resolveColorRef('surfaceAlt')` derives it from the surface and text roles an engine passes, so the preview and the PPTX export draw the same band with no engine change. `ColorRef` accepts `surfaceAlt`.
