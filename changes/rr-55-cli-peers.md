---
type: changed
packages: [cli]
---
RR-55 (breaking, no compatibility path): `opf render`, `opf export` and `opf import` use the 0.14 APIs of the optional peers, and their ranges are `^0.14.0` (`@openpresentation/opf-render` and `@openpresentation/opf-pptx`). A 0.13 peer exits 2 with `peer-too-old` and the install command.
    - **One fonts handle:** fonts load once with `loadFonts({ pack: "office", substitutionPolicy: "visual", scripts: "auto", presentation, faces })` from `@openpresentation/opf-render/fonts-node` (it replaces `prepareNodeFonts`) and the handle goes as `{ fonts }` to `paginate`, `renderSlideSvg`, `svgToPng`, `svgToPdf` and `toPptx`. The report's `fonts` summary (`substitutions`, `scripts`, `userFonts`) is unchanged.
    - **Per-slide SVG:** each selected slide is drawn with `renderSlideSvg(presentation, index, { fonts })`; hidden-slide handling, file numbers and the `--svg-fonts` modes are unchanged.
    - **PDF:** `--pdf-mode` defaults to `vector` and `vector` needs no probe, so `pdf.vectorSupported` is removed from the report (`pdf.mode` stays).
    - **Import:** `--signals` reads `{ presentation, signals }` from `fromPptx(bytes, { signals: true })`, and the report's `signals.version` is the version the signals carry. A finding list on a thrown peer error (`OPFRenderError`, `OPFPptxError`, `OPFValidationError`) is reported as those findings.
