# PptxGenJS 4.0.1 to pptxgenjs-plus 4.3.4 (RR-17)

opf-pptx builds the PPTX package with PptxGenJS and then normalizes every part itself (`src/index.js`
`normalizePptxZip`). Until 0.12.x the vendored engine was PptxGenJS 4.0.1 (gitbrent/PptxGenJS, unmaintained since
2025-06). Its embedded chart workbooks carry `ref="A1:C7'"` (gitbrent/PptxGenJS#1531), and Keynote drops every chart
whose table ref does not parse (opf-pptx#162; opf-pptx#163 repairs the ref after the fact). The owner decided on
2026-10-05 to move to [pptxgenjs-plus](https://github.com/lofcz/pptxgenjs-plus) 4.3.4, the maintained fork (MIT, same
public API and default export; [migration guide](https://lofcz.github.io/pptxgenjs-plus/migration.html)).

## How it is vendored

The model is unchanged: `vendor/pptxgenjs/pptxgen.es.js` is the exact `package/dist/pptxgen.es.js` of the npm archive
`pptxgenjs-plus-4.3.4.tgz`, with its `LICENSE`. `UPSTREAM.json` records the archive URL, its SHA-512 integrity, the
per-file SHA-256 hashes and, new, the source commit from the archive's npm SLSA provenance
(`lofcz/pptxgenjs-plus@ecfa5086`, branch `next`). `node scripts/vendor-pptxgenjs.mjs` refetches and verifies it;
every build runs `scripts/verify-vendor.mjs`. Vendoring was kept (rather than an npm dependency) because the exporter
depends on the exact bytes the engine writes: a semver-compatible pptxgenjs-plus patch could change exported parts
without an opf-pptx change, which the hash record rules out.

Runtime dependencies follow the vendored file's imports: `jszip` 3.10.2 is replaced by `@node-projects/jszip` 4.3.0
(the JSZip fork pptxgenjs-plus imports), plus `@rgrove/parse-xml` 4.2.3 (static import, OMML and XML validation) and
`pako` 3.0.2 (JSZip's deflate; also lazily imported by the engine for WOFF fonts, which opf-pptx never embeds). All are
pinned exactly, like `jszip` was. opf-pptx's own reading and writing of packages stays on `fflate`: the vendored engine
is the only user of a JSZip, so there are still exactly two ZIP implementations (the engine's and opf-pptx's), as
before. The three tests that read exports with `jszip` now use `fflate`.

Sizes (measured 2026-10-05):

| | PptxGenJS 4.0.1 (0.12.2) | pptxgenjs-plus 4.3.4 | change |
|---|---|---|---|
| `vendor/pptxgenjs/pptxgen.es.js` | 516,931 B | 1,230,609 B | +713,678 B |
| packed tarball | 439,605 B | 597,746 B | +158,141 B |
| unpacked package | 1,576 KB | 2,276 KB | +700 KB |
| runtime ZIP/XML dependencies installed | `jszip` graph, 12 packages, 2.1 MB | 5 packages, 6.3 MB (2.7 MB of it `@types/node` + `undici-types`, which `@node-projects/jszip` declares as a runtime dependency; no code) | +4.2 MB |
| browser bundle of `toPptx` + `fromPptx` (esbuild, minified) | 1,840,091 B (542,085 B gzip) | 2,125,824 B (619,581 B gzip) | +285,733 B (+77,496 B gzip) |

The engine has no static `node:` import; Node built-ins (`fs`, `http`, `https`, only for media given by `path`) load
through a runtime `import()` that browser bundlers do not see, and `npm run test:browser` passes unchanged.

## Output changes

Measured by exporting the 126 bundled examples (`@openpresentation/opf/examples`, office font measurement and a fixed
substitute image, as `test/export-corpus.mjs`) and the 850 gallery-support documents (the parity harness inputs,
`scripts/published-matrix/fixtures/gallery-snippets-c349a61.json.gz` in core, `toPptx` defaults with the harness's
seed, timestamp and ZIP date) with main `bc97949` and with this branch, then diffing every part of the 976 packages:
bytes first, then canonical XML (attributes sorted, namespace declarations and whitespace between elements ignored,
`<x></x>` equal to `<x/>`). Every changed part belongs to one of the classes below; after masking them, 1,716 of 1,717
slides are equal and the one left is row 17 (an invalid `svgBlip` removed, geometry equal). `fromPptx` of the old and the new package gives the same
document for all 976 decks, with the same diagnostics except one: the old package of row 17 also reported
`invalid-svg-image` for its invalid `svgBlip`.

| # | Change | Upstream source | Decks (parts) of 976 | Disposition |
|---|---|---|---|---|
| 1 | ZIP directory entries (`ppt/`, `_rels/`, ...) are no longer written, in the package and in the embedded workbooks | lofcz/pptxgenjs-plus#14 | 976 | Accepted: an OPC package holds parts only (ECMA-376 Part 2); PowerPoint writes none. |
| 2 | `[Content_Types].xml` default for `jpg` is `image/jpeg` (was the invalid `image/jpg`) | `c9536200` (#1444) | 976 | Accepted (correctness). opf-pptx already wrote an explicit override per image part, so no part's type changes. |
| 3 | `[Content_Types].xml`: phantom slide-master overrides are no longer written | `c9536200` (#1444) | 0 visible | opf-pptx's own filter already removed them; it now finds nothing. |
| 4 | `p:presentation` carries `firstSlideNum="1"` | `b24bdd7e` | 976 | Accepted: 1 is the schema default. |
| 5 | `presProps.xml`, `docProps/core.xml`, `docProps/app.xml`: whitespace (`<p:presentationPr/>` becomes an open/close pair; empty lines where optional properties are absent) | documentProps and presentation-properties ports | 976 | Accepted: serialization only. |
| 6 | `docProps/app.xml` `Paragraphs` and `Notes` are counted (were 0 and the slide count) | CHANGELOG: "Extra `documentProps` for core.xml/app.xml (... counts)" | 976 | Accepted: informational; PowerPoint recounts on save. |
| 7 | Slides: `p:sld` declares `xmlns:m`, `xmlns:a14`, `xmlns:mc` with `mc:Ignorable="a14"`; `p:cNvPr` and other empty elements are self-closing; whitespace inside some frames | `b24bdd7e`, `b45acf5c` (ECMA fixes), serializer | 976 (1,717) | Accepted: serialization only (canonical XML equal). opf-pptx's regex post-processing was adjusted where it assumed the long form (`code-provenance.js` and the image-placeholder `descr`, which otherwise produced malformed XML). |
| 8 | Shapes without text get `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody>` | `genXmlTextBody`, `7d974ee0` ("Shapes without text still require a `<p:txBody>`") | 402 slides before neutralizing | **Neutralized** (`src/vendor-compat.js`): CT_Shape's `txBody` is optional (minOccurs 0) and PowerPoint opened text-less shapes in every native check; an empty body would turn every card frame, connector and marker into an (empty) text shape for importers and editors, and changed `fromPptx` of opf's own exports. |
| 9 | Notes master: a minimal master without placeholders (no slide image, notes body, header, date, footer or number) | `2d3e872c` (#61) | 976 | **Neutralized** (`vendor-compat.js` restores the 4.0.1 master byte for byte): the placeholders set the Notes Page layout; the repair upstream cites came from the notes master sharing the slide theme, which FF-05 fixes, and PowerPoint opened this master in every native check. |
| 10 | Notes master theme: its own `theme2.xml` with the default Office colours and font scheme | `7c92136d` ("spec-valid notes theme2") | 976 | **Neutralized**: FF-05 requires the notes theme to be a copy of the finished deck theme (so `Presentation.Fonts` lists only the deck's fonts); the notes master is pointed back at theme1 and `giveNotesMastersOwnThemes` copies it as before. |
| 11 | Notes slides without notes: the empty run `<a:r><a:rPr/><a:t></a:t></a:r>` is gone (the `endParaRPr` stays) | notes generator | 976 (1,553) | Accepted: no text, no visible change. Notes with text are unchanged. |
| 12 | Chart graphic frames: `descr=""` is not written | `cNvPr` generator | 176 (207) | Accepted: an empty description is the absent description. |
| 13 | `p14:modId` values of table frames differ (unique per table) | CHANGELOG: "tables get unique default `p14:modId` values" | 105 (146) | Accepted: an arbitrary revision id; deterministic (seeded). |
| 14 | `p:cNvPr` ids of tables and the shapes after them differ (tables take ids from the slide's id pool) | lofcz/pptxgenjs-plus#11 | 87 (115) | Accepted: ids stay unique (opf-pptx's own duplicate fix is now a no-op there); nothing references them. |
| 15 | Hyperlinks: `highlightClick="0" endSnd="0"` dropped on run links; shape links get `action="" history="1" invalidUrl="" tgtFrame=""` | hover-action port (`9b39a713`) | 13 (13) | Accepted: all are schema defaults. |
| 16 | Slide-to-chart relationship targets are relative (`../charts/chart1.xml`, was `/ppt/charts/chart1.xml`) | `b3545e0c` (community chart XML contracts) | 176 (207) | Accepted: equivalent URIs; PowerPoint writes relative ones. |
| 17 | A raster that an `imageResolver` returns for an asset declared `image/svg+xml` (the corpus run substitutes one PNG for every asset, so `technical/content-payload-matrix` slide 4 hits this) is embedded as a plain picture. PptxGenJS 4.0.1 wrote an `asvg:svgBlip` that pointed at the PNG itself; pptxgenjs-plus would write its broken-image placeholder (100 x 119 px) as the picture and fit the frame to it | engine SVG handling; fixed in opf-pptx (`resolveImage` embeds the bytes as the raster they are) | 1 (slide 4, its rels, content types) | Fixed in opf-pptx: geometry is the same as 4.0.1's, the invalid `svgBlip` is gone. Real SVG pictures (PNG fallback plus SVG part) are byte-identical in both. |
| 18 | Chart categories are a flat `c:strRef`/`c:strCache` (was a one-level `c:multiLvlStrRef`) | `4f0e920b` (#60) | 165 (233) | Accepted: what PowerPoint writes for one category level; the importer reads both; multi-level categories keep `multiLvlStrRef`. |
| 19 | The third `c:axId` (a series axis that does not exist) is no longer listed in 2-D bar, line and area charts | lofcz/pptxgenjs-plus#13 | 165 (233) | Accepted (correctness: it referenced a missing axis). |
| 20 | Category axis `c:numFmt sourceLinked="0"` (was 1) | numFmt `sourceLinked` fix (upstream issue #1309) | 165 (233) | Accepted: with `General` and text categories nothing changes; the format now applies as written. |
| 21 | Pie and doughnut: the per-point `c:dLbl` elements that hid every label are gone; the series `c:dLbls` itself now says hidden (`showCatName`/`showPercent` 0) and carries `dLblPos` | `d7a053a7` (pie labels honour series defaults) | 5 (5) | Accepted: labels were hidden and stay hidden (the preview draws none). The removed per-point text properties named the body font only. |
| 22 | Embedded workbooks: only the ZIP directory entries (row 1). Table refs: pptxgenjs-plus fixed #1531 for category and scatter tables, so opf-pptx's repair (#163) changes nothing there; its bubble table still takes the last row from the column count (lofcz/pptxgenjs-plus#15), and the repair still covers it (OPF has no bubble chart) | `fd7365c7` (workbook number formats), #1531 | 0 workbook parts | Repair kept (`repairChartWorkbookRanges`). |
| 23 | Embedded workbooks keep chart values of 0 (and -0, written as 0); PptxGenJS 4.0.1 wrote them as `values[idx] \|\| ''`, an empty cell, so Edit Data showed a blank where the chart showed 0 (opf-pptx#172, native check opf#385) | upstream issue #1430 (category and bubble values) | 0 (no chart value of the 976 decks is 0) | Accepted (correctness). `test/chart-workbook-values.mjs` checks every OPF chart type and the engine's bubble workbook. A scatter X gap is still written `<v>null</v>` by the engine (lofcz/pptxgenjs-plus#16); opf-pptx blanks it in `normalizeNestedZip` (0 decks of 976 have an X gap). |

Checked and unchanged in every export (no part differs): text insets and paragraph margins (pptxgenjs-plus now maps a
shape `margin` array as top, right, bottom, left, where 4.0.1 used left, right, bottom, top; opf-pptx passes `margin: 0`
to shapes, and table cell margins map the same way in both), the theme (`theme1.xml`: FF-24 colours, FF-05/FF-49
`ea`/`cs` rules and script supplements), run fonts (run-level `ea`/`cs` stay stripped by `stripRunScriptFonts`), chart
fonts (pptxgenjs-plus adds an `a:ea` slot to chart titles, legends and axes; `writeChartFonts` rewrites every chart text
slot as before), the RR-11 slide-number, date and footer fields and their placeholders, `viewProps.xml`, slide masters
and layouts, table XML and table styles, `defaultImageDpi` (not written: opf-pptx sets none), transitions (none
exported), `p14:creationId` (opt-in, not used), chart style and colour parts (opt-in for classic charts, not used;
chartex style parts are opf-pptx's own), every embedded workbook part (number formats included), tags and the
document provenance.

## Engine changes that are not output changes for opf-pptx

- `write({compression: true})` is deprecated; the export no longer passes it (the package is re-zipped by
  `normalizePptxZip`, so the intermediate ZIP is stored).
- UUIDs come from `crypto.getRandomValues` instead of `Math.random`. Only features opf-pptx does not use call it
  (comments, web extensions, the engine's sections and chartex, custom scatter label fields), so no UUID reaches an
  export and `toPptx` still needs to seed only `Math.random` (`docs/export-determinism.md`; the determinism grid passes).
- `PPTXGENJS_DEBUG` / `NODE_DEBUG=pptxgenjs` enable console diagnostics.

## Tests and fixtures

- `test/fixtures/chartex-fallback-main.json` (SHA-256 of the `chartex: 'fallback'` export of 9 decks) is regenerated.
  Its 9 decks differ from main only in rows 1, 2, 4, 5, 6, 7, 11, 12, 16, 18, 19 and 20 (17 slides, 17 charts, all
  slide relationship parts); after masking, every slide is equal to main's.
- `test/chart-workbook-ranges.mjs` now expects the vendored category and scatter refs to be right and the bubble ref to
  be wrong (until lofcz/pptxgenjs-plus#15 ships); the repair is still checked for every family.
- `test/chartex.mjs` expects the relative chart target (row 16); `test/typeface-inventory.mjs` guards the new vendor
  shapes of the Arial chart defaults (7 data-label fallbacks, a latin/ea/cs legend); `test/determinism.mjs` reviews the
  new vendor host-API sites; `test/smoke.mjs` builds its "non-text shape" sample without the empty text body (row 8).
- `test/vendor-compat.mjs` pins rows 8 to 10.

## Native checks

Not run here. The Keynote check set (20 decks rebuilt with this build) and a PowerPoint deck set with manifest and
`RUN.md` for the Windows host are handed to the supervisor (opf#323); results belong in the evidence folder of core.
