---
type: changed
packages: []
---
opf#523 (docs only): `docs/font-fidelity.md` documents the measured line-width residual of Arabic Typesetting and Traditional Arabic. PowerPoint draws their lines narrower than the Noto Naskh Arabic proxy composes them: native over composed is 0.86 to 0.97 for Arabic Typesetting at its 0.64 `sizeAdjust`, and 0.68 to 0.90 for Traditional Arabic. Microsoft publishes no metrics for either family, no metric-compatible open face exists, and one scale factor per family cannot close the gap. The doc covers why, what it does to line counts, edges and overhang, and why the policy keeps the wide-erring proxy. No package output changes.
