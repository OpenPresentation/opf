---
type: added
packages: [opf]
---
FA-29: `opf/language-tag`, a content warning for a language tag that is not well formed (`en-a`), names an unassigned or deprecated region (`en-UK` on a run, with `en-GB` as the fix; `en-BU`) or is not in canonical case (`EN-us`). It checks the deck `language` (a tag, or the `bcp47` of an inline Language object) and `lang` on every TextRun, with a patch fix when a replacement is known. `en-UK` as the deck language stays the schema error it was, and tags the schema pattern rejects (`en_US`) stay schema errors.
