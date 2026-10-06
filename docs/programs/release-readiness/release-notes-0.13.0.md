# Release-readiness note: the 0.13 release train

Status: **draft** of 2026-10-06 for the owner (RR-20), written before the train runs. Internal repository documentation:
nothing here is shown on pptx.gallery, openpresentation.org or pptx.dev, and it states no support or parity percentages
(owner decision 2026-09-30; see the [README](README.md) invariants). Tracker: [burndown.md](burndown.md). The registry
table below is filled in when the train has published and verified each version.

## What the owner needs to know

- The train is a lockstep **minor** release: core `@openpresentation/opf` **0.13.0**, `opf-render` **0.13.0**, `opf-pptx`
  **0.13.0**, `opf-editor` **0.12.0** and the CLI **0.11.0** (bundles core 0.13.0), published in that dependency order by
  `scripts/release-train.mjs`. Every sibling raises its core floor (and its optional renderer peer floor; the CLI its
  renderer and PPTX peers) to the new versions.
- **Every PPTX export changes** (opf-pptx): the vendored engine moves from PptxGenJS 4.0.1 (unmaintained) to its
  maintained MIT fork pptxgenjs-plus 4.3.4. Slide geometry, text, fonts, themes, tables, fields, notes text and the
  embedded workbooks' contents are unchanged; package structure and serialization change (summary below). The Windows
  PowerPoint a/b check passed 20 of 20.
- **Chart data has three behaviour changes** (RR-54, all four packages):
  1. A chart cell that holds text which is not a plain decimal number (`"12%"`, `"$5"`, `"(5)"`, `"1,234"`, `"Q1"`) is a
     **gap** with a `chart-value-not-numeric` warning, in the preview and in the export. The exporter used to strip the
     characters and write 12, 5, 5, 1234 or 1; the preview already drew most of them as gaps (and read `"0x10"` as 16,
     now a gap too). Lint offers a fix (`suggestChartNumberFix`) that stores the numbers and a matching number format.
  2. A **two-column scatter** chart plots column 2 against the row numbers: an XY chart has an X column only when it has
     three or more columns (the rule both engines already followed, now written down and shared through core).
  3. A deck whose chart or table names an **unknown dataset, dataset field or mapping column** fails validation
     (`dataset-unknown`, `dataset-field-unknown`, `chart-mapping-unknown-column`), so the preview reports it as an invalid
     document instead of drawing it.
  A deck that uses none of the new fields and holds only numbers or strict decimal strings in its charts previews,
  exports and edits byte for byte as before (renderer: the 805 example slides; PPTX: 21 golden digests; editor: identical
  patches).
- **Script fonts reach PowerPoint per slide and per language**: slides with their own East Asian or complex-script fonts
  get their own slide master (opf-pptx), and Armenian, Georgian and Amharic decks name their chosen font in their own
  theme supplement entry instead of Sylfaen or Nyala (core).
- The libraries stay deterministic and offline. Node `>=22` (tested on 22, 24 and 26) as since the 0.12.x patches.

## What ships, per package

Registry state (filled after `release-train.mjs tag` verifies each package: npm `latest`, `gitHead` = release merge
commit, SLSA provenance, `npm audit signatures`):

| Package | Version | `gitHead` | Release PR | Floors |
| --- | --- | --- | --- | --- |
| `@openpresentation/opf` | 0.13.0 | _pending_ | _pending_ | - |
| `@openpresentation/opf-render` | 0.13.0 | _pending_ | _pending_ | core `^0.13.0` |
| `@openpresentation/opf-pptx` | 0.13.0 | _pending_ | _pending_ | core `^0.13.0`; optional peer renderer `^0.13.0` |
| `@openpresentation/opf-editor` | 0.12.0 | _pending_ | _pending_ | core `^0.13.0`; optional peer renderer `^0.13.0` |
| `@openpresentation/cli` | 0.11.0 | _pending_ | _pending_ | bundles core 0.13.0; optional peers renderer and PPTX `^0.13.0` |

### Core, `@openpresentation/opf` 0.13.0

