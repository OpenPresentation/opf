# RR-59: measured Arabic export and the image placeholder, native run (2026-10-08)

This is the supervisor-run, read-only check in Windows PowerPoint for [opf#477](https://github.com/OpenPresentation/opf/issues/477). It used PowerPoint 365 16.0 (build 20430) on Windows 11, with Arabic Typesetting and Traditional Arabic installed as system fonts; Aptos comes from Office. The decks were exported with the **published 0.16.0 set**: `@openpresentation/opf`, `opf-render` and `opf-pptx` 0.16.0. The run also installed `@resvg/resvg-js` 2.6.2, `sharp` 0.35.5, the office-pack font packages at the renderer's pins, and `@expo-google-fonts/noto-naskh-arabic` 0.4.5 and `noto-sans-arabic` 0.4.3. The decks, PNGs and native read-outs are not committed; only the comparison output is.

- [compare.md](compare.md) and [compare.json](compare.json) are the output of `node compare.mjs --native native-run1` from the scratch `rr-59-native` set. That set holds the RR-05b reader with three read-only additions: per-line `TextRange.Lines(i)` bounds, `Shape.AlternativeText`, and the theme font slots of each slide's master. The script contains no absolute paths and never opens Office.
- **Fonts.** Each deck was exported with one handle, `loadFonts({ pack: 'office', scripts: 'auto', presentation, renderOptions: { catalogs } })`. The same handle drew the SVG preview, computed the shared line geometry and wrote the PPTX (`toPptx(deck, { fonts, catalogs: [defaultCatalog] })`). Two exports of each deck were byte-identical.

## Decks

| Deck | What it checks | Complex-script family |
| --- | --- | --- |
| `ar-title-body` | An `ar-SA` title and body; the body wraps to three lines | Arabic Typesetting (theme `a:cs`) |
| `ar-mixed` | `PowerPoint 365`, `v2.0`, `report-2026.pptx` and a URL inside Arabic sentences; a list; a title that starts in Latin | Arabic Typesetting |
| `ar-run-in-en` | An `en-US` deck with `lang: "ar-SA"` runs in the title and the body | the theme `cs` is empty, and the runs carry `a:cs` Arabic Typesetting |
| `ar-scheme-override` | An `ar-SA` deck on `arabic-typesetting`, with slide 2 overridden to `traditional-arabic` | slides 1 and 3 use Arabic Typesetting; slide 2 uses Traditional Arabic, from its own master and theme |
| `unresolved-image` | A content image with an `https:` source, never fetched, and with alt text | none |

## Result: 5 decks, 0 failing gates

- **Gated:**
  - **Fonts and theme:** `Presentation.Fonts` names only the chosen families. The theme `a:cs` slot is the selected complex-script family, for the deck and for each slide, including the slide-level override on its own master.
  - **Direction and alignment:** these match on every paragraph. Right-to-left paragraphs read `Alignment` 3. The `ar-mixed` title that starts in Latin is left to right and left-aligned.
  - **Lines:** PowerPoint draws each shared composed line as exactly one line, with no extra wrapping. No line is clipped: every line's bottom is inside its shape.
  - **Placeholder:** the unresolved image opens as editable shapes, a dashed panel `OPF image placeholder 1` with alt text `Image unavailable: <alt>` and the label "Image unavailable" over the alt text. The shapes are not grouped (a `p:grpSp`), which #477's acceptance does not require.
- **Line positions against the shared composition** (reported, not gated):
  - Tops agree within 0.01 pt and heights within 0.81 pt.
  - The right edges of right-to-left lines agree within 0.13 pt.
  - PowerPoint draws Arabic Typesetting and Traditional Arabic lines narrower than the composition measures them, by up to 56 pt and 223 pt. The renderer measures both with Noto Naskh Arabic, scaled for Arabic Typesetting. The left edges of right-to-left lines differ by those amounts, and wrapping and line counts still agree.
  - In `ar-run-in-en`, one English line with an Arabic run is 3.78 pt wider than its box in PowerPoint. It is not clipped.
- **Visual check (supervisor):**
  - In PowerPoint, `PowerPoint 365`, `v2.0`, the file name and the URL each read left to right as one phrase inside the Arabic text, with their spaces.
  - Bullets sit at the right edge, with a gap.
  - The wrapped body lines are right-aligned.

## Defects filed

- [opf-pptx#214](https://github.com/OpenPresentation/opf-pptx/issues/214): under the default (metric) font policy, `toPptx` of a deck with an unresolved image fails with `font-unavailable` for Aptos, even with the office pack loaded. The placeholder label is measured at weight 600, which Intos does not have, and the error message wrongly says no replacement is loaded. The `unresolved-image` deck in this run was exported with `substitutionPolicy: 'visual'`.
- [opf#485](https://github.com/OpenPresentation/opf/issues/485): `validate` with the fonts handle reports `opf/layout-failed` ("Intos Display cannot display U+645") on the three decks with Arabic in a title, although the same handle renders and exports them and the native gates pass. Without `fonts`, `validate` is clean.
- [opf-render#175](https://github.com/OpenPresentation/opf-render/issues/175): in the `ar-mixed` SVG preview, which PowerPoint draws correctly, the space at the boundary between Arabic and Latin runs is lost. The bullet overlaps the text of two right-to-left list items. Latin phrases inside Arabic list items are drawn in a larger fallback face.

The RR-54 table evidence still stands: the table restore change left the slide XML unchanged, as #477 notes. Burndown row: RR-59 ([burndown](../../programs/release-readiness/burndown.md)).
