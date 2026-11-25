# The three round-trip import failures of pass A (RT-01, RT-02)

Written 2026-11-25 ~17:25 UTC by the round-trip grader. Read by the layouts grader (RT-02 is the layouts-lots one).
"Back" = Keynote 16.0's own PowerPoint export of the opened deck (`$W/keynote/036/<family>/<name>/back.pptx`).
`$W` = `/Users/michael/opf-work/keynote-036`. All statements SAW unless marked **inferred**.

Summary: in both cases **Keynote writes a chart cache that is inconsistent**, and OPF 0.36.0's importer then
**rejects the whole deck** for one chart. Both are tolerable: with a two-line patch of the cache (experiments below,
run locally on copies, no Keynote) all three back.pptx files import with only the usual warnings. The cost today is
total: "edit in Keynote, send back, import into OPF" fails for any deck that contains such a chart.

| File | Error (OPF 0.36.0 `convert back.pptx`) | Charts affected in back.pptx | After patch |
|---|---|---|---|
| matrix `m-charts~default` | `import-failed` / `invalid-chart-cache`: "point index is outside its declared count" at `ppt/charts/chart1.xml#c:ser[0]/c:val/c:numRef/c:numCache/c:pt[1]@idx` | chart1 (slide 1, 2 caches), chart2 (slide 2), chart3 (slide 3): the three M13 highlight charts | imports, 16 slides (`work/m-charts~default.patched.result.json`) |
| layouts `layouts-lots~default` | `import-failed` / `unsupported-chart-cache`: "Hierarchical chart category caches cannot be flattened" | chart1 (slide 30 `chart`), chart2 (slide 31 `chart-beside`), chart3 (slide 36 `dashboard`): 5 series each | imports, 38 slides (`work/layouts-lots~default.patched.result.json`) |
| layouts `layouts-lots~native` | same as above | same three charts | imports, 38 slides |

## RT-01 m-charts~default: Keynote writes `c:ptCount` = number of points present, not the series length

What OPF 0.36.0 wrote (`$W/build/036/matrix/m-charts/default.pptx`, `ppt/charts/chart1.xml`, slide 1, M13
"one-series column, North and East highlighted"): the highlight is drawn as a **second series** with the same name
("Wait"), `c:overlap val="100"`, and both series' value caches are **sparse**: series 1 holds South and West, series 2
North and East, each with `c:ptCount val="4"`:

```xml
<c:f>Sheet1!$B$2:$B$5</c:f><c:numCache><c:formatCode>General</c:formatCode>
  <c:ptCount val="4"/><c:pt idx="1"><c:v>28</c:v></c:pt><c:pt idx="3"><c:v>31</c:v></c:pt></c:numCache>
```

What Keynote wrote back (`$W/keynote/036/matrix/m-charts~default/back.pptx`, same part):

```xml
<c:f>Sheet1!$B$2:$B$5</c:f><c:numCache>
  <c:ptCount val="2"/><c:pt idx="1"><c:v>28.000000</c:v></c:pt><c:pt idx="3"><c:v>31.000000</c:v></c:pt></c:numCache>
```

`ptCount` 2 with a point at `idx` 3: the count is the number of points present, not the number of positions (the
range `$B$2:$B$5` and the category cache both say 4). Charts 2 (bar, North highlighted: series 1 `ptCount 2` with `idx` up to 2, where OPF wrote `ptCount 3`) and 3 (line with
markers, March highlighted: series 2 `ptCount 1` with `idx 2`, where OPF wrote `ptCount 6`) are the same (`charts.json`,
diff "cache count"). The values
themselves survive (28 and 31 at the right positions).

- 0.35.1 (before): the same deck wrote one dense series (`ptCount 4`, four points) and its back.pptx imported fine
  (`$W/keynote/0351/matrix/_roundtrip.tsv`). So **OPF 0.36.0's new highlight export (M13, a second sparse series) is
  what led Keynote there**; OPF's file is valid (sparse `c:pt` under a larger `c:ptCount` is how gaps are written).
- Whose it is: **the file is valid and Keynote writes an inconsistent cache back** (Keynote), and **OPF's importer is
  stricter than it needs to be** (OPF). What PowerPoint does with such a cache: unknown (not on this Mac).
- The check that rejects it: `$W/src-036/packages/pptx/src/index.js`, function `cachedValues` (line ~2318):
  `if (count !== undefined && index >= count) invalid('point index is outside its declared count', location);`
  (the same rule for `cx:` caches is in `src/chartex.js` line ~556). The importer's README (packages/pptx/README.md
  line 179) documents "contradictory counts ... reject with `invalid-chart-cache`" as intended behavior.
- Proposed tolerance: when `idx >= ptCount`, take the extent as `max(idx + 1, cells of c:f, category count)` and add
  an info finding (`import/chart-cache-repaired`) instead of throwing. Experiment RT-01 (done, local): raising each
  short `ptCount` to the size of its `c:f` range makes the back.pptx import (`ok: true`; findings only
  `chart-option-adapted`, `shape-property-dropped`, `unsupported-table-cell-style`). Script
  `scripts/patch_import.py`, output `work/m-charts~default.patched.*`.