- **RR-54, chart and table data** ([opf#376](https://github.com/OpenPresentation/opf/pull/376), contract
  [docs/chart-table-data.md](../../chart-table-data.md)). Additive schema, no removal or rename (`check:breaking` reports
  none): `NumberFormat` (the `NumberVariable.format` syntax), `DataColumn` (`{ name, format }`) for chart, dataset and
  table columns, a body cell's own `format`, `source` provenance on chart data and datasets (never read by engines),
  top-level `datasets` referenced as `{ "dataset": "<id>", "fields"? }` by charts and tables, and `chart.mapping`
  (category, X and series by column name). Core API: `chartNumber` (the one strict rule), `formatDataNumber`,
  `excelNumberFormat` / `numberFormatFromExcel` (round trip through Excel format codes), `resolveChartData`,
  `resolveTableData`, `suggestChartNumberFix` and the validation and lint codes named above. The three behaviour changes
  are in the first section.
- **FF-46, theme supplements for Armenian, Georgian and Amharic** ([opf#377](https://github.com/OpenPresentation/opf/pull/377),
  issue [opf#375](https://github.com/OpenPresentation/opf/issues/375)): `resolveScriptFonts` names the chosen family in
  the language's own `supplement` (`Armn`, `Geor`, `Ethi`) instead of the catalog default (Sylfaen, Nyala). Output
  changes only for such a deck whose font scheme sets `complexScript` (or is a `cs` scheme for that language); an
  Amharic deck on Ebrima no longer lists Nyala in `Presentation.Fonts`.
- **Example decks** ([opf#367](https://github.com/OpenPresentation/opf/pull/367)): the playground decks
  `technical/full-feature-tour` and `gallery/presentation-types/developer-conference-talk` are self-contained (embedded
  PNG assets, inline chart data, a complete inline colour scheme) and export with no placeholders. 14 of the 805
  example slides change in the preview; the examples digest is `394c4ce7...` (was `485b5c07...` in 0.12.1 and 0.12.2).
  Schema, catalogs and libraries are unchanged by it.
- Catalog snapshot manifest re-pinned to pptx.gallery `04792cc` (no record changed).

### opf-render 0.13.0

- **RR-54 in the preview** ([opf-render#127](https://github.com/OpenPresentation/opf-render/pull/127)): every chart path
  reads `resolveChartData`, so `DataColumn` headers, dataset references and `chart.mapping` plot; numbers follow core's
  `chartNumber`; a column's format shapes its data labels and the value-axis ticks (percent axes and pie percent labels
  stay percent); table cells draw core's formatted text; dataset charts and tables trace to their authored path.
- The default golden baseline records the core 0.13.0 examples (the 14 example-deck slides above and the new digest);
  no renderer pixel moved for it.

### opf-pptx 0.13.0

- **PPTX engine: pptxgenjs-plus 4.3.4** ([opf-pptx#165](https://github.com/OpenPresentation/opf-pptx/pull/165), issue
  [opf-pptx#162](https://github.com/OpenPresentation/opf-pptx/issues/162); record
  [docs/pptxgenjs-plus-migration.md](https://github.com/OpenPresentation/opf-pptx/blob/main/docs/pptxgenjs-plus-migration.md)).
  Still vendored byte for byte with its archive integrity, file hashes and npm provenance commit. Runtime dependencies:
  `jszip` is replaced by `@node-projects/jszip` 4.3.0, plus `@rgrove/parse-xml` 4.2.3 and `pako` 3.0.2; the packed
  tarball grows by about 158 KB and the minified browser bundle of `toPptx` + `fromPptx` by about 286 KB (77 KB gzip).
  Measured on the 126 examples and the 850 gallery documents, part by part, the changed parts fall into the classes of
  the migration record:

  | Classes (record rows) | What changes | Disposition |
  | --- | --- | --- |
  | Package structure (1-3) | No ZIP directory entries in the package and the embedded workbooks; `jpg` default content type `image/jpeg`; no phantom slide-master overrides | Accepted (ECMA-376 conformance; PowerPoint writes none) |
  | Serialization and metadata (4-7, 11-13, 15) | `firstSlideNum="1"`, whitespace and self-closing elements, extra namespace declarations, counted `Paragraphs`/`Notes`, no empty notes run, no empty `descr`, table `p14:modId`, hyperlink attributes at their schema defaults | Accepted: canonical XML or schema defaults equal |
  | Ids and relationships (14, 16) | Table frame ids from the slide's id pool; relative slide-to-chart targets | Accepted: ids stay unique, URIs equivalent |
  | Charts (18-21) | Flat `c:strRef` categories (multi-level keep `multiLvlStrRef`), no orphan third `c:axId`, category axis `sourceLinked="0"`, pie/doughnut labels hidden at the series level | Accepted (what PowerPoint writes; the importer reads both forms) |
  | Workbooks (22, 23) | Category and scatter table refs now right upstream; the bubble ref repair is kept; zero values are kept in the workbook | Repair kept; zeros accepted (correctness) |
  | Engine changes undone (8-10) | Empty text bodies on text-less shapes; a notes master without placeholders; a separate default notes theme | Neutralized in `src/vendor-compat.js` to keep the natively checked output |
  | Fixed in opf-pptx (17) | A raster returned for an asset declared SVG is embedded as that raster (no broken-image fallback) | Fixed |

  After masking those classes, 1,716 of 1,717 slides are equal (the last one only loses an invalid `svgBlip`), and
  `fromPptx` of old and new packages gives the same document for all 976 decks.
- **Per-slide script fonts** ([opf-pptx#170](https://github.com/OpenPresentation/opf-pptx/pull/170), issue
  [opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168), FF-05): each further East Asian /
  complex-script profile gets its own slide master whose theme carries that slide's script slots, so later slides no
  longer draw script text in the first slide's fonts. A deck with one profile is byte-identical (976 of 976 corpus
  decks). Slides on another master that have notes report `script-font-notes-not-exported`.
- **Workbook zeros and scatter X gaps** ([opf-pptx#173](https://github.com/OpenPresentation/opf-pptx/pull/173), issue
  [opf-pptx#172](https://github.com/OpenPresentation/opf-pptx/issues/172)): a chart value of 0 is a 0 in the embedded
  workbook (it was an empty cell, so Edit Data showed a blank and a refresh made it a gap); a scatter X gap is a blank
  cell instead of `<v>null</v>`.
- **RR-54 in the export and import** ([opf-pptx#171](https://github.com/OpenPresentation/opf-pptx/pull/171)): strict
  numbers (one `chart-value-not-numeric` per chart with a count), number formats written to the series cache, data
  labels, value axis and workbook cells (custom `numFmt` from id 164), datasets and mapping exported like their inline
  equivalent, `OPF_DATASETS_V1` / `OPF_DATA_V1` provenance in `full` mode with a cache hash that survives PowerPoint's
  re-spelled format codes, and import of format codes back to `{ name, format }` without provenance.

### opf-editor 0.12.0

- **RR-54 in the data grid** ([opf-editor#92](https://github.com/OpenPresentation/opf-editor/pull/92)): `DataColumn`
  headers and per-column formats (`setGridColumnFormat`), chart cells checked with `chartNumber`, shared datasets edited
  at `/datasets/<id>` (renames follow every `fields` and `mapping`, deleting a used column is refused, "Use a copy of the
  data"), a "Chart columns" mapping panel (`setChartMapping`) and "Store as a shared dataset" on import. Each edit is one
  undoable patch.

### CLI 0.11.0

- Bundles core 0.13.0. `opf import-data --dataset <id>` writes the imported data into `datasets.<id>` (with the file as
  its `source`) and references it from the new table or chart. `opf render` and `opf export` take the 0.13 renderer and
  PPTX as optional peers.

## Verified native PowerPoint evidence

Supervisor-run on the Windows host with desktop PowerPoint; agents never open Office.

| Evidence | Covers |
| --- | --- |
| [rr-17-pptxgenjs-plus-native-20261005](../../evidence/rr-17-pptxgenjs-plus-native-20261005/README.md) ([opf#351](https://github.com/OpenPresentation/opf/pull/351)) | The engine migration, a/b on 40 decks: PASS 20, WARN 0, FAIL 0. A Keynote check of the 20 `m-*` decks on the new engine: 20 WARN, 0 FAIL, every native chart kept (warnings are font substitution and text metrics, as on 0.12.3) |
| [ff-05-per-slide-script-fonts-native-20261005](../../evidence/ff-05-per-slide-script-fonts-native-20261005/README.md) | Per-slide script fonts: every `after` deck passes; the `before` decks show the baseline failure |
| [ff-46-theme-supplement-native-20261005](../../evidence/ff-46-theme-supplement-native-20261005/README.md) | Armenian, Georgian and Amharic supplements: the five changed decks fail before and pass after; six controls byte-identical |
| [rr-54-chart-table-data-native-20261005](../../evidence/rr-54-chart-table-data-native-20261005/README.md), [recheck](../../evidence/rr-54-chart-table-data-native-recheck-20261005/README.md), [slash](../../evidence/rr-54-slash-native-20261005/README.md) | RR-54: the first run had 3 FAIL (a save re-spelling the format code, zeros missing from the workbook, `0.0 m/s` read as a fraction); each was fixed and re-checked (12 of 12 codes kept) |
| [rr-54-ee4941b-native-20261006](../../evidence/rr-54-ee4941b-native-20261006/README.md) ([opf#392](https://github.com/OpenPresentation/opf/pull/392)) | RR-54 on the merged-main combination with pptxgenjs-plus: 25 PASS, 0 FAIL (read-only open, Edit Data, save copy and re-import) |

### Not verified natively

- A native pass on the **published** 0.13 set (the checks above ran on the pull request and merged-main builds the
  release packages are built from); the parity run and configuration audits on the published set follow the train.
- The editor and the CLI make no PowerPoint-facing claim of their own beyond the exporter's.

## Known gaps and descoped items

| Item | State | Issue |
| --- | --- | --- |
| Chart data from external spreadsheets (`ChartDataSource`): still valid, now warns `chart-data-source-unresolved` | Descoped by the owner 2026-10-01 | [opf#240](https://github.com/OpenPresentation/opf/issues/240) |
| Date axes and date formats, per-series colours or chart types (combo charts), formulas, rich text in dataset cells | Not in RR-54 | - (listed in [docs/chart-table-data.md](../../chart-table-data.md)) |
| Bubble chart workbook ref one row short in the engine | Repaired by opf-pptx (OPF has no bubble chart); fix merged upstream on `next`, not released | [lofcz/pptxgenjs-plus#15](https://github.com/lofcz/pptxgenjs-plus/pull/15) |
| Scatter X gap written as `<v>null</v>` by the engine | Blanked by opf-pptx | lofcz/pptxgenjs-plus#16 |
| Script fonts in speaker notes of a slide on a further master (one notes master keeps the presentation theme) | Reported as `script-font-notes-not-exported` | [opf-pptx#168](https://github.com/OpenPresentation/opf-pptx/issues/168) |

The gaps of the 0.12.0 note (video, navigation and motion, rich notes, `world` map, CJK and Thai line breaking, Arabic
chart labels) are unchanged.

## Decisions taken (vetoable)

The RR-54 contract decisions (one strict number rule, `ChartDataSource` warns, the variables format syntax, top-level
datasets, mapping by name) and the move to pptxgenjs-plus are the owner's (2026-10-05) and are not repeated here.

1. **Minor versions for the whole set** (0.13.0 / 0.12.0 / 0.11.0): every PPTX export changes and RR-54 changes how
   non-numeric chart text is drawn and exported, so the set is not a patch. To veto: none practical once published.
2. **Three engine changes are undone in `vendor-compat.js`** (empty text bodies, the notes master's placeholders, the
   separate notes theme) to keep output that PowerPoint opened in every native check and that FF-05 depends on. To veto:
   drop the compat step and re-run the native a/b set.
3. **The engine stays vendored**, not an npm dependency, so a fork patch cannot change exported parts without an
   opf-pptx change (hash record in `vendor/pptxgenjs/UPSTREAM.json`).
4. **The renderer's default golden baseline is updated by digest and 14 example-deck hashes only**, from the
   `regenerate-goldens` output, and CI keeps selecting the lock's golden (`golden-override: ''`) until the release plan
   names core 0.13.0 (selecting the renderer's baseline earlier broke the registry run on 2026-10-06, opf-render#130).

## Since the 0.12.0 note

Published and verified after the addenda of [release-notes-0.12.0.md](release-notes-0.12.0.md): core 0.12.2, opf-render
0.12.2 (0.12.1 was tagged but never published: its golden digest did not match core 0.12.2's examples, fixed by
opf-render#128 and #130), opf-pptx 0.12.4, opf-editor 0.11.3 and CLI 0.10.1. They open the Node `engines` range to
`>=22` (a closed `24.x` made npm on Node 22 and 26 silently install old releases) and carry no other behaviour change.

## What is not finished (RR-20)

- The train itself (runbook kept by the supervisor), then the follow-up docs PR: `release-plan.json` (versions,
  `bundledCore`, `exampleRefs`, `verificationRefs`), the compatibility matrix, the quickstart and current-set docs, the
  published-matrix consumer, and dropping the RR-41 retained golden from `scripts/registry-golden.mjs` once no
  release-plan core ships the `485b5c07...` corpus.
- Site adoption of the 0.13 set (pptx.gallery, pptx.dev, openpresentation.org) and the re-audit and parity run on the
  published set.
