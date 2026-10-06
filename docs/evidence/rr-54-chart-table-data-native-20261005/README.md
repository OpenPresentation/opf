# RR-54: native PowerPoint check of chart and table data (2026-10-05)

Item: RR-54 (chart and table data: strict numbers, number formats, datasets, `chart.mapping`), export and import in
[opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171) on core [opf#376](https://github.com/OpenPresentation/opf/pull/376).
The contract is `docs/chart-table-data.md` on opf#376 (sections "Number formats" and "Native PowerPoint checks").

- **Host:** Windows 11, PowerPoint 365 (16.0 build 20430), en-US number settings, run on 2026-10-05.
- **Builds:** opf-pptx#171 head `f0ea480` on core opf#376 head `11317237` (core package 0.12.2 linked into opf-pptx as
  `link-ecosystem` does; opf-render 0.12.0 from npm), Node 24.21.0. The three source decks were rebuilt here byte-identically, and
  their offline re-imports equal the given `.reimported.opf.json`. [decks.json](decks.json) lists the decks with sha256.
- **Decks:** `rr54-formats` (column, line, scatter, pie, treemap, strict numbers), `rr54-datasets` (column, line with `mapping`, a
  dataset table, the doughnut, radar, box-and-whisker), `rr54-tables` (a formatted table and a bar chart with `source`), and the
  supplementary `rr54-spellings` (sha256 `17efc818…`, built with the same builds and options) for the `0.##`, `#` and `#,###`
  spellings the contract lists as a wanted native check and the source decks do not contain.
- **Protocol:** one hidden child `powershell.exe` per deck (per chart for Edit Data), 90 s deadline, no retries; every attempt is a
  new stamp and is kept. Reads open the deck read-only (`Presentations.Open(path, -1, 0, -1)`, with a window for `ChartData`); the
  save check opens it read-only and calls `SaveCopyAs` to a separate folder, then re-imports the copy offline. Nothing was saved over
  a source, PowerPoint and Excel were never quit, and the source sha256 were unchanged after every attempt.
- **Not committed:** decks, saved copies, PNGs and the per-deck read-outs. The combined comparison, the run log of every attempt, the
  deck list and the diagnosis logs are.

## Result: 13 PASS, 3 FAIL

| Deck | C1 display | C2 Edit Data | C3 open + tags | C4 save copy |
| --- | --- | --- | --- | --- |
| rr54-formats | PASS | PASS | PASS | **FAIL** |
| rr54-datasets | PASS | PASS | PASS | **FAIL** |
| rr54-tables | PASS | PASS | PASS | PASS |
| rr54-spellings (supplementary) | PASS | **FAIL** | PASS | PASS |

[compare.md](compare.md) and [compare.json](compare.json) are the set's combined report: C1 from attempt `20261006T022119Z`, C2
from `20261006T022136Z`, C3 and C4 from `20261006T021315Z`.

1. **C1 display: PASS.** Data labels and axis codes read as documented: `$12.4`, `31%`, `1,200 units`, `1.25%`, `$1,200`, and the
   pie label `EMEA, 33%` (the package separator). The spellings deck shows the documented Excel forms, which differ from core's text:
   `0.##` gives `5.`, `0.`, `-5.`, `12.` and `2.35`; `#` gives an empty label for 0 and 0.4; `#,###` gives an empty label for 0 and
   `5,679` for 5678.5. `0.0#` and `#,##0` agree with core. Tables carry core's text (`5`, `0`). COM does not expose chartex
   (treemap, box-and-whisker) labels or axis codes; those rows are INFO, to be checked on the slide PNGs. Axis tick texts cannot be
   read through COM either and are derived from the native scale as INFO.
2. **C2 Edit Data: PASS on formats, datasets and tables; FAIL on spellings.** No repair prompt; the workbook cells carry the column
   formats. On the spellings deck **zero values are missing from the embedded workbook**: the sheet XML has `<c r="B5" s="1"/>`
   with no `<v>`, while the chart cache has `<c:v>0</c:v>`. Excel's Edit Data shows blanks (`Value2` null) for B5 "Optional
   decimals", B3 "Hash", B2 "Grouped hash" and B3 / C3 on slide 4, and a refresh from the workbook would turn those zeros into gaps.
   Offline, the same drop happens with opf-pptx `main` (`7c93a1b`): see "Zero cells" below.
3. **C3 read-only open and tags: PASS.** No repair prompt; every expected frame `custDataLst` tag (`OPF_DATA_V1`; the strict-numbers chart has none) and the presentation
   tag (`OPF_DOCUMENT_V1`) read back with the exported length and sha256.
