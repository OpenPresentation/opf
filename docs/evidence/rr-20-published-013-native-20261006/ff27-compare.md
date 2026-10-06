# FF-27 fields and slide-size presets: PowerPoint vs the exported packages

Packages: @openpresentation/opf 0.13.0, @openpresentation/opf-pptx 0.13.1, @openpresentation/opf-render 0.13.0; Node 24.21.0.

Date field: `MMMM d, yyyy` exports as `a:fld type="datetime4"` (cached "January 15, 2026" from options.date 2026-01-15). MMMM d, yyyy is an en-US field type (PowerPoint's ppDateTimeMMMMdyyyy). The exported run is lang en-US, so month names should read English whatever the host region; compare.mjs tolerates a locale-dependent rendering of the same day (WARN) and fails a read of the cached date.

## Fields (renumber and update): PASS

Host clock at the read: 2026-10-06 10:50:32, culture en-US; expected en-US date "October 6, 2026". PowerPoint 16.0 build 20430.

- initial: order Alpha slide > Bravo slide > Charlie slide > Delta slide > Echo slide; slide numbers 1, 2, 3, 4, 5 (follow the order)
- after-duplicate (Slides(1).Duplicate()): order Alpha slide > Alpha slide > Bravo slide > Charlie slide > Delta slide > Echo slide; slide numbers 1, 2, 3, 4, 5, 6 (follow the order)
- after-move (Slides(6).MoveTo(1)): order Echo slide > Alpha slide > Alpha slide > Bravo slide > Charlie slide > Delta slide; slide numbers 1, 2, 3, 4, 5, 6 (follow the order)

| Level | Check | Detail |
|---|---|---|
| PASS | all | no FAIL, WARN or MISSING |

## Slide sizes: RECORDED

PowerPoint values are read in memory from a deck exported with opf-pptx 0.13.1 (the vehicle) after setting `PageSetup.SlideSize`; opf-pptx values are `p:sldSz` of tiny exported decks. A difference is a record, not a gate.

| Preset | PowerPoint | PowerPoint EMU | PowerPoint in | opf-pptx EMU | opf-pptx in | Delta EMU (PowerPoint - opf) | Verdict |
|---|---|---|---|---|---|---|---|
| undefined | undefined | 9906000 x 6858000 | 10.8333 x 7.5 | - | - | - | reference |
| undefined | undefined | 9144000 x 6858000 | 10 x 7.5 | - | - | - | reference |
| undefined | undefined | 9144000 x 5715000 | 10 x 6.25 | - | - | - | reference |
| undefined | undefined | 9144000 x 6858000 | 10 x 7.5 | - | - | - | reference |
| undefined | undefined | 9144000 x 5143500 | 10 x 5.625 | - | - | - | reference |
| undefined | undefined | 12801600 x 9601200 | 14 x 10.5 | - | - | - | reference |
| undefined | undefined | 10826750 x 8120062 | 11.8403 x 8.8802 | - | - | - | reference |
