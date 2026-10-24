---
type: changed
packages: [opf]
---
YAML and Markdown syntax findings are written in plain words and point at the place that matters (VALIDATOR-HINTS section 9): a tab for indentation is "Line 3 is indented with a tab. YAML needs spaces.", a quote or bracket that is never closed is reported where it opens (not at the end of the file), a repeated key names both lines, a cascade of errors is one finding, and the empty and not-a-mapping messages say what to write. The `YAML: ` prefix of `yaml/syntax` messages is gone (the old text is in `help` only for errors the reader has no sentence for). `markdown/options-unknown-key` and `markdown/chart-type` findings carry `suggestions`.
