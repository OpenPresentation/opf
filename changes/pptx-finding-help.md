---
type: fixed
packages: [opf, pptx]
---
Every finding `opf-pptx` reports now carries a help sentence: `pptx/native-body-fallback` and the other 100-odd export and import findings (provenance, reflow, SmartArt, chart reference, number, language and background findings) arrived with an empty `help`. A test scans every finding code of the package source.
