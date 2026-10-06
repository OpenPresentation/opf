# FF-27 fields and slide-size presets: PowerPoint vs the exported packages

Packages: @openpresentation/opf 0.12.1, @openpresentation/opf-pptx 0.12.3, @openpresentation/opf-render 0.12.0; Node 24.21.0.

Date field: `MMMM d, yyyy` exports as `a:fld type="datetime4"` (cached "January 15, 2026" from options.date 2026-01-15). MMMM d, yyyy is an en-US field type (PowerPoint's ppDateTimeMMMMdyyyy). The exported run is lang en-US, so month names should read English whatever the host region; compare.mjs tolerates a locale-dependent rendering of the same day (WARN) and fails a read of the cached date.

## Fields (renumber and update): PASS

Host clock at the read: 2026-10-05 12:01:21, culture en-US; expected en-US date "October 5, 2026". PowerPoint 16.0 build 20430.

- initial: order Alpha slide > Bravo slide > Charlie slide > Delta slide > Echo slide; slide numbers 1, 2, 3, 4, 5 (follow the order)
- after-duplicate (Slides(1).Duplicate()): order Alpha slide > Alpha slide > Bravo slide > Charlie slide > Delta slide > Echo slide; slide numbers 1, 2, 3, 4, 5, 6 (follow the order)
- after-move (Slides(6).MoveTo(1)): order Echo slide > Alpha slide > Alpha slide > Bravo slide > Charlie slide > Delta slide; slide numbers 1, 2, 3, 4, 5, 6 (follow the order)

| Level | Check | Detail |
|---|---|---|
| PASS | all | no FAIL, WARN or MISSING |

## Slide sizes: FAIL

PowerPoint values are read in memory from a deck exported with opf-pptx 0.12.3 (the vehicle) after setting `PageSetup.SlideSize`; opf-pptx values are `p:sldSz` of tiny exported decks. A difference is a record, not a gate.

| Preset | PowerPoint | PowerPoint EMU | PowerPoint in | opf-pptx EMU | opf-pptx in | Delta EMU (PowerPoint - opf) | Verdict |
|---|---|---|---|---|---|---|---|
| baseline | the deck as opened (opf-pptx 16:9) | 12192000 x 6858000 | 13.3333 x 7.5 | - | - | - | reference |
| widescreen | custom 960 x 540 pt (Design > Slide Size > Widescreen) | 12192000 x 6858000 | 13.3333 x 7.5 | 12192000 x 6858000 | 13.3333 x 7.5 | 0, 0 | MATCH |

- FAIL: a4: PageSetup.SlideSize : Failed.

- FAIL: 4:3: PageSetup.SlideSize : Failed.

- FAIL: 16:10: PageSetup.SlideSize : Failed.

- FAIL: letter: PageSetup.SlideSize : Failed.

- FAIL: 16:9: PageSetup.SlideSize : Failed.

- FAIL: ref-9: PageSetup.SlideSize : Failed.

- FAIL: ref-10: PageSetup.SlideSize : Failed.
