---
type: added
packages: [opf, render, pptx, editor]
---
WI-6 (output-changing only for decks that set it): `design.listBullet` takes `"none"` (deck, slide, theme and layout record), for lists that are a label and its explanation. Core composes no marker and no hanging indent (each `listEntries[]` marker is `{ none: true, text: '', indent: 0 }`, nested levels still step in by 1.1 em, and a list with `numbering` keeps its numbers); the SVG, PNG and PDF renderers draw no marker; the PowerPoint export writes `a:buNone` with no margin or indent and records the line roles, so a re-import reads the list back as one list; the editor's List bullets control offers "None (no bullets)" (`setDesignOption(editor, "listBullet", "none")`). No migration: existing decks and the values `character` and `image` are unchanged.
