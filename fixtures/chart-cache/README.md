# Chart cache fixtures (Keynote round of 0.36.0)

- `missing-value.opf.json`: one area chart with an authored `null` (QC-01 minimal deck).
- `missing-value-keynote-count.pptx`: OPF 0.36.0's export of that deck with only `c:ptCount` of the value cache changed
  from 4 to 3 (the number of `c:pt` present), the form Keynote 16.0 writes on PowerPoint export. The importer rejects it
  with `invalid-chart-cache` "point index is outside its declared count"; the unedited export imports.
- `excerpts.xml`: the real value caches from Keynote's two back.pptx files and OPF's exports of the same charts.
- `two-level-*`: see the RT-02 issue.
- `two-level-categories.opf.json`: one column chart with three "Month: place" categories (RT-02 minimal deck).
- `two-level-categories-keynote-form.pptx`: OPF 0.36.0's export of that deck with each series' `c:cat/c:strRef` replaced
  by the `c:multiLvlStrRef` form Keynote 16.0 writes (inner level: two `c:pt` per `idx`, the part after ": " and the
  whole label; outer level: the part before ": "). The embedded worksheet is OPF's, unchanged (single labels in A2:A4).
  The importer rejects it with `unsupported-chart-cache`.
