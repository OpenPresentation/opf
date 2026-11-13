---
type: fixed
packages: [opf]
---
`composeSlide` measures each string at a given size and style once per call through the host's `textMeasurement`, and reuses the width for every later fit, arrangement and the LH-189 tight composition in the same call. Output is unchanged; `opf validate examples` takes about 40 s instead of 90 s, below the 52 s it took before display growth. Widths are never kept across calls, so a host whose fonts finish loading between calls still measures again.
