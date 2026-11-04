---
type: changed
packages: [opf]
---
Edge Workers (the `workerd`, `worker` and `edge-light` conditions) take the lazy diagram engine, as browsers do: they load pele's core with OPF and each diagram type only when `ensureDiagrams` asks for it, so a Worker that draws no diagram no longer bundles the diagram types (about 0.25 MiB gzipped; pptx.gallery's Worker went over its size guard with 0.32.0). A Worker that validates or draws diagrams with `validate`, `composeSlide` or `toSvg` awaits `ensureDiagrams(presentation)` first; `toPptx` already does. `ensureDiagrams` and `diagramsPending` are now also exported from the package root. Node, Bun and Deno are unchanged: every type is loaded with core.
