# Header & Footer dialog fixtures (RR-102)

PowerPoint-saved decks for `test/header-footer-dialog.mjs`. `source.opf.json` (six slides, a three-zone footer with
`Page {{slide.number}} of {{deck.slideCount}}`, slide 6 `design.footer: false`) was exported by this branch's opf-pptx twice,
`source.pptx` (default, full provenance) and `source-bare.pptx` (`provenance: false`), with `date: '2026-11-06'`.
PowerPoint for Windows (16.0.20527, through COM on 2026-11-06) then opened each export, changed Insert > Header & Footer as
`plan.json` says, and saved a copy:

| File | From | Change |
| --- | --- | --- |
| `edits.pptx`, `edits-bare.pptx` | source, source-bare | Apply to All: Date and time on; slide 2: Footer text `Acme Labs`; slide 3: Slide number off; slide 6: Footer `Added in PowerPoint` and Slide number on |
| `apply-all.pptx`, `apply-all-bare.pptx` | source, source-bare | Apply to All: Date and time Fixed `Q4 2026`, Footer `Acme Group`, Slide number off |
| `date-format.pptx` | source | Apply to All: Date and time Update automatically, the fourth format (`ppDateTimeMMMMdyyyy`) |

"Apply to All" is emulated as the dialog does it: the item set on the slide master's, every layout's and every slide's
`HeadersFooters`; "Apply" sets the one slide's. The dialog itself is a check for PowerPoint's UI (docs/native-header-footer.md,
"Not covered").
