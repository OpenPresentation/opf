# v0.33.0 qualification: PowerPoint for Windows

RR-105. The corpus, manifest and runner are in `scripts/native-acceptance/qualification/` ([opf#1085](https://github.com/OpenPresentation/opf/pull/1085)); this page records each
pass on Windows. The Mac (PowerPoint for Mac, Keynote) and Linux (LibreOffice) results are recorded beside it.

## Pass 1: main before the release candidate

- **Build:** the corpus branch `65b4f2aac` (main `ec25bc9b2` plus the corpus), OPF 0.32.1, Node v26.4.0, win32-x64.
- **App:** PowerPoint for Microsoft 365 16.0.20527.20112 (build 20527), Windows 10 Home 25H2 build 26200.9711, en-US. COM only, no UI control.
- **Run:** `run-powerpoint-windows.ps1` then `evaluate.mjs`, on 2026-11-07. 25 PPTX files of 20 decks, 256 slides.
- **Verdict:** no release blocker. Every file opens without a repair prompt; every slide renders; no text runs out of its frame or asks
  to shrink (except one opt-in `--body-text native` case); live SmartArt, native charts and tables, glued connectors, Header and Footer
  fields and the import of a PowerPoint-saved copy all pass. Findings are filed as issues; none is a regression in a supported feature.

Automatic checks: opens, slides, overflow (text bound against its frame, 1.5 pt), shrink autofit, SmartArt (layout, nodes, a node
edit keeps every size), native charts, native tables (a cell edit), glued connectors, Header and Footer placeholders with a slide move
that renumbers live fields, and the round trip. Visual: the reviewer compared OPF's preview with PowerPoint's export of every slide.

| Feature | What | File, slides | Automatic | Visual | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SH-02 | Shape blocks: presets, adjust values, custom paths, fills and strokes, text in shapes | shapes all | pass | pass | pass | text in the flipped right triangle sits mirrored ([opf#1093](https://github.com/OpenPresentation/opf/issues/1093)) |
| SH-02-native | Shape blocks are native presets and freeforms (slide 8 is masked pictures) | shapes s1,2,3,4,5,6,7 | pass | - | pass |  |
| SH-03 | Shape effects: shadow, inner shadow, glow, soft edge, reflection, blur | shape-effects all | pass | pass | pass |  |
| SH-04 | Overlay shapes and glued connectors | shape-overlays s2,3,4,5 | pass | pass | pass |  |
| SH-04-rtl | Overlay shapes right to left | shape-overlays-rtl all | pass | pass | pass |  |
| SH-05 | PPTX import of shapes after a PowerPoint save | shapes all | pass | - | pass |  |
| SH-07 | Native Mermaid diagrams: shapes, text and exact edge paths, read back as diagrams | diagrams s1,6,7 | pass | pass | pass |  |
| SH-07-connectors | Straight diagram edges without arrowheads are native connectors glued to their nodes | diagram-connectors all | pass | pass | pass | two of the three tree edges route as curves, so they are exact paths, not connectors (by design) |
| SH-07-families | Every Mermaid family as shapes | diagrams all | pass | pass | pass |  |
| SH-07-picture | Diagrams as pictures (--diagrams picture) | diagrams~picture all | pass | pass | pass |  |
| SH-07-md | Mermaid in OPF Markdown | diagrams-markdown all | pass | pass | pass |  |
| SH-09 | Live SmartArt: Basic Pyramid and Basic Matrix; a PowerPoint-saved copy imports back as the six arrangement layouts | smartart s1,3 | pass | pass | pass |  |
| SH-17 | Live SmartArt: Basic Chevron Process, Basic Process, Vertical Process | smartart s7,9,11 | pass | pass | pass |  |
| SH-18 | Live SmartArt: Basic Cycle | smartart s5 | pass | pass | pass |  |
| SH-19 | Live SmartArt on OPF's own layout definitions (stepped pyramid, card grid, wrapped chevrons and flows, columns) | smartart s13,14,15,16,17 | pass | pass | pass |  |
| SH-19-native | OPF's designs outside the live domain stay native shapes | smartart s2,4,6,8,10,12 | pass | pass | pass |  |
| SH-16 | SmartArt picture fallback (mc:AlternateContent) | smartart s1,3,5,7,9,11 | not run | - | not run | PowerPoint takes the mc:Choice (live SmartArt, checked by SH-09/17/18); the picture fallback is graded in Keynote and LibreOffice. |
| SH-smartart-shapes | --smart-art shapes writes native shapes everywhere | smartart~shapes all | pass | pass | pass |  |
| SH-smartart-rtl | Arrangements right to left (native shapes by design) | smartart-arabic all | pass | pass | pass |  |
| SH-smartart-cjk | Arrangements in Japanese (native shapes by design) | smartart-japanese all | pass | pass | pass |  |
| LH-158 | Picture bands: heading placement and panel over picture backgrounds | layout-harvest s1,11 | pass | pass | pass |  |
| LH-09 | Statements at display size under the accent rule | layout-harvest s2 | pass | pass | pass |  |
| LH-164 | Message surface (accent slide for one display message) | layout-harvest s2,4 | pass | pass | pass |  |
| LH-14 | Icons on list entries, metrics and groups (native ellipse + editable glyph) | layout-harvest s3,6,7 | pass | pass | pass |  |
| LH-165 | Icon cards and text tiles | layout-harvest s5,8 | pass | pass | pass |  |
| LH-132 | Portraits at card size; testimonial portrait | layout-harvest s9,10 | pass | pass | pass |  |
| LH-168 | Steppers (badges on a connector) | layout-harvest s12 | pass | pass | pass | false numbering warning fixed in [opf#1086](https://github.com/OpenPresentation/opf/pull/1086) |
| LH-169 | Figure rows and the emphasis band | layout-harvest s13 | pass | pass | pass |  |
| LH-63 | Run-in heads and bold labels | layout-harvest s14 | pass | pass | pass |  |
| LH-75 | Table and note side by side | layout-harvest s15 | pass | pass | pass |  |
| LH-18 | Shared heading tracks | layout-harvest s16 | pass | pass | pass |  |
| LH-160 | Histogram and Pareto labels and bins | layout-harvest s17,18 | pass | pass | pass | bin-edge labels round differently; Pareto axis auto-scales differently ([opf#1092](https://github.com/OpenPresentation/opf/issues/1092)) |
| LH-153 | Thousands grouping on waterfall labels and axes | layout-harvest s19 | pass | pass | pass | total-bar labels sit inside the bar top in PowerPoint, above it in the preview |
| LH-155 | Closing takes the cover treatment | layout-harvest s20 | pass | pass | pass |  |
| LH-native-body | Layout harvest slides with --body-text native | layout-harvest~native-body all | pass | pass | pass | the statement title re-wraps at a different word (native paragraphs re-wrap by design) |
| LH-sampler | Every gallery layout (waves 7 and 8 integration, LH-156 small fixes) | layout-sampler all | pass | pass | pass |  |
| LH-sampler-charts | Gallery chart and table layouts stay native | layout-sampler s22,23 | pass | pass | pass | PowerPoint lays native charts out itself (plot area within a few percent) |
| LH-sampler-tables | Gallery table layouts stay native and editable | layout-sampler s24,25 | pass | pass | pass |  |
| LH-sampler-native-body | Every gallery layout with --body-text native | layout-sampler~native-body all | fail | fail | **fail** | slide 41: a card's text re-wraps to two lines and overruns its card ([opf#1089](https://github.com/OpenPresentation/opf/issues/1089)); noOverflow: s41 "Share results with both teams." bottom |
| RR-102 | Header & Footer: footer, live slide number and date placeholders; a slide's own footer (number only) and a hidden footer | footers s1,2,3,4 | pass | pass | pass |  |
| RR-102-static | --slide-numbers static | footers~static all | pass | pass | pass |  |
| RR-102-logos | Header and footer zones with logos | header-footer-logo-set all | pass | pass | pass |  |
| RR-103 | Chart types export unchanged (no vendor names) | chart-type-sampler all | pass | pass | pass | PowerPoint lays native charts out itself (plot area within a few percent) |
| tables | Native tables stay editable | table-and-code s1 | pass | pass | pass |  |
| example-academy | New example: Data Story Academy corporate programs | data-story-academy all | pass | fail | **fail** | slide 3: the background's annotation ring misses the native bar ([opf#1090](https://github.com/OpenPresentation/opf/issues/1090)); slides 1, 5, 6, 16: titles set in small runs sit ~22 pt higher ([opf#1091](https://github.com/OpenPresentation/opf/issues/1091), also in 0.32.1) |
| example-icons | Gallery example with icons | compliance-readiness-review all | pass | pass | pass |  |
| feature-tour | Full feature tour (regression) | full-feature-tour all | pass | pass | pass |  |
| RR-104 | Autofit cleanup: no shrink-on-overflow anywhere | layout-sampler all | pass | - | pass (pre-batch) | batch not merged yet: graded on the release candidate |
| LH-184 | Columns | columns all | pass | pass | pass (pre-batch) | batch not merged yet: graded on the release candidate |
| LH-185 | Diagram direction | diagrams all | pass | pass | pass (pre-batch) | batch not merged yet: graded on the release candidate |
| LH-186 | Layout before shrink | layout-sampler all | pass | pass | pass (pre-batch) | batch not merged yet: graded on the release candidate |
| SH-11 | Small shape text in PowerPoint | shapes all | pass | pass | pass (pre-batch) | batch not merged yet: graded on the release candidate |
| mcp-viewer | MCP deck viewer (show_deck) | full-feature-tour all | not run | - | not run | Not a PowerPoint feature; covered by the MCP package tests. |
| editor | Editor: shapes, overlays, icons, surface and run-in editing | full-feature-tour all | not run | - | not run | Editor features; their PPTX output is covered by the shape and icon decks. |
| ui-only | Accessibility Checker, Edit Data, adjust handles, Change Shape | full-feature-tour all | not run | - | not run | Not run: needs PowerPoint UI control, which the owner declined. |

### Findings

| Issue | Severity | Finding |
| --- | --- | --- |
| [opf#1086](https://github.com/OpenPresentation/opf/pull/1086) | low (fixed) | A stepper's numbered steps reported `numbering-unsupported-core` although their badges carry the numbers |
| [opf#1089](https://github.com/OpenPresentation/opf/issues/1089) | medium, opt-in | `--body-text native`: a card's one-line text re-wraps to two lines in PowerPoint and overruns its card |
| [opf#1090](https://github.com/OpenPresentation/opf/issues/1090) | medium, example | data-story-academy slide 3: the annotation ring in the background misses the bar PowerPoint lays out |
| [opf#1091](https://github.com/OpenPresentation/opf/issues/1091) | medium, not a regression | A title set in runs smaller than the title size draws ~22 pt higher in PowerPoint (same XML in 0.32.1) |
| [opf#1092](https://github.com/OpenPresentation/opf/issues/1092) | low | Histogram bin-edge labels round differently; the Pareto value axis auto-scales differently |
| [opf#1093](https://github.com/OpenPresentation/opf/issues/1093) | low | The text of a flipped asymmetric preset is mirrored in PowerPoint, not in the preview |
| [opf#1094](https://github.com/OpenPresentation/opf/issues/1094) | low, validator | `opf/reading-order` warns on a row of icon groups drawn as cards |

### Not run

- The Accessibility Checker, Edit Data (chart data in Excel), dragging adjust handles and Change Shape: they need PowerPoint's UI,
  which the owner declined (COM only).
- The SmartArt picture fallback (SH-16): PowerPoint takes the SmartArt choice; the fallback is graded in Keynote and LibreOffice.
- The never-shrink batch (RR-104, LH-184, LH-185, LH-186, SH-11) had not merged; its rows ran on the existing decks and are graded
  again on the release candidate. The MCP viewer and the editor features have no PowerPoint surface (their PPTX output is covered).

### Files

| PPTX | Source | Source SHA-256 | PPTX SHA-256 |
| --- | --- | --- | --- |
| smartart.pptx | `scripts/native-acceptance/qualification/decks/smartart.opf.json` | a55533cf9ab8 | 703e5f6f8559 |
| smartart~shapes.pptx | `scripts/native-acceptance/qualification/decks/smartart.opf.json` | a55533cf9ab8 | eb5cac325a72 |
| smartart-arabic.pptx | `scripts/native-acceptance/qualification/decks/smartart-arabic.opf.json` | f9ece76f6c2d | 226487afbe17 |
| smartart-japanese.pptx | `scripts/native-acceptance/qualification/decks/smartart-japanese.opf.json` | 9d5348237ca2 | 6a499b0e22da |
| layout-harvest.pptx | `scripts/native-acceptance/qualification/decks/layout-harvest.opf.json` | 59f051cb02d8 | 4bb3fd044a55 |
| layout-harvest~native-body.pptx | `scripts/native-acceptance/qualification/decks/layout-harvest.opf.json` | 59f051cb02d8 | c766fc5ab66f |
| footers.pptx | `scripts/native-acceptance/qualification/decks/footers.opf.json` | c46b58a09d03 | 6d68b8e5f397 |
| footers~static.pptx | `scripts/native-acceptance/qualification/decks/footers.opf.json` | c46b58a09d03 | ae65bde72cac |
| shapes.pptx | `examples/technical/shapes.opf.json` | bd1d459443c0 | e7ee8972a4d9 |
| shape-effects.pptx | `examples/technical/shape-effects.opf.json` | 9cf8e779c7a5 | 020154f31555 |
| shape-overlays.pptx | `examples/technical/shape-overlays.opf.json` | 0d677961201c | 4a4b1c986fc0 |
| shape-overlays-rtl.pptx | `examples/technical/shape-overlays-rtl.opf.json` | f8f2927f8446 | 5161b21283c8 |
| diagrams.pptx | `examples/technical/diagrams.opf.json` | 005ab6d345c5 | 008846ea3656 |
| diagrams~picture.pptx | `examples/technical/diagrams.opf.json` | 005ab6d345c5 | 0f5db2a96672 |
| diagrams-markdown.pptx | `examples/markdown/diagrams.opf.md` | 8693d80c8710 | 4dd64fea5089 |
| diagram-connectors.pptx | `scripts/native-acceptance/qualification/decks/diagram-connectors.opf.json` | f6aa89aab704 | 00004bdc846b |
| layout-sampler.pptx | `examples/technical/layout-sampler.opf.json` | e4a6bca4405f | cc619b90148e |
| layout-sampler~native-body.pptx | `examples/technical/layout-sampler.opf.json` | e4a6bca4405f | 141359ebccce |
| chart-type-sampler.pptx | `examples/technical/chart-type-sampler.opf.json` | bc402b123834 | 5d1cea0511e8 |
| table-and-code.pptx | `examples/technical/table-and-code.opf.json` | 29a4df6caf6f | f54bd7b5486c |
| columns.pptx | `examples/technical/columns.opf.json` | 0a45dfa24401 | 22ef3ea8bb35 |
| header-footer-logo-set.pptx | `examples/technical/header-footer-logo-set.opf.json` | b54cf1829dd3 | 7bcab7685cf1 |
| full-feature-tour.pptx | `examples/technical/full-feature-tour.opf.json` | 212e5aeacf69 | a60d12bf8ba3 |
| data-story-academy.pptx | `examples/gallery/design-and-media/data-story-academy-corporate-programs.opf.json` | 7054f2770216 | 2d1b767695ba |
| compliance-readiness-review.pptx | `examples/gallery/business-functions/compliance-readiness-review.opf.json` | 6f944fc3a7b4 | 8977292ccfbc |

Large outputs (PNGs, sheets, probes, saved copies) stay outside the repository; rerun the corpus to reproduce them.

## Pass 2: the release candidate

Pending: the supervisor names the candidate commit once the never-shrink batch and the nightly fixes merge.
