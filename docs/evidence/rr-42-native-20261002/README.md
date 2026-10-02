# RR-42: native PowerPoint run of every gallery value (2026-10-02)

The supervisor ran this check natively, on the Windows host with desktop PowerPoint 16.0 build 20430, on 2026-10-02 between 20:32 and 20:46 UTC. Each deck was opened read-only through COM with no window, read, and closed without saving. All 399 decks completed, with no timeout and no read error apart from the theme colour read described below. The 33 design decks were run a second time at 21:24 UTC with the fixed reader (`native-colors`) to read the theme colour slots; all 33 completed.

An agent built the decks and ran the comparison; neither step opened Office. The decks, their PNGs and the raw read-outs are not committed. The comparison output is. This is internal evidence only: nothing here is shown on pptx.gallery.

The owner decided on 2026-10-02 that native evidence is required for every value, not for a sample. The run covers 881 values in 399 decks and 933 slides, with at most 15 slides per deck:

- every value pptx.gallery shows;
- the catalog records that have no gallery page;
- the slide-size presets.

## Decks

Each slide is the gallery's own snippet for the value, built by `buildCatalogItemOpfSnippet` at pptx-gallery `34e6656`. The decks were exported with:

- `@openpresentation/opf` 0.12.0;
- `@openpresentation/opf-render` 0.12.0;
- `@openpresentation/opf-pptx` at main `a0ee3e5` (0.12.0 plus FF-05, pptx#152).

The export options were seed 1, date 2026-10-02 and fixed timestamps.

- A value whose snippet has its own deck-level design gets its own deck: colour scheme, theme, font scheme, language, block, background, narrative, audience, tone, purpose, social, header and footer, and slide size. PowerPoint therefore sees exactly the gallery config.
- The 485 layouts and 26 charts share their deck-level fields, so they are packed at most 15 to a deck. Their slide ids are prefixed by the value id.
- The 38 narratives, 8 audiences and 9 purposes with no gallery page, and the 7 slide-size presets, are synthetic. Each is a gallery snippet of the same kind with only the id swapped; `source` in [values.json](values.json) says which.

[decks.json](decks.json) lists each deck with its sha256, its slides and the values it covers.

## Checks

The comparison is a copy of the FF-46 / RR-05 tool, extended for these constructs. A value passes when every gated check passes on its slides. Deck-level checks apply to every value in the deck.

| Check | Gated | Decks or items checked | Result |
| --- | --- | --- | --- |
| opened, complete (every slide read) | yes | 399 decks, 933 slides | pass |
| fonts: each run's Latin, East Asian and complex-script names read back as written | yes | 399 decks | pass |
| theme font slots (major and minor Latin, East Asian, complex script) | yes | 399 decks | pass |
| `Presentation.Fonts`: no name outside the deck's names, and every name its text draws with | yes | 399 decks | 398 pass, 1 fail |
| shape count per slide | yes | 933 slides | pass |
| geometry of every top-level shape, within 0.05 pt (table height excluded) | yes | 4741 shapes | pass (largest delta 0 pt) |
| slide background: the slide does not follow the master, and its fill type matches | yes | 933 slides | pass |
| pictures: picture type, crop applied, non-rectangular geometry kept | yes | 409 pictures | pass |
| header/footer placeholders (`dt`, `ftr`, `sldNum`) of the right type | yes | 27 placeholders | pass |
| fields (slide number, date), classic chart type, notes | yes | 14 fields, 102 charts | pass |
| OPF tags (`OPF_DOCUMENT_V1` on the presentation, `OPF_SLIDE_V1` on each slide) | yes | 399 decks | pass |
| theme colour slots (12: dk1, lt1, dk2, lt2, accent1 to accent6, hlink, folHlink) | yes, where read | 33 design decks (396 slots) from the second run | pass (every slot equals the file's `a:clrScheme`); the other 366 decks not measured |
| direction, alignment, styles, bullets, language ids | reported | 399 decks | no mismatch |
| image score against the opf-render preview | reported | 916 slide pairs | see below |

## Result

**880 of 881 values pass.**

| Type | Values | Pass | Fail |
| --- | ---: | ---: | ---: |
| layouts | 485 | 485 | 0 |
| charts | 26 | 26 | 0 |
| color-schemes | 14 | 14 | 0 |
| themes | 4 | 4 | 0 |
| backgrounds | 6 | 6 | 0 |
| image-treatments | 15 | 15 | 0 |
| headers-footers | 10 | 10 | 0 |
| socials | 10 | 10 | 0 |
| blocks | 32 | 32 | 0 |
| narratives | 48 | 48 | 0 |
| audiences | 22 | 22 | 0 |
| tones | 7 | 7 | 0 |
| purposes | 9 | 9 | 0 |
| languages | 93 | 92 | 1 |
| font-schemes | 93 | 93 | 0 |
| slide-sizes | 7 | 7 | 0 |

The one failing value:

| Value | Failing check | Detail | Likely at fault |
| --- | --- | --- | --- |
| `languages/vietnamese-quoc-ngu` | `presentationFonts` | `Presentation.Fonts` lists Aptos Display, Aptos and **Arial**. The deck's runs and theme slots name only Aptos and Aptos Display. | opf-pptx |

Why opf-pptx: the exported theme carries the Office script supplements, including `<a:font script="Viet" typeface="Arial"/>` in the minor font and Times New Roman in the major font. The runs are `vi-VN`, so PowerPoint lists the Viet supplement. The rule for the fix is under "Script supplements" below.

- **What is drawn:** the text draws in Aptos (the native PNG). The runs' fonts and the theme slots pass. Only the font list is wrong.
- **Fix:** this is the FF-05 class of finding (RR-17). opf-pptx should make the Viet supplement follow the chosen family, or drop it, as FF-05 did for the `ea` slot. Then re-run the deck natively.
- **The two other decks that list Arial pass:** `languages-64-pashto` and `languages-69-punjabi-shahmukhi` name Arial themselves.

## Not measured in this run, and the reported image scores

- **Theme colour slots.** The first run's reader returned the `ThemeColorScheme` object from a scriptblock, so PowerShell enumerated the COM collection (`DISP_E_UNKNOWNNAME`) and read no slot.
  - The reader was fixed (it reads each slot through the full path), and the supervisor re-ran the 33 design decks with it: colour schemes, themes, backgrounds and image treatments.
  - All 33 decks read all 12 slots, and all 396 slots equal the exported `a:clrScheme`. The comparison takes the colours from that run (`compare.mjs --colors native-colors`) and every other check from the first run.
  - The other 366 decks were not re-run. For them the check is null (not measured), not a pass. Their colours are measured offline by audit B and parity.
- **Image scores (reported only).** These are not a fidelity measure for this run. The comparison scored 916 preview/native PNG pairs: 213 close, 258 review and 445 far.
  - The Node preview host used here (opf-render `prepareNodeFonts` with the office pack) draws Aptos with its Roboto fallback. The gallery's browser host loads Intos lazily, and PowerPoint draws Aptos. The `far` band is mostly that face difference: the layout, colours and positions match. A sample: the metadata decks, and `languages-90` above.
  - 17 slides have no score. For 16 of them PowerPoint's `Slide.Export` reported "An error occurred while PowerPoint was saving the file": `layouts-31-text-3x-center-vertical-title-left-slideimage` slides 1 to 15 and `metadata-04` slide 1. The 17th is a 1-bit PNG the decoder does not read (`layouts-32` slide 6). The shapes on all of these slides were read and pass.
- **Comparison fixes.** Two fixes in the comparison were made before this result. Neither changes a measured value:
  - an unread theme is "not measured", not a fail;
  - only the slide's own `OPF_SLIDE_V1` tag is gated. Shape tags such as `OPF_SLIDE_IMAGE_V1` are not read per shape.

## Script supplements: the Vietnamese failure and the rule for opf-pptx

The exported theme carries the Office list of supplemental script fonts (`<a:font script="..." typeface="..."/>`, 47 entries in the minor font). [script-supplements.json](script-supplements.json) records, for every language deck, the entry for the deck's own script, the families the theme slots choose, and `Presentation.Fonts`. The 28 decks with an entry for their own script are:

- 27 decks in a non-Latin script: Arab, Hebr, Deva, Beng, Gujr, Guru, Orya, Taml, Telu, Knda, Mlym, Thai, Khmr, Ethi, Geor, Armn, Jpan, Hang, Hans and Hant;
- Vietnamese, whose `vi` text uses the Latin-based `Viet` entry.

- **Already right in all 27 non-Latin decks:** opf-pptx writes the deck's chosen family into its own script's entry, major and minor. Examples: Arab = Arabic Typesetting, Deva = Mangal, Jpan = Meiryo. The Pashto and Punjabi (Shahmukhi) decks list Arial because their chosen family is Arial.
- **Not applied to `Viet`:** the Vietnamese deck keeps the Office defaults, major Times New Roman and minor Arial. Its runs are `vi-VN`, so PowerPoint lists Arial in `Presentation.Fonts`, although the text draws in the chosen Aptos.
- **No other entry leaks.** Across all 93 language decks and all 399 decks, no other supplemental entry appears in `Presentation.Fonts`. No text uses those scripts.

**Rule for the opf-pptx fix (not implemented here).** The supplemental entry for the script of the deck's own language must name the family the deck uses for that script, in both the major and the minor font:

- `Viet` for a `vi` language (and `Uigh` for `ug`) takes the theme's `a:latin` family: the major Latin family in `a:majorFont` and the minor Latin family in `a:minorFont`;
- a complex-script entry (Arab, Hebr, Deva and the rest) takes the `a:cs` family;
- an East Asian entry (Jpan, Hang, Hans, Hant) takes the `a:ea` family.

This is what opf-pptx already does for the non-Latin entries; the missing case is `Viet`. Entries for other scripts may stay. Deck that shows it: `languages-90-vietnamese-quoc-ngu`. After the fix, re-run that deck natively.

## Files

- [values.json](values.json): the per-value verdict (type, id, deck, slides, source, pass, failing checks and their detail). The [gallery tracker](../../programs/release-readiness/gallery-tracker.md) reads it as `nativeRuns`.
- [compare.md](compare.md) and [compare.json](compare.json): the comparison output, with per-deck checks and mismatches. The image detail is trimmed to the band counts.
- [decks.json](decks.json): the deck list, with sha256 and the values each deck covers.
- [script-supplements.json](script-supplements.json): the own-script supplemental entry of every language deck, against its chosen families and `Presentation.Fonts`.

Burndown: RR-42 in the [release-readiness burndown](../../programs/release-readiness/burndown.md). The failing value is tracked under RR-17 (FF-05 class).
