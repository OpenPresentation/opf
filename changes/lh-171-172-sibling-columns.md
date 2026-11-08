---
type: changed
packages: [opf]
---
LH-171 and LH-172 (output-changing for comparisons of two or three columns): sibling columns now read alike.
    - **One list form (LH-171).** A list whose entries each pair a short phrase with a description ("Live in 8 weeks") is drawn as ruled rows when another list on the slide is ruled. A list on its own still needs labels of three words or fewer. `rowLabel` takes a phrase of up to six words and 48 characters, and `ROW_LABEL_WORDS` and `ROW_LABEL_CHARS` are exported.
    - **Shared row tracks (LH-172).** Sibling groups that each hold a heading text over one text or list block now share their row tracks. The headings start on one line at the tallest heading's height, and the bodies start and end on one line. This uses the `heading-tracks` rule and moves boxes only.
    - Narrative n19 draws both columns as rows with aligned headings and bodies, as Claude Design does.
