# FF-27: fields renumber and update natively; slide-size presets against PowerPoint (2026-10-05)

Covers two sections of [opf#323](https://github.com/OpenPresentation/opf/issues/323):

- **Section 2, FF-27.** Do the exported slide-number and date fields renumber and update in PowerPoint? **Pass.**
- **Section 5, slide-size presets.** opf-pptx's `p:sldSz` compared with the sizes of PowerPoint's own presets. **Recorded:**
  three of the opf-pptx names differ from the PowerPoint preset with a similar name. This is not a gate.

## Host and method

- Windows 11 with desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- The host clock was 2026-10-05 and the culture `en-US`.
- The supervisor session ran Office. An agent built the decks and scripts without opening Office.
- Decks were built with the published `@openpresentation/opf` 0.12.1 and `@openpresentation/opf-pptx` 0.12.3 on Node
  24.21.0. Their sha256 values are in [decks.json](decks.json) and were checked before the run.
- Every script ran in its own `powershell.exe` with a 90 s deadline ([run.json](run.json)).
- Nothing was saved:
  - no `Save`, `SaveAs` or `SaveCopyAs`;
  - in-memory edits were discarded by marking the presentation clean (`Saved = true`) and closing it;
  - PowerPoint was never quit or killed.

## FF-27: fields (pass)

The deck `01-headers-footers` has 5 slides, each with OPF footer furniture. The furniture holds a
`<a:fld type="slidenum">` field, footer text, and a date field `<a:fld type="datetime4">`. The date field was authored
with `dateFormat: 'MMMM d, yyyy'`, and the export caches the text "January 15, 2026", a date in the past on purpose.

`native-fields.ps1` opened the deck read-only (`Presentations.Open(path, -1, 0, 0)`). It read the slide-number, date and
footer placeholders of every slide, before and after `Slide.Export`, which lays out the slide. It did this three times:

| Step | Operation (in memory) | Slide order | Slide numbers read |
| --- | --- | --- | --- |
| initial | none | Alpha, Bravo, Charlie, Delta, Echo | 1, 2, 3, 4, 5 |
| after-duplicate | `Slides(1).Duplicate()` | Alpha, Alpha, Bravo, Charlie, Delta, Echo | 1, 2, 3, 4, 5, 6 |
| after-move | `Slides(6).MoveTo(1)` | Echo, Alpha, Alpha, Bravo, Charlie, Delta | 1, 2, 3, 4, 5, 6 |

- **The numbers follow the new order** after the insert and after the move. The duplicated slide and the moved slide
  take their new positions.
- **The date field updates:**
  - every slide reads "October 5, 2026", the host date in the chosen `MMMM d, yyyy` format, not the cached
    "January 15, 2026";
  - PowerPoint reports `HeadersFooters.DateAndTime.UseFormat = true` with `Format = 4` (`ppDateTimeMMMMdyyyy`);
  - the slide-number, date and footer placeholders are all visible.
- `compare.mjs` reports no FAIL, WARN or MISSING for the fields ([compare.md](compare.md), [compare.json](compare.json)).
  The raw read is [fields.json](fields.json).

## Slide-size presets (recorded)

PowerPoint's preset sizes were read by setting `PageSetup.SlideSize` in memory and reading `SlideWidth` and
`SlideHeight` (points × 12700 = EMU). opf-pptx's values are the `p:sldSz` of small decks exported with
`design.dimensions` set to each size.

The first two attempts could not set the slide size. They are kept as evidence and were not retried in place:

1. **Attempt 1:** on a deck opened read-only without a window, every preset returned `PageSetup.SlideSize : Failed.`
   ([slide-sizes-attempt-1.json](slide-sizes-attempt-1.json); the slide-size FAIL lines in [compare.md](compare.md)
   come from this attempt).
2. **Attempt 2:** on a new presentation without a window (`Presentations.Add(0)`), it failed the same way
   ([slide-sizes-attempt-2.json](slide-sizes-attempt-2.json)).
3. **Attempt 3:** on a new presentation with a window (`Presentations.Add(-1)`), every preset was set and read back
   ([slide-sizes-attempt-3.json](slide-sizes-attempt-3.json)). PowerPoint needs a document window to change page setup.
   The presentation was never saved.

| opf-pptx size | PowerPoint preset | PowerPoint | opf-pptx `p:sldSz` | Same |
| --- | --- | --- | --- | --- |
| a4 | A4 Paper | 10.8333 x 7.5 in (9906000 x 6858000) | 11.69 x 8.27 in (10689336 x 7562088) | no |
| 4:3 | On-screen Show (4:3) | 10 x 7.5 in (9144000 x 6858000) | 10 x 7.5 in (9144000 x 6858000) | yes |
| 16:10 | On-screen Show (16:10) | 10 x 6.25 in (9144000 x 5715000) | 10 x 6.25 in (9144000 x 5715000) | yes |
| letter | Letter Paper | 10 x 7.5 in (9144000 x 6858000) | 11 x 8.5 in (10058400 x 7772400) | no |
| 16:9 | On-screen Show (16:9) | 10 x 5.625 in (9144000 x 5143500) | 13.3333 x 7.5 in (12192000 x 6858000) | no |
| widescreen | Widescreen (a new presentation's default) | 13.3333 x 7.5 in (12192000 x 6858000) | 13.3333 x 7.5 in (12192000 x 6858000) | yes |

For reference, PowerPoint's A3 Paper is 14 x 10.5 in and B4 (ISO) Paper is 11.8403 x 8.8802 in. The table is also in
[sizes-compare.md](sizes-compare.md) and [sizes-compare.json](sizes-compare.json).

What the differences mean:

- PowerPoint's paper presets are not the paper sizes. They are slide areas that fit the paper with margins:
  - "A4 Paper" is 10.83 x 7.5 in, against A4 paper at 11.69 x 8.27 in;
  - "Letter Paper" is 10 x 7.5 in, the same as 4:3, against letter paper at 11 x 8.5 in.

  opf-pptx's `a4` and `letter` write the paper size itself.
- PowerPoint's "On-screen Show (16:9)" is 10 x 5.625 in. opf-pptx's `16:9` writes 13.333 x 7.5 in, which is the same
  shape at PowerPoint's Widescreen size, the default of a new presentation.
- `4:3`, `16:10` and `widescreen` match PowerPoint exactly.

Whether `a4`, `letter` and `16:9` should keep the paper sizes or follow PowerPoint's presets is a design decision for
the spec. These values already passed RR-42 on their own terms. Nothing here changes a gate.

## Files

- [fields.json](fields.json): the raw FF-27 read (three steps, before and after layout).
- [compare.md](compare.md) and [compare.json](compare.json): `compare.mjs` on the field read and slide-size attempt 1.
- [slide-sizes-attempt-1.json](slide-sizes-attempt-1.json), [slide-sizes-attempt-2.json](slide-sizes-attempt-2.json)
  and [slide-sizes-attempt-3.json](slide-sizes-attempt-3.json): the three slide-size reads.
- [sizes-compare.md](sizes-compare.md) and [sizes-compare.json](sizes-compare.json): attempt 3 against opf-pptx.
- [run.json](run.json): one record per script run.
- [decks.json](decks.json): the set manifest (decks, sha256, expected field text, opf-pptx sizes).

The decks and PNGs are not committed.

## Decision on the slide-size differences (2026-10-05, Windows supervisor, vetoable)

**Keep OPF's values.**
- The schema says a preset chooses both aspect ratio and physical size: `a4` and `letter` are the paper sizes, which
  suit print and PDF.
- `16:9` is PowerPoint's Widescreen, the default for new decks.
- Changing them would move every existing deck for no fidelity gain.

The documentation follow-up, which explains that PowerPoint's "A4 Paper" and "Letter Paper" are smaller slide areas
and that matching them takes custom inches, is [opf#365](https://github.com/OpenPresentation/opf/issues/365).
