# RR-105: explicit bar references with authored options

Source baseline: reviewed integration `519dd89a80904907a3d0120f90b732065d99a0b1`. Fresh isolated branch `codex/rr-105-active-bar-references`, checkout `C:/opf-work/bar-refs`. This is a product repair; the folded PR1259 qualifier and suite03 producer/consumer/output roots remain immutable.

## Current result

The actual six-package consumer069 failed reference suite03: the bar explicitly requested value20, label `Target 20`, width2/orange/dashed, but emitted neither line nor label. Its value axis was already 0..25/step5, with no diagnostics or clipping. The original failed generation and separate single SVG diagnosis are preserved on NEVER MERGE evidence commit `bb90c7207839bf3aa107ef59875ecb6f7b418781`, [suite03 packet](https://github.com/OpenPresentation/opf/tree/bb90c7207839bf3aa107ef59875ecb6f7b418781/docs/handoff/2026-11-10/rr105-reference-suite03).

The cause is shared composition: `horizontalBarPlot` correctly refuses active chart options, and explicit reference placement previously had no fallback. The fix extends `chartPlotInset` with the actual horizontal plot geometry after its shared header, legend and axis-title reservations. It reserves the category gutter, formatted tick ends and bottom tick row. Composition uses this only when explicit references need a plot and the legacy bar helper supplies none. Existing renderer/PPTX integration already consumes that one authoritative plot.

Seven initial genuine regressions failed on unmodified519; core geometry, public SVG, native XML and public import now pass after the narrow fix. A further default/simple-options control is included. Eight no-reference decks (default; all five legend positions; labels/titles; negative percentages/RTL) produced sixteen actual SVG/PPTX files byte identical before/after. Three representative prepared-font PNG/SVG/PPTX outputs have been inspected: captured bar20, percentage/negative/zero-width label, and multi-series/two-reference/left-legend/title bands. Their imports contain 1/2/2 references and zero duplicate ordinary shapes. Final required mapped checks and source review are recorded in the qualification append once terminal; native acceptance and fresh consumer suite04 remain owed.

## Vetoable decisions

1. Preserve the legacy helper's option guard. Reuse the common active legend/header/title reservations and add horizontal geometry there, rather than guessing a legacy plot or changing every no-reference bar.
2. Leave import normalization unchanged. Existing native import elides redundant one-series `legend:none` and `dataLabels:false` defaults, including full provenance. Tests prove those authored options in actual native output and prove explicit reference/data restoration separately; this repair does not claim raw default-spelling preservation.
3. Keep all actual suite03 failure/assertion/output bytes. No fixture/qualifier waiver, local golden regeneration, tolerance change, schema change, unrelated importer change, Office or release.

## Evidence scope and known setup attempts

The original baseline logs remain literal. The first new percentage fixture incorrectly put `formats` beside data columns; it was rejected and corrected to an existing formatted column before the genuine final baseline pass. Initial new assertions assumed unnormalized reference defaults, a width-independent dotted dash array and a vendor `sysDot` spelling; these were corrected to established semantics, with original attempts retained. An initial representative review deck copied duplicate slide IDs; validation rejected it, and separately authored review slides received unique IDs before rendering. No original witness was modified. One PowerShell quoting refusal occurred before any command mutation and was corrected with a literal script.

No-reference byte comparisons and representative output are local qualification of this source, not physical Office or current-consumer acceptance. The fixed overlay limitations remain: independent chart/data/axis edits in PowerPoint can detach ordinary line/text overlays; edited/uncertain bindings remain visible ordinary shapes on import.
