# Slide sizes: OPF presets and PowerPoint presets

OPF sets one slide size per deck, in `design.dimensions` (or the resolved theme's `dimensions`). The value is a
preset name (`"16:9"`, or `{ "preset": "16:9" }`) or a custom size in inches (`{ "widthInches": 10, "heightInches":
7.5 }`). A custom width or height overrides the preset's. A slide's own `design` cannot set a size, because a PPTX has
one slide size ([schema reference](schema-reference.md#dimensionpreset)).

This page lists the exact size of every preset, which PowerPoint size each one exports as, and where an OPF name and a
PowerPoint preset with a similar name differ. The values come from:

- `resolveCanvasDimensions` in [`packages/javascript/src/composition.ts`](../packages/javascript/src/composition.ts),
  which every engine uses;
- the `p:sldSz` writer and reader in `@openpresentation/opf-pptx` (`src/index.js`);
- PowerPoint 16.0 build 20430, which reported its own preset sizes in the native run
  [FF-27](evidence/ff-27-fields-slide-sizes-native-20261005/README.md) (opf#323, opf#354).

## Units

- 1 inch = 914,400 EMU = 72 pt = 96 OPF reference pixels. 1 pt = 12,700 EMU.
- OPF composes every slide at 96 reference pixels per inch. A 13.333 x 7.5 in slide is a 1280 x 720 canvas, and a
  10 x 7.5 in slide is 960 x 720. Text sizes are physical (points), so the same content wraps differently on a
  smaller slide.
- The PPTX `p:sldSz` element stores `cx` and `cy` in EMU. The exporter writes `Math.round(inches x 914400)`.

## OPF presets

| OPF preset | Inches | Points | EMU (`p:sldSz cx x cy`) | Canvas (px) |
| --- | --- | --- | --- | --- |
| `16:9`, `widescreen` | 13.333 x 7.5 | 960 x 540 | 12192000 x 6858000 | 1280 x 720 |
| `4:3`, `standard` | 10 x 7.5 | 720 x 540 | 9144000 x 6858000 | 960 x 720 |
| `16:10` | 10 x 6.25 | 720 x 450 | 9144000 x 5715000 | 960 x 600 |
| `letter` | 11 x 8.5 | 792 x 612 | 10058400 x 7772400 | 1056 x 816 |
| `a4` | 11.69 x 8.27 | 841.68 x 595.44 | 10689336 x 7562088 | 1122.24 x 793.92 |
| `1:1` | 7.5 x 7.5 | 540 x 540 | 6858000 x 6858000 | 720 x 720 |
| `4:5` | 7.5 x 9.375 | 540 x 675 | 6858000 x 8572500 | 720 x 900 |
| `9:16` | 7.5 x 13.333 | 540 x 960 | 6858000 x 12192000 | 720 x 1280 |

- `widescreen` is an alias of `16:9`, and `standard` an alias of `4:3`. Each pair exports the same bytes.
- No `design.dimensions` and no theme size means `16:9`.
- `letter` and `a4` are the paper sizes. `a4` is rounded to 11.69 x 8.27 in. ISO A4 is 297 x 210 mm (11.6929 x
  8.2677 in, 10692000 x 7560000 EMU), so the `a4` slide is about 0.07 mm narrower and 0.06 mm taller than the paper.
- `1:1`, `4:5` and `9:16` keep the widescreen short edge of 7.5 in.

## PowerPoint presets

PowerPoint's Design > Slide Size > Custom Slide Size dialog offers named sizes under "Slides sized for". The table
lists the ones the native run read back, and the OPF preset that matches each one.

| PowerPoint preset | PowerPoint size | EMU | OPF equivalent |
| --- | --- | --- | --- |
| Widescreen (the size of a new presentation) | 13.333 x 7.5 in, 960 x 540 pt | 12192000 x 6858000 | `16:9` / `widescreen`: same size |
| On-screen Show (4:3) | 10 x 7.5 in, 720 x 540 pt | 9144000 x 6858000 | `4:3` / `standard`: same size |
| On-screen Show (16:10) | 10 x 6.25 in, 720 x 450 pt | 9144000 x 5715000 | `16:10`: same size |
| On-screen Show (16:9) | 10 x 5.625 in, 720 x 405 pt | 9144000 x 5143500 | none; the same shape as `16:9` at 75% of its size. Use `{ "widthInches": 10, "heightInches": 5.625 }` |
| Letter Paper (8.5 x 11 in) | 10 x 7.5 in, 720 x 540 pt | 9144000 x 6858000 | not `letter`; the same size as `4:3`. Use `{ "widthInches": 10, "heightInches": 7.5 }` or `4:3` |
| A4 Paper (210 x 297 mm) | 10.833 x 7.5 in, 780 x 540 pt | 9906000 x 6858000 | not `a4`. Use `{ "widthInches": 10.8333, "heightInches": 7.5 }` |
| A3 Paper (297 x 420 mm) | 14 x 10.5 in, 1008 x 756 pt | 12801600 x 9601200 | none; use custom inches |
| B4 (ISO) Paper | 11.8403 x 8.8802 in | 10826750 x 8120062 | none; use custom inches |

What differs:

- **PowerPoint's paper presets are not the paper.** "Letter Paper" and "A4 Paper" are slide areas that print on that
  paper with margins: 10 x 7.5 in on letter paper (11 x 8.5 in) and 10.833 x 7.5 in on A4 paper (11.69 x 8.27 in).
  OPF's `letter` and `a4` are the full paper sizes, which suit print and PDF output. A deck that must match
  PowerPoint's "Letter Paper" or "A4 Paper" slide exactly uses custom `widthInches` and `heightInches`.
- **"Widescreen" and "On-screen Show (16:9)" have the same shape at different sizes.** Widescreen (13.333 x 7.5 in)
  has been PowerPoint's size for new decks since PowerPoint 2013, and it is what OPF's `16:9` writes. "On-screen Show
  (16:9)" is the older 10 x 5.625 in size. A deck at that size scales to Widescreen without changing shape, but text
  in points is relatively larger on the smaller slide, so it does not lay out the same.
- **"On-screen Show (4:3)" and "(16:10)"** are the same sizes as OPF's `4:3` and `16:10`.
- PowerPoint's other presets (Ledger, B5, 35 mm Slides, Overhead, Banner) have no OPF preset. Use custom inches.

OPF kept its values in 2026-10 (opf#365, vetoable): the schema says a preset chooses both aspect ratio and physical
size, and changing `letter`, `a4` or `16:9` now would move every existing deck and golden for no fidelity gain.

## Export to PPTX

- `@openpresentation/opf-pptx` writes `p:sldSz` with the EMU values in the first table, and `p:notesSz` with the
  width and height swapped. It writes no `type` attribute, so the size is `custom`, the default of `sldSz@type` in
  ECMA-376. PowerPoint reports its own Widescreen size the same way: a new deck reads `PageSetup.SlideSize = 7`
  (`ppSlideSizeCustom`), 960 x 540 pt.
- PowerPoint therefore shows an exported `4:3` or `16:10` deck as a custom size with the right dimensions, not as the
  "On-screen Show" preset. The size is the same, only the preset label differs.
- A deck whose slides resolve to different sizes (a slide-level theme with other `dimensions`) fails export with
  `mixed-slide-dimensions`, and `validate` warns first with `opf/slide-theme-dimensions`.
- ECMA-376 limits `cx` and `cy` to 914,400 to 51,206,400 EMU (1 to 56 in). The OPF schema only requires a positive
  size, so `validate` warns with `opf/slide-size-out-of-range` (a `format` warning, so `valid` does not change) when
  the deck's custom size has a side outside that range. It reads `design.dimensions`, or the resolved theme's
  `dimensions` when the deck sets none, and converts inches to EMU the way the exporter does
  (`Math.round(inches x 914400)`), so exactly 1 in and 56 in pass. The presets are all in range. The exporter does not
  check the range: it still writes the `p:sldSz` it is given, which does not conform to the standard when the size is
  outside 1 to 56 in. Run `validate` first; PowerPoint's own behaviour at the limits was not measured.

## Import from PPTX

- `fromPptx` reads `p:sldSz` `cx` and `cy` and sets `design.dimensions` to `{ widthInches: cx / 914400, heightInches:
  cy / 914400 }`, unrounded. It does not match the size against the preset table and ignores the `type` attribute. A
  PowerPoint "Letter Paper" deck imports as `{ "widthInches": 10, "heightInches": 7.5 }`, which composes on the same
  canvas as `4:3`; an "On-screen Show (16:9)" deck imports as `{ "widthInches": 10, "heightInches": 5.625 }` (a
  960 x 540 canvas).
- A package that `toPptx` wrote carries the source document's provenance. While `p:sldSz` is unchanged, import
  restores the authored value (`"a4"`, `"widescreen"`, `{ "preset": "9:16" }`) instead of the inches. If the size was
  changed in PowerPoint, the observed inches are imported and `design.dimensions` is reported as changed. A deck that
  stated no size and still has the exported one imports with no `design.dimensions`.
- A package with no `p:sldSz` imports with no `design.dimensions`, and its slides are read at the widescreen size.

## Sources

- ECMA-376 / ISO/IEC 29500-1, PresentationML: §19.2.1.39 `sldSz` (Presentation Slide Size; `cx`, `cy`, and `type`
  with default `custom`), §19.7.17 `ST_SlideSizeCoordinate` (914400 to 51206400 EMU) and §19.7.18
  `ST_SlideSizeType` (`screen4x3`, `screen16x9`, `screen16x10`, `letter`, `A4`, `A3`, `ledger`, `B4ISO`, `B5ISO`,
  `B4JIS`, `B5JIS`, `35mm`, `overhead`, `banner`, `hagakiCard`, `custom`).
- Microsoft Open XML SDK:
  [SlideSize](https://learn.microsoft.com/dotnet/api/documentformat.openxml.presentation.slidesize) and
  [SlideSizeValues](https://learn.microsoft.com/dotnet/api/documentformat.openxml.presentation.slidesizevalues).
- PowerPoint VBA: [PpSlideSizeType](https://learn.microsoft.com/office/vba/api/powerpoint.ppslidesizetype).
- Microsoft Support:
  [Change the size of your slides](https://support.microsoft.com/office/change-the-size-of-your-slides-040a811c-be43-40b9-8d04-0de5ed79987e)
  (Widescreen is the default for new presentations, and the list of "Slides sized for" presets).
- Native measurements: [FF-27 slide-size presets](evidence/ff-27-fields-slide-sizes-native-20261005/README.md)
  ([sizes-compare.md](evidence/ff-27-fields-slide-sizes-native-20261005/sizes-compare.md)).
