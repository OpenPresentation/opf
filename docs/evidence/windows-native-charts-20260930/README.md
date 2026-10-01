# Native PowerPoint check of the chart constructs (FF-56, 2026-09-30)

Run by the supervisor on the Windows host with desktop PowerPoint through COM, read-only, one deck per
construct, no agent automation of Office. The decks were exported by opf-pptx:

- `classic/`: the 20 classic decks of the FF-22 set (opf-pptx 0.11.2, `9f4c139` constructs), one JSON per
  deck with the shapes PowerPoint reported and `Chart.ChartType`.
- `chartex/`: the 8 chartex decks of the FF-22b set (opf-pptx `codex/ff-22b-chartex-pptx` `db116c3`, exported
  with `toPptx` option `chartex: 'native'`), one JSON per deck plus the PNG PowerPoint exported for each slide.

## Classic constructs (all opened, no repair prompt)

| Deck | `Chart.ChartType` | Expected |
| --- | ---: | --- |
| column | 51 | xlColumnClustered |
| stacked-column-3x | 52 | xlColumnStacked |
| 100pct-stacked-column-3x | 53 | xlColumnStacked100 |
| bar | 57 | xlBarClustered |
| stacked-bar-3x | 58 | xlBarStacked |
| 100pct-stacked-bar-3x | 59 | xlBarStacked100 |
| line | 4 | xlLine |
| line-with-markers | 65 | xlLineMarkers |
| stacked-line-3x | 63 | xlLineStacked |
| stacked-line-with-markers-3x | 66 | xlLineMarkersStacked |
| area | 1 | xlArea |
| stacked-area-3x | 76 | xlAreaStacked |
| 100pct-stacked-area-3x | 77 | xlAreaStacked100 |
| pie | 5 | xlPie |
| doughnut | -4120 | xlDoughnut |
| scatter (`scatterStyle` marker) | -4169 | xlXYScatter |
| scatter A/B (`scatterStyle` lineMarker) | -4169 | xlXYScatter (the catalog keeps `marker`) |
| radar | -4151 | xlRadar |
| radar-with-markers | 81 | xlRadarMarkers |
| filled-radar | 82 | xlRadarFilled |

## Chartex constructs (all opened, no repair prompt)

| Deck | `Chart.ChartType` | Result |
| --- | ---: | --- |
| treemap | 117 | native (xlTreemap) |
| histogram (lone value column, `cx:binning`) | 118 | native (xlHistogram) |
| histogram-by-category (`cx:aggregation`) | 118 | native |
| pareto (`clusteredColumn` + owned `paretoLine`) | 122 | native (xlPareto) |
| box-and-whisker | 121 | native (xlBoxwhisker) |
| waterfall | 119 | native (xlWaterfall) |
| funnel | 123 | native (xlFunnel) |
| world (`regionMap`, `Requires="cx5"`, `cx:geography` without `geoCache`) | 51 | PowerPoint took the `mc:Fallback` clustered column chart; the regionMap part was not accepted |

Visual finding from the exported PNGs: chartex text (data labels, axis and category labels, legend) was drawn
in the chart style's theme grey and the box-and-whisker whiskers, medians and mean markers in black on the
dark navy theme, while the classic charts use the deck's label colour. This drives the theme-aware chartex
text and line colours in opf-pptx#108 and the `chartex: 'auto'` default (native for the six confirmed
constructs, clustered column fallback for `world`). A recheck deck set (six constructs with the colour fix
plus eleven regionMap variants: `Requires` cx3/cx4/cx6/cx8, no `cx:layoutPr`, projection attributes, empty
`geoCache`, `val` dimension, legend and labels) was prepared for the next supervisor run.

This evidence establishes native behaviour for these decks on this host and PowerPoint build only. It is
not a validation of the parts against the Open XML SDK schemas, and it says nothing about the live
pptx.gallery or installed packages.
