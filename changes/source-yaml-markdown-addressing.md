---
type: added
packages: [opf]
---
`@openpresentation/opf/source`: `locate` and `pathAt` now read YAML and Markdown as well as JSON, so a finding in a `.opf.yaml` or `.opf.md` text has a range (JSON Pointer to range, caret to path, tolerant of text with syntax errors). YAML uses the `yaml` library's tolerant parse; Markdown uses the ranges the converter records for every part it reads, which now include each list item (`/slides/0/items/2`), and refines a slide option to its `key=value` token and a title or list item to the text after its marker. The new `scanMarkdown(text)` returns the regions of a Markdown deck (front matter, slides, `---` separators, option comments, fences with their kind, info and body, speaker notes) by the converter's own line rules, and the dialect's vocabulary (`SLIDE_OPTION_KEYS`, `BLOCK_OPTION_KEYS`, `FENCE_KINDS`, `METRIC_KEYS`, `SPAN_FLAGS`, `SPAN_VALUES`, ...) is exported so an editor never copies it.
