---
type: fixed
packages: [pptx]
---
RR-105 (output-changing for text with U+202F): a narrow no-break space (the thousands separator of French and other locales, as in "150 000") is written in a run of its own with the run's properties. Many Latin faces have no U+202F (Aptos Display has none), and PowerPoint then drew the whole run in a substitute face, wider and higher than the preview; now only the separator falls back. The import reads the runs as it read one.
