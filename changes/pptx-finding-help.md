---
type: fixed
packages: [opf, pptx]
---
Every warning and note `opf-pptx` reports now carries a help sentence: `pptx/native-body-fallback` and 142 other export and import findings (provenance, reflow, table, autofit, SmartArt, chart reference, number, language, theme and background findings, and the chart and variable warnings it passes on from core) arrived with an empty `help`. A test scans the package source for the codes it reports and fails on one without help. Errors that stop an export or import (thrown `OPFPptxError` codes) are not covered yet.