- Export-side alternative (inferred, not tested in Keynote): write the highlight as **one series with `c:dPt` point
  fills** (as OPF already does for pie/doughnut highlights, slides 10, 11, 13, which came back without this problem)
  instead of a second sparse series. That avoids the sparse cache and keeps one legend entry by construction; whether
  Keynote keeps per-point fills on column/bar/line needs a Keynote run.
- Minimal deck: `min/RT-01.opf.json` (one highlighted column chart with a bottom legend: the legend is what makes 0.36.0
  write the second sparse series; without it OPF writes one dense series. Validated; exported locally to
  `work/minbuild/RT-01.pptx` and checked: two `c:ser`, the second `ptCount 4` with points at idx 1 and 3. Not yet
  opened in Keynote).

## RT-02 layouts-lots~default/~native: Keynote splits category labels at ": " into a two-level cache, with duplicate indices

What OPF 0.36.0 wrote (`$W/build/036/layouts/layouts-lots/default.pptx`, `ppt/charts/chart1.xml`, slide 30): a plain
string category cache, 12 labels such as "January: northern hubs":

```xml
<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$13</c:f><c:strCache><c:ptCount val="12"/>
  <c:pt idx="0"><c:v>January: northern hubs</c:v></c:pt> ...
```

What Keynote wrote back (`$W/keynote/036/layouts/layouts-lots~default/back.pptx`, same part, every series):

```xml
<c:cat><c:multiLvlStrRef><c:f>Sheet1!$A$2:$A$13</c:f><c:multiLvlStrCache><c:ptCount val="12"/>
  <c:lvl><c:pt idx="0"><c:v>northern hubs</c:v></c:pt><c:pt idx="0"><c:v>January: northern hubs</c:v></c:pt>
         <c:pt idx="1"><c:v>coastal depots</c:v></c:pt><c:pt idx="1"><c:v>February: coastal depots</c:v></c:pt> ... (24 points)</c:lvl>
  <c:lvl><c:pt idx="0"><c:v>January</c:v></c:pt> ... <c:pt idx="11"><c:v>December</c:v></c:pt></c:lvl>
</c:multiLvlStrCache></c:multiLvlStrRef></c:cat>
```

- The inner level has **two points per index** (the part after ": " and the whole label), the outer level the part
  before ": ". That is malformed twice over (duplicate `idx` within one `c:lvl`; a hierarchy the data does not have).
  Keynote's own embedded workbook (`ppt/embeddings/Microsoft_Excel_Sheet1.xlsx`) still holds the single labels
  "January: northern hubs" ... in A2:A13, and Keynote's slide picture (`slides/slide-30.png`) draws single labels.
- Why Keynote does it: **inferred** from the data: these are the only charts in all 83 back.pptx files with ": " in
  category labels, and the only ones with `c:multiLvlStrRef` (scan: `scripts/rt_tables_charts.py`, `charts.json`). Keynote
  appears to treat "Group: item" labels as a category hierarchy on PowerPoint export. Needs the experiment below.
- Whose it is: **the file is valid and Keynote writes a malformed cache back** (Keynote); OPF's importer refuses the
  whole deck (OPF, the same tolerance question as RT-01). OPF's export did nothing unusual (plain `c:strCache`).
- The check that rejects it: `$W/src-036/packages/pptx/src/index.js`, function `cachedValues` (line ~2305):
  `if (levels.length > 1) throw new OPFPptxError('unsupported-chart-cache', 'Hierarchical chart category caches cannot be flattened ...')`.
  Had it gone on, the duplicate `idx` check a few lines below would have rejected the first level too.
- Proposed tolerance, in order of preference: (1) when the chart has an embedded workbook, read the category labels
  from the worksheet cells named by `c:f` (here A2:A13 holds the true labels); (2) otherwise join the levels outer to
  inner per index ("January / northern hubs") with a warning; (3) at worst, drop only that chart's data (keep the
  chart as a picture or an empty chart with a warning) instead of failing the deck. Experiment RT-02 (done, local):
  replacing each `c:multiLvlStrRef` with a `c:strRef` built from Keynote's own embedded worksheet makes both files
  import (`ok: true`; findings `unsupported-body-text-style`, `unsupported-image-crop`, `unsupported-table-cell-style`).
  Output `work/layouts-lots~{default,native}.patched.*`.
- Keynote experiment (for the experiments agent): open `min/RT-02.opf.json` built, export as PowerPoint, and look at
  `ppt/charts/chart1.xml`: a `c:multiLvlStrRef` with "January"/"northern hubs" confirms the ": " split; then the same
  with "January - northern hubs" and with "January northern hubs" (no colon) to show which separator triggers it.
- What an OPF user loses today: the **whole deck** (38 slides here; 16 for RT-01) fails to import after a Keynote
  round trip, not just the chart. Serious for "edit in Keynote and send back".
- Minimal deck: `min/RT-02.opf.json` (one column chart, three "Month: place" categories; validated; not yet opened).

## For the layouts grader

The layouts-lots import failure is entirely RT-02 (three chart slides 30, 31, 36). It is not a looks problem: Keynote
draws the charts with single labels (slide 30 seen). After the RT-02 patch the rest of layouts-lots imports with only
`unsupported-body-text-style`, `unsupported-image-crop` and `unsupported-table-cell-style` warnings.
