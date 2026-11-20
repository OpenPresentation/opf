# LH wave 8 and shapes phase 1

Wave 8 of the layout harvest and phase 1 of the shapes work merge eleven reviewed branches into one: SH-01 (opf#1043), SH-03
(opf#1045), SH-02 (opf#1050), LH-18 (opf#1041), LH-168 (opf#1042), LH-160 and LH-161 (opf#1044), LH-166 (opf#1046), LH-169 and LH-170
(opf#1048), LH-164 and LH-163 (opf#1049), LH-165 and LH-162 (opf#1051), LH-63 and LH-78 (opf#1052). Each branch's PR body explains its
change; this note records the combined template baseline.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, the sheet reviewed, then `--promote`d. 9 of 468 slides move, none added or removed:

| Slides | Cause | What moved |
| --- | --- | --- |
| `statement 1 short`, `statement 1 long`, `text 1 short` | LH-164 (#1049) | A slide whose body is one display message takes the layout's accent surface (`accent1`), as #1049 listed. |
| `section 2 short`, `section 4 short`, `section 6 short`, `section 2 long`, `section 4 long`, `section 6 long` | the integration (color.ts) | The section layout's accent surface draws its cards in a mixed card neutral. LH-54's mix towards the text stopped at 1.25:1 against the slide, where white text read 4.0:1 on the card; it now stops where the text still reads 4.5:1 (`CARD_TEXT_MIN_CONTRAST`), so the cards are a little closer to the surface (1.12:1 where they were 1.26:1; their 1 px stroke sets them off) and every text on them reads 4.5:1. The same rule holds LH-165's icon cards and LH-162's text tiles on an accent slide. |

No template slide changes geometry: SH-02's shape blocks and SH-03's effects are not in the template samples, and LH-18, LH-63, LH-78,
LH-160, LH-161, LH-162, LH-165, LH-168, LH-169 and LH-170 do not fire on them.

## Raster goldens

`golden.mjs` and `golden-gate.mjs` are not regenerated here; the `golden` workflow regenerates them. The moves expected are the union
of the PRs' lists: #1044's five baselines and the histogram digest, #1041's `technical/layout-sampler#11` and narrative n11, #1049's 16
slides in 15 decks, #1052's `technical/layout-sampler` #5, #12, #30 and #42, and the new example `technical/shape-effects.opf.json`; plus
any slide of an example with a comparison verdict, a note under figures, a figure-led list, a list or groups with icons, short paragraphs
on an automatic slide, a process of one-entry steps, a shape block or a card on an accent surface.
