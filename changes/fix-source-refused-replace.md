---
type: fixed
packages: [editor]
---
Opening a deck the session refuses over the one the source pane shows no longer crashes the host. `setDocument(doc, { text })` drew the refused deck's findings against the text the pane still showed, and a quick fix for a place that text lacked (an unknown key on a slide the old deck did not have) threw "Can not delete in empty document": `setDocument` threw that error instead of returning `false`, the pane stayed on the old text, and the `source` event reported the old text to the host. A refused `replaceDocument` now changes nothing, the findings included, so `setDocument` returns `false` and loads the text as a draft with its own findings; and every quick-fix builder writes no fix, rather than throwing, for a path the text lacks, for text that does not parse and for empty text (the finding is still listed).
