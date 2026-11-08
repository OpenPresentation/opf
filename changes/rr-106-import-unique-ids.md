---
type: fixed
packages: [pptx]
---
opf#1103: importing a PPTX that another app re-saved (LibreOffice keeps OPF's shape names but none of its stored tags) no longer fails with `invalid-import-opf` when connectors bind blocks on more than one slide. The ids the importer generates for connected blocks and overlay shapes now avoid every id in the presentation, not only those of their own slide. A regression test uses the LibreOffice 26.8 re-save of `examples/technical/shape-overlays.opf.json`.
