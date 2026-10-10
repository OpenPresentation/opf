# FF-27: fields renumber and update natively, 0.18 furniture forms (2026-10-10)

This re-runs [opf#323](https://github.com/OpenPresentation/opf/issues/323) section 2 on the published 0.18 packages. FF-27 passed on
0.12 in [ff-27-fields-slide-sizes-native-20261005](../ff-27-fields-slide-sizes-native-20261005/README.md). Since then, FA-31 changed
how furniture is authored:
- generated values are `{{ }}` variables inside a zone's `text`;
- `date: true` with a `dateFormat` is the live date.

This run checks those forms. **Result: PASS on both decks.**

## Host and method

- **Host:** Windows 11 (`Microsoft Windows NT 10.0.26200.0`), PowerPoint 365 16.0 build 20430, culture en-US, host date 2026-10-10.
- **Packages:** the published `@openpresentation/opf` 0.18.1 and `@openpresentation/opf-pptx` 0.18.0 (with `opf-render` 0.18.0 for
  measurement), on Node 24.21.0.
  - The exporter's host date (`toPptx({date})`) was 2026-01-15 on purpose, so the cached field text is a past date. A live field must
    show the host's clock in PowerPoint; a static one would keep the cached text.
  - The sha256 of each deck is in [decks.json](decks.json) and was checked before the run.
- **The read** (`native-fields.ps1`, one child `powershell.exe` per deck, 90 s deadline):
  1. Open read-only with `Presentations.Open(path, -1, 0, 0)`.
  2. Read the furniture shapes and `Slide.HeadersFooters` of every slide, before and after `Slide.Export` (which lays the slide out).
  3. **In memory only:** call `Slides(1).Duplicate()` (an insert) and read again.
  4. Then call `Slides(6).MoveTo(1)` (a move) and read again.
  5. Discard the edits with `Saved = -1` and `Close()`.
- **Nothing was saved,** and PowerPoint was never quit or killed. The raw read is [fields.json](fields.json).

## Decks

| Deck | Furniture (OPF 0.18) | Exported |
| --- | --- | --- |
| `01-footer-fields` | footer left `date: true, dateFormat: 'MMMM d, yyyy'`; center `text: 'FF-27 fields check'`; right `text: '{{slide.number}}'` | `dt` placeholder with `<a:fld type="datetime4">` (cached "January 15, 2026"), `ftr` placeholder, `sldNum` placeholder with `<a:fld type="slidenum">` |
| `02-header-forms` | header left `text: 'Page {{slide.number}} of {{deck.slideCount}}'`; header right `date: true` (default `M/d/yyyy`); footer right `text: 'A-{{slide.number}}'` | a tagged header shape whose `slidenum` field sits between fixed runs, a tagged header shape with `datetime1` (cached "1/15/2026"), and the `sldNum` placeholder with the fixed prefix `A-` |

## Result

| Deck | Step | Slide order | Slide numbers read | Date read |
| --- | --- | --- | --- | --- |
| 01 | initial | Alpha, Bravo, Charlie, Delta, Echo | 1 to 5 | October 10, 2026 |
| 01 | after `Slides(1).Duplicate()` | Alpha, Alpha, Bravo, Charlie, Delta, Echo | 1 to 6 | October 10, 2026 |
| 01 | after `Slides(6).MoveTo(1)` | Echo, Alpha, Alpha, Bravo, Charlie, Delta | 1 to 6 | October 10, 2026 |
| 02 | initial | Alpha, ..., Echo | "Page 1 of 5" to "Page 5 of 5", "A-1" to "A-5" | 10/10/2026 |
| 02 | after the insert | 6 slides | "Page 1 of 5" to "Page 6 of 5", "A-1" to "A-6" | 10/10/2026 |
| 02 | after the move | 6 slides | "Page 1 of 5" to "Page 6 of 5", "A-1" to "A-6" | 10/10/2026 |

- **Renumbering.** Every slide-number field reads its new position after the insert and after the move. That holds in the `sldNum`
  placeholder and inside a tagged header shape with fixed words around the field.
- **The live date.** It reads the host date in the chosen en-US format, never the cached export date.
  - In deck 01, PowerPoint reports `HeadersFooters.DateAndTime.UseFormat = true` with `Format = 4` (`ppDateTimeMMMMdyyyy`).
  - In deck 02 the date is a tagged header shape, not the `dt` placeholder, so `HeadersFooters` describes the empty master
    placeholder and is not part of the check.
- **"of 5" after six slides is by design.** `{{deck.slideCount}}` is fixed text, because PowerPoint has no slide-count field (core
  `HeaderFooterItem.text`, opf-pptx README).

## Harness note

Every `run.json` records `exitCode: null`. This is the attempt-1 harness bug described in
[rr-05-ff-12-native-20261010](../rr-05-ff-12-native-20261010/README.md#harness-notes). Both read-outs reached `stage: done` with no
error, and `run-deck.ps1` is fixed for later attempts.

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the comparison.
- [fields.json](fields.json): the raw reads of both decks, with three steps each, before and after layout. Paths are written as `<set>`.
- [decks.json](decks.json): the set, with the sha256 values and the expected field types and formats.
- [run.json](run.json): one record per deck, plus the host.

The decks and PNGs are not committed.