4. **C4 save a copy: PASS on tables and spellings; FAIL on formats and datasets.** The saved copies re-import with
   `chart-data-provenance-changed`: the dataset reference, `fields` and `mapping` are lost (the doughnut included), and the scatter
   point names `a`, `b`, `c` come back as `1`, `2`, `3` (the cache fallback has no point names).

## C4 root cause (offline diagnosis of attempt 20261006T021315Z)

- Every tag value survives the save byte for byte (formats 18 / 18, datasets 23 / 23, tables 7 / 7, spellings 19 / 19).
- Every changed chart part differs only in its format codes. PowerPoint re-spells `c:formatCode` on save: `$#,##0.0` becomes
  `\$#,##0.0`, `$#,##0` becomes `\$#,##0`, `#,##0 "units"` becomes `#,##0\ "units"`, `0.0 "kg"` becomes `0.0\ "kg"`. The float
  spellings it writes (`18.100000000000001`) are already canonicalized by the evidence hash.
- opf-pptx's `chartEvidence` hashes format codes verbatim, so the cache looks changed and the provenance record is rejected.
- Hashing each code in its canonical form (core `numberFormatFromExcel`, else backslash escapes and quotes removed) makes all 18
  chart parts of the four decks agree. The fix belongs in opf-pptx#171.

## Zero cells (C2)

The embedded workbook is written by the vendored PptxGenJS. In the category branch (bar, column, line, area, pie, doughnut, radar)
and the bubble branch the value cell is `<v>${values[idx] || ''}</v>`, so 0 becomes an empty `<v></v>`, which opf-pptx then rewrites
to a blank cell. Only the scatter branch keeps 0. An offline export of a column chart with the values 5, 0, 3 gives the cache
`5,0,3` and the sheet cells `B2=5`, `B3` (no value), `B4=3` with both opf-pptx `main` `7c93a1b` and `f0ea480`; a scatter chart
keeps `B3=0`. The bug therefore predates RR-54; the RR-54 decks expose it because they set column formats on the cells.

## PowerPoint COM warning: do not read `Series.Formula`

On PowerPoint 16.0.20430, reading `Series.Formula` returns an empty string after about 3 s and then PowerPoint crashes (chart.dll,
0xc0000005); the next COM call fails with "The RPC server is unavailable". The per-property bisect in [diag/](diag/) pins it on
`Series.Formula`, and two controls reproduce it: an RR-17 deck exported by opf-pptx `main`, and a chart PowerPoint inserted itself
(`Shapes.AddChart2` in a new, unsaved presentation). It is a PowerPoint COM bug, not a deck defect. The reader no longer reads it.
After the crashes only the set's own recovered decks were closed, unsaved (sha256 unchanged), and safe mode was declined once.

## Attempts

All are in [run.json](run.json), each with its note:

| Attempt | What ran | Outcome |
| --- | --- | --- |
| `20261006T020213Z` | reads and save copies | PowerPoint crashed on `Series.Formula` (rr54-formats slide 1); later children could not attach. Not used. |
| diag `020344Z`, `020414Z`, `020506Z`, `020539Z` | per-property bisect and two controls | crash pinned on `Series.Formula` (above) |
| `20261006T020606Z` | reader without `Formula`; Edit Data for all charts in one child | slide 2 `ChartData.Activate` hung behind "To insert a chart, you must first close any open dialog boxes or cancel editing mode in Microsoft Excel."; the child timed out. Fixed by one chart per child. Not used. |
| `20261006T021315Z` | `-SkipEditData`: reads and save copies | C3 PASS, C4 results. Its C1 failures were a reader bug (the `DataLabels()` collection unrolled by the PowerShell pipeline). |
| `20261006T022119Z` | reads with the fixed reader | C1 PASS on all 4 decks |
| `20261006T022136Z` | Edit Data, one child per chart (16) | C2: PASS on formats, datasets, tables; FAIL on spellings |

## Files

- [compare.md](compare.md), [compare.json](compare.json): the combined report, unchanged except that host paths would be replaced by
  `<set>` (none occurred).
- [run.json](run.json): host, every attempt's run record (PIDs, exit codes, timeouts, runner and worker sha256, Excel processes
  before and after) and the four diagnosis runs.
- [decks.json](decks.json): the builds, and per deck file name, bytes, sha256, the supplementary flag and the sha256 of the copy
  PowerPoint saved in `20261006T021315Z`.
- [diag/](diag/): the per-property logs and error output of the four diagnosis runs, host paths replaced by `<set>`.
