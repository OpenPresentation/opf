---
type: changed
---
FA-23 (OPF 0.15, breaking): engine vocabularies and diagnostic names follow core 0.15. `chart.type` is a schema enum, so the exporter's legacy substring heuristic for other chart type ids (and the `donut` alias) is removed: such a document fails validation. The import diagnostic for a stored layout reference that resolves nowhere is `unresolved-reference` (was `unresolved-layout-reference`), and the `checkTypefaces` violation for a theme font reference that resolves to no font is `theme-reference-unresolved` (was `unresolved-theme-reference`).
