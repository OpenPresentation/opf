# v0.33.0 qualification: LibreOffice (experimental)

RR-106, [opf#926](https://github.com/OpenPresentation/opf/issues/926). LibreOffice is experimental and does not block v0.33.0;
PowerPoint stays the primary target. Method, tolerances and the defect rules: [docs/libreoffice.md](../../libreoffice.md).

## Environment

| | |
| --- | --- |
| LibreOffice | 26.8.2.2, build `9dea406ab7695df6325b11b0e19fdca8db4b7276` (TDF Debian build, SHA-256 `8290c8f4…a476`) |
| OS and image | Ubuntu 24.04.5 LTS, `mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd…` |
| fontconfig, Node | 2.15.0, 24.22.2 |
| Engines | the 0.33.0 candidate checkout (packages at 0.32.1 before the release bump), commit in each run's `results.json` |
| Font profile `opf` (decides) | 177 font files, digest `47a388d3bb7f`: the image's fonts, LibreOffice's bundled fonts, 127 OPF preview fonts with the script faces, 98 font-policy aliases (Aptos → Intos, Aptos Display → Intos Display, Calibri → Carlito, …) |
| Font profile `stock` (information) | 50 font files, digest `b313f1fb0f46`: the image and LibreOffice only |
| Corpus | 41 cases from `scripts/libreoffice/corpus.mjs` plus the 25 files of the release qualification build (`scripts/native-acceptance/qualification`, RR-105) |

## Results

By group, cases that pass every defect check (opens, slide count, every word on the page and in LibreOffice's re-export, explicit
breaks, text inside its box and the slide, no ink past the slide):

| Group | Cases | `opf` profile | `stock` profile | Control (OPF's own PDF) |
| --- | --- | --- | --- | --- |
| Cover and text | 2 | 2 | 1 | 2 |
| Long and nested lists | 1 | 1 | 0 | 1 |
| Images and crops | 1 | 1 | 0 | 1 |
| Tables | 2 | 2 | 2 | 2 |
| Common charts (column, bar, line, pie, stacked, area, scatter; the chartex types with `charts: "picture"`) | 2 | 2 | 1 | 2 |
| opf#925 (three rebuilt exports; the original artifact) | 3 + 1 | 3 + 1 | 2 + 0 | 3 (the artifact has no source) |
| Shared native-acceptance decks | 19 | 19 | 15 | 19 |
| Release qualification files (RR-105) | 23 | 21 | 10 | 23 |
| **Baseline total** | **53** | **51** | **31** | **53** |
| Advanced: chartex charts with `charts: "auto"`, live SmartArt | 12 | 4 (the rest are known differences) | 3 | 12 |

Run: [Actions run 42408361449](https://github.com/OpenPresentation/opf/actions/runs/42408361449) on commit `0d104d26` (artifact
`libreoffice-qualification`: `results.json`, `summary.md`, every PPTX, LibreOffice's PDFs and re-exports, side-by-side sheets).
The two baseline failures are `layout-harvest` and its native-body variant, both for the chartex charts on slides 18 and 19.

Release qualification features (manifest of RR-105, graded on the same files the PowerPoint and Keynote streams open): **47 of 52
graded features pass** (three more are UI-only and not graded); the full table is in the run's job summary and `results.json`. The
five that do not:

| Feature | Result | Why |
| --- | --- | --- |
| LH-153, LH-160, LH-native-body | fail | Their slides use chartex chart types (waterfall, funnel, box) that LibreOffice 26.8 reads but cannot draw: it shows "One or more chart types are unsupported in this version of LibreOffice" in place of the chart. The same decks pass with `charts: "picture"`. |
| RR-103 (chart-type sampler) | known difference | The same, for the advanced chart sampler. |
| SH-04 (shape overlays) | fail | Text, shapes and connectors are right; OPF's import of LibreOffice's re-saved copy fails with a duplicate payload id: an import defect, [opf#1103](https://github.com/OpenPresentation/opf/issues/1103). |

Not graded in LibreOffice: `smartArt` (LibreOffice draws SmartArt from the file's drawing part, as graphics, and has no layout of its
own; SH-16's fallback is drawn and is for review on the sheets) and `footer` (the Header and Footer dialog). `visual` is a number for
a reviewer, never a verdict.

## Findings

1. **Text fits in the documented profile.** With OPF's preview fonts and the font-policy aliases, every baseline case keeps every
   word inside its box and on the slide, and LibreOffice's own re-export keeps every word and explicit break. That includes long and
   nested lists, wrapped titles, two-column prose, tables, the common charts, diagrams, shapes, footers and the gallery examples.
2. **Without OPF's fonts, measured lines run past their boxes** (opf#925). A deck in Aptos (the default) is drawn in LibreOffice's
   Noto Sans, about 10% wider, and every precomputed `wrap="none"` line that nearly fills its box runs past it, up to the slide
   edge, where LibreOffice cuts it off. `typefaces: "safe"` and `bodyText: "native"` both avoid it (the rebuilt opf#925 deck passes
   in the stock profile with either). Diagnosis with measurements: [opf#925](https://github.com/OpenPresentation/opf/issues/925).
3. **Chartex charts.** LibreOffice 26.8 reads the chartex part, not OPF's fallback: it draws the single-series histogram itself
   (with its own bins) and shows its "unsupported chart type" placeholder for treemap, box and whisker, waterfall, funnel and the
   category histogram. Multi-series Pareto and the world map, which `charts: "auto"` already writes as clustered columns, are
   drawn. `charts: "picture"` (clustered columns for every chartex type) is drawn completely.
4. **Documented differences** in the `opf` profile: charts in LibreOffice's chart style; weight-named families (Roboto Medium,
   SemiBold, ExtraBold) drawn as Roboto Bold; SmartArt and Arabic text drawn correctly but missing from or fragmented in the PDF
   text layer.

## Recommended public wording

"Opening OPF's PPTX export in LibreOffice Impress is experimental. OPF checks it every night in LibreOffice 26.8 on Linux: with OPF's
open fonts installed (or a deck exported with `typefaces: "safe"`), text, lists, images, tables and the common charts open with all
their text, inside their boxes. Treemap, waterfall, funnel and box-and-whisker charts need `charts: "picture"` for LibreOffice."

No support badge, no parity claim, and the word "experimental" stays until the owner promotes the baseline. Promotion would mean
`--fail-on-defect` on the nightly leg and a decision on what blocks a release (docs/libreoffice.md, "Running it").

## Follow-ups

- [opf#1103](https://github.com/OpenPresentation/opf/issues/1103): import of a LibreOffice-saved copy (duplicate payload id).
- Whether the export should prefer `charts: "picture"` for the chartex types LibreOffice cannot draw, or say so in a finding; today
  `charts: "auto"` follows what PowerPoint draws natively.
- Whether to ship the font-policy fontconfig aliases with `opf-preview-fonts` so a Linux user gets the documented profile in one
  command.
