---
type: changed
packages: [render]
---
`text: "paths"` no longer keeps a run as text with the `text-as-paths-fallback` reason `"shaping"`, and the reason is gone from the `RenderDiagnostic` types (`text-as-paths-fallback` and `raster-marker-unavailable`). The fallback kept a run with no pinned width as text when fontkit, which measured the layout, and HarfBuzz, which draws the outlines, gave it different advances; with fontkit 3 they agree to the font unit on every bundled face and script corpus sample, so such a run (for example Burmese) is now outlined. Code that matched `reason === "shaping"` can drop that branch.
