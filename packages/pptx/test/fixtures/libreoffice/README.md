# PPTX files saved by LibreOffice

Retained inputs for import regressions. Each file is LibreOffice's own re-save of an OPF export, taken unchanged from the
`libreoffice-qualification` artifact of the RR-106 qualification (docs/libreoffice.md).

- `shape-overlays-libreoffice-26.8.pptx`: `examples/technical/shape-overlays.opf.json`, exported with the default options, then opened
  and re-saved by LibreOffice 26.8.2.2 (build `9dea406ab7695df6325b11b0e19fdca8db4b7276`, Ubuntu 24.04, headless,
  `--convert-to "pptx:Impress MS PowerPoint 2007 XML"`) in [Actions run 42408361449](https://github.com/OpenPresentation/opf/actions/runs/42408361449).
  LibreOffice keeps the shapes, their names and the connectors' glue, but none of OPF's stored tags, so import rebuilds the ids of
  connected blocks itself. Before opf#1103 two slides got the same generated id and import failed validation.
