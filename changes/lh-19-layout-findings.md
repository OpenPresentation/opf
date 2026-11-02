---
type: added
packages: [opf]
---
LH-19 and LH-31: five info findings in `validate`, each with `describeFinding` text, an `explain` example and an entry in `docs/validate.md`. None changes what is drawn, and as info none makes a deck invalid.
    - `opf/text-shrunk` (layout): a fitted text, list, quote, code or table body size below 70% of its role's starting size (prose 28, list 32, table 25, quote 40, code 22 px at 720), once per slide; the slide is likely too dense, so split it (`opf paginate`).
    - `opf/centered-body` (layout): a centred paragraph or list of more than 2 lines or 120 characters, read from the composed alignment. Titles, metrics, quotes, short notes (80 characters or fewer) and a lone statement of up to 3 lines are exempt; on a cover, section or closing layout a lone text block is never reported.
    - `opf/tight-spacing` (layout, LH-31): sibling blocks or groups closer than 0.25 in where the author set `composition.gap` (on the slide, its layout record or a group; the engine default is never reported), or a block closer than 0.5 in to the slide edge, on the composed boxes. Headings, furniture, pictures placed on an edge and bleed regions are exempt.
    - `opf/layout-monotony` (layout): 4 or more content slides in a row with the same layout record; cover, section and closing slides and automatic slides break a run.
    - `opf/straight-quotes` (content): straight `"` or `'` used as quotation marks in titles, body text, lists and quotes, with the deck language's marks in the message and a patch for double quotes. Apostrophes, inch and foot marks, code runs, code blocks and table cells are not reported.
