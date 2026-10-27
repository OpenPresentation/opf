# Changelog

## Unreleased

## 0.29.0 (2026-10-27)

No package changes; released with the set.

## 0.28.0 (2026-10-26)

- WI-2: the `agenda-split` layout (Agenda beside), a concise agenda beside its title and introduction, listed after `agenda` in the Openers and closers group. Detailed entries stay on `agenda`, which keeps the full slide width. The catalog has 29 layouts and a preview for the new one.
- WI-3: a `three-column` layout (Text group, after `two-column`): three independent columns that each take any content kind, including video, timeline and groups, with pictures shown whole by default (`design.imageFit: "contain"`). A new id needs no drawing declaration.
- WI-1 (output-changing: content sizing): content takes the size and height it asks for before anything shrinks, and peers share one size.
    - An `auto` row of a layout takes what its content needs, up to the space the headings and the numeric rows' content leave, instead of at most half the content box. When the auto rows do not all fit, each gives up the same fraction of what it can give up above its content's height at the minimum font size, so three detailed passages in an all-auto stack keep 25 px (were 22/20/18 px), a code payload no longer overflows at 16 px, and a one-line note keeps nearly its need beside a dense row.
    - Content-sized text is measured the way the fit that places it measures it (outlines and raster padding included), so a single-line auto note draws at its 25 px starting size instead of 24 px: the closing next step, the comparison verdict and the notes of `metrics`, `chart`, `table` and `timeline`.
    - A metric value asks for its 76 px role size whatever its box and fits down only when it does not fit; it asked for `min(76, 0.28 × box height)`, which drew 46.27 px in a compact region and about 50 px on `dashboard`.
    - A region whose blocks flow in a `column`, and a group's blocks in one column, stack at the heights they need, one gap apart, placed by the region's `anchor`, instead of an equal share each (a one-line paragraph sat 248 px above its long sibling). Charts, pictures, tables, timelines and videos take what the measured blocks leave; a column with explicit `weights` keeps its tracks.
    - Peers side by side share one fitted size per kind (prose, lists): regions of one role in the same rows (`two-column`, `comparison`, three columns) and the blocks of one row of a `grid` or `row` flow. Three peer lists draw at one size (were 32/30/27 px).
    - The gallery's `dashboard`, `faq` and `statement` layout previews are regenerated with the new engine (metric values at 76 px, FAQ pairs stacked one gap apart); no gallery record changes.
- WI-2 (declared drawing change, a minor release): the single-message layouts place the title and what belongs to it as one group. `closing` and `statement` are all-`auto` columns anchored in the middle, so the supporting text sits one gap under the title and subtitle (it used to sit a few hundred pixels below) and the title-only slide draws as before; `closing` also keeps a contact or QR picture whole (`imageFit: contain`). `quote` sizes its quotations `auto`, so the title and the quotation are centered together. `comparison` sizes its options `auto`, so the verdict follows the options instead of sitting at the foot of the slide (dense options keep their size). `image` now says that the picture is shown whole, and that a full-bleed crop needs an explicit `fit: "cover"` (wording only). The layouts' previews are regenerated.
  Drawing change (existing records that draw differently or are gone): `layouts:closing`, `layouts:statement`, `layouts:quote`, `layouts:comparison`.
- WI-3 (output-changing: columns and media): `two-column` takes timelines, and its pictures are shown whole.
    - `two-column` accepts every content kind, the timeline included (a timeline in a column was drawn below the layout's grid with a `layout-unplaced` warning), and sets `design.imageFit: "contain"`, so a picture beside text is shown whole at the region's anchor instead of cropped into a tall strip. An explicit `fit` on the block still wins.
    - `image-beside` and `logos` write `anchor: "middle"` on their media regions: a picture shown whole now sits at its region's anchor (top by default), and these two keep the centered look they had.
  Drawing change (existing records that draw differently or are gone): `layouts:two-column`, `layouts:image-beside`, `layouts:logos`.
- WI-4 (output-changing: type roles): one readable type scale, headings without stranded words, typographic quotes and code in fitted panels.
    - Body prose and the subtitle ask for 28 px (21 pt), up from 25 px; list items stay at 32 px and a table keeps 25 px. `fitText` and `fitRichText` default to 28 px, the `flow: auto` long-block test counts lines at 28 px, and every size still fits down to `composition.minFontSize`. Explicit run sizes win. Paragraphs and lists of one stacked column that do not fit at their role sizes shrink together to one size (they read 23, 21 and 25 px before).
    - A wrapped title or subtitle is balanced: it keeps its size and line count and picks the break set with the least variance of line widths, with a credit for a line that ends a sentence ("A smaller pilot. / A clearer decision.", not "A smaller pilot. A / clearer decision."). An explicit line break stays and body text keeps the greedy wrap. New `balance` option of `fitText` and `RichTextOptions`.
    - A quote body asks for 40 px and fits down through the former 28 px. Its marks are the typographic pair of the deck language (a new `QUOTE_MARKS` table and `quoteMarksFor`: “…” for English, „…“ for German, «…» for French and Spanish, 「…」 for Japanese, ASCII only for a language the table does not list; a deck with no language reads as English). Attribution, role and source join with an en dash (` – `). The PPTX export writes the same characters (they come from the shared quote layout) and import reads them back, and still reads the older straight marks and ` - `. New `language` option of `layoutQuote`.
    - Code asks for 22 px (was 18 px) and fits down to the floor; the language or file label keeps its own 14 px role. `layoutCode` returns `bounds` and a code panel shorter than its cell is only as tall as its metadata, source lines and insets, top-anchored.
    - In auto mode a prose block that wraps takes a reading measure of about 70 average characters of its size and follows the content alignment, never at the cost of size; a lone block of up to two lines in a `flow: auto` region (and in an auto-mode composition) uses a 32 px lead size. A kept-empty `flow: auto` region reserves two lines of that size.
    - The gallery layout previews are regenerated with the new engine; no gallery record changes.
WI-4 of the slide-design plan (`artifacts/slide-design/WORK-ITEMS.md`; triage rows P15, P16, P17, P21 and P34, owner decision D2). Output-changing for every deck with prose, a multi-line heading, a quote or code: render goldens, the 0.19 template goldens and the PPTX archive fixtures move. Validation findings follow the new sizes; a dense deck that fitted at 25 px can fit at a smaller shared size.
- WI-6: the pillars, team and FAQ layouts set `design.listBullet: "none"`, so a label with its description draws without a bullet; the team layout also accepts a `list` block. The previews of pillars, process, team and FAQ show each label and description as one list entry (`items: [{ text, description }]`), and process numbers its steps with `numbering` instead of typed "1." prefixes.
  Drawing change (existing records that draw differently or are gone): `layouts:pillars`, `layouts:team`, `layouts:faq`.

## 0.27.0 (2026-10-26)

- WI-5 (P19, output-changing for every column, bar, line and area chart): the value axis follows its length. Intervals are at least 48 reference pixels apart and there are at most eight, so a chart beside text or in one of three columns draws 0 to 100% in steps of 20 and no longer 0 to 90% in tens (`chartIntervalsFor`, `CHART_MIN_TICK_SPACING_PX`, `CHART_MAX_INTERVALS` on `/composition`; the PPTX export writes the same `c:majorUnit`). A chart box with room for it (at least 216 x 288 reference pixels) floors its text at 18 px instead of 16 (`chartTextSize`, `CHART_TEXT_FLOOR_PX`), so three-column and dashboard charts read larger in the preview and in PowerPoint. The preview draws the chart panel without an outer frame (the axes and gridlines draw the plot, and the PPTX chart area never had a line). Zero baselines, explicit axis settings and the other chart types' own scales are unchanged. The tick-label column of the waterfall, histogram and pareto previews is sized for the sparser axis, so "100" no longer wraps after "90". The gallery's layout previews for `chart`, `chart-beside`, `table`, `table-beside` and `dashboard` are regenerated to match.

## 0.26.10 (2026-10-25)

No package changes; released with the set.

## 0.26.9 (2026-10-25)

No package changes; released with the set.

## 0.26.8 (2026-10-25)

No package changes; released with the set.

## 0.26.7 (2026-10-24)

No package changes; released with the set.

## 0.26.6 (2026-10-24)

No package changes; released with the set.

## 0.26.5 (2026-10-24)

No package changes; released with the set.

## 0.26.4 (2026-10-24)

No package changes; released with the set.

## 0.26.3 (2026-10-24)

No package changes; released with the set.

## 0.26.2 (2026-10-24)

No package changes; released with the set.

## 0.26.1 (2026-10-24)

No package changes; released with the set.

## 0.26.0 (2026-10-24)

- MR-23: the six packages are one pnpm workspace at one shared version, 0.26.0 (the gallery goes backwards from 5.0.0; `latest` moves with an explicit `--tag latest`). Packages depend on each other through `workspace:^`, which `pnpm pack` publishes as `^0.26.0`, so a consumer never mixes minors. Core's install hints and `PEER_RANGES` name `^0.26.0`. The gallery package no longer has a sync from pptx.gallery or a bootstrap for unreleased engines; records are written in `packages/gallery`. No behavior change otherwise.

## 5.0.0 (2026-10-21)

- **Breaking: layout records are one ordered list of regions; `areas`, `columns`, `rows` and the `regions` map are removed (FA-33).** A record is now `direction` (`"row"` or `"column"`, default `"column"`) and an ordered `regions` array of regions and splits. A region is `{ "name", "size"?, ...rules }` with the rules unchanged (`accepts`, `role`, `flow`, `max`, `bleed`, `listColumns`, `anchor`, `empty`); a split is `{ "direction", "regions", "size"?, "anchor"? }` and nests up to three levels. `size` is a weight (default 1) or `"auto"` (the height the content needs, in a column only), `title` and `subtitle` stay heading regions that take only `size`, `accepts` may be left out for every content kind, and an `anchor` on the record or a split applies to every region under it. All 28 layouts are converted, and each compiles to exactly the grid it had in 4.0.0 (areas, column and row weights, `auto` rows and every region rule, proven in `test/layout-equivalence.test.mjs` against a fixture of the 4.0.0 records), so no layout draws differently and the previews are unchanged. `quote` and `statement` write their `anchor: "middle"` once on the record. There is no old-format alias and no migration API: a custom layout in a deck must be rewritten. `CATALOG_SCHEMA` and `opf.catalogSchema` advance to `4`; the per-kind layout schema version stays `2` (`opf-layout/v2`). Records are validated by a core that reads this form, so this release needs the core release that accepts it.

- Build tooling: the one-release merged-engine bootstrap (`.github/bootstrap-engines.json`, `scripts/bootstrap-engines.mjs`) is generalized from "3.0.0" to the release the file names, with its catalog schema, and is set to 5.0.0 over the merged core (OpenPresentation/opf#756, `d223fc00`) and opf-render (opf-render#278, `e5838837`) commits, because core 0.25.0 cannot publish before it depends on gallery 5. The ancestry, digest and unchanged-manifest checks are as before. The layout-equivalence test compiles with core's own `layoutTemplate` (`@openpresentation/opf/composition`) instead of a test-local copy. The published package is unchanged by this tooling and stays dependency-free.

## 4.0.0 (2026-10-19)

- **Breaking: the `dark` theme is removed; dark is a variant of every theme.** Core 0.23.0 adds `design.variant`, a map over a deck's one color scheme (light1, light2, dark1, dark2, with an optional accent order). The `minimal`, `classic` and `bold` themes gain `variants` (`light`, `light-alt`, `dark`, `dark-alt`, each the value of `design.variant`), and the separate `dark` theme (the `boost` colors with the `seaford` fonts on `dark1`) is gone: a document that names `design.theme: "dark"` is an unknown theme (`opf/unresolved-reference`). Replace it with a theme and its dark variant, plus `colorScheme: "boost"` and `fontScheme: "seaford"` if the boost look is wanted. A removed id is a major release, so this is 4.0.0. No other record or drawing changes; `CATALOG_SCHEMA` stays 3.
- Development and CI use the published engines: `@openpresentation/opf` and `@openpresentation/opf-render` 0.23.0 replace the 0.19 pins and the one-release 3.0.0 bootstrap, which does nothing for any other gallery version. Core 0.23.0 derives borders, gridlines, axis lines, chart text and code colors from the color scheme, so seven layout previews are redrawn with `npm run previews` (this major release is where a redraw is allowed): chart, chart-beside, code, dashboard, table, table-beside and timeline. `previews/layouts/index.json` records their new sizes. No other record's drawing changes.
- The tests validate every theme's `variants[].variant` with core 0.23.0's `normalizeColorVariant` and `isColorVariant` (`@openpresentation/opf/composition`) instead of a hand-written shape check.

## 3.0.0 (2026-10-13)

- Canonicalize the bootstrap temporary root on macOS before strict artifact checks, so the system `/var` alias does not reject valid merged-source builds. Source-child symlinks remain rejected; release metadata and runtime bytes are unchanged.

- **Breaking catalog contract:** layout `areas` now use arrays of cells instead of whitespace-delimited row strings. `CATALOG_SCHEMA` and `opf.catalogSchema` advance to `3`; consumers must support array-row areas. Layout IDs, per-layout schema version `2` and `opf-layout/v2` remain unchanged.
- Gallery 3 build tooling requires exact core and renderer commits that are ancestors of their actual remote default branches. The one-release bootstrap stages development tarballs, verifies shared core/catalog resolution and unchanged release manifests, and retains artifact identities; its commands also run portably on Windows. Qualification uses the actual merged core and renderer commits. This tooling does not qualify published engine metadata or establish native acceptance.
- **Breaking visual defaults:** center compact quote and headline-metric regions and image-side explanations; keep dense text, lists, charts and tables top-aligned. FAQ, process, dashboard, pillars, comparison and scorecard layouts no longer add decorative content boxes by default. Existing layout IDs are preserved. These appearance changes require gallery 3 under the pixel-stability policy; record schema remains v2.
- Picker previews now use authored, explicitly illustrative examples with distinct measures and units, number formats, actual questions and answers, ordered process steps and named responsibilities. Exhaustive stability fixtures remain separate and unchanged.

## 2.0.0 (2026-10-11)

- **Breaking: replace the 278 placeholder layouts of 1.x with 28 OPF 0.19 intent layouts.** Records now use `opf-layout/v2` grid templates with `areas`, `columns`, `rows` and typed content regions; `CATALOG_SCHEMA` and `opf.catalogSchema` are `2`. Consumers require `@openpresentation/opf` 0.19 or later. There are no v1 aliases or migration APIs. Six old ids remain with new template semantics: `agenda`, `comparison`, `dashboard`, `faq`, `timeline` and `two-column`. Other old ids no longer resolve in this catalog. Boxed treatment, direction, alignment, image fit and item images are design settings rather than layout variants.
- The six intent groups are openers and closers (`cover`, `section`, `agenda`, `statement`, `closing`); text (`text`, `list`, `quote`, `two-column`); groups of items (`pillars`, `comparison`, `process`, `timeline`, `faq`); numbers (`metrics`, `scorecard`); visuals (`image`, `image-beside`, `gallery`, `chart`, `chart-beside`, `table`, `table-beside`, `code`); mixed (`hero`, `dashboard`, `team`, `logos`). Gallery owns these layout records directly. Each has an authored usage description and SVG preview link; layout index entries include `summary` and `group`. The `image` and `image-beside` templates preserve whole-picture `imageFit: contain`.
- **Breaking preview contract:** `@openpresentation/gallery/previews` provides one SVG per layout id instead of the 70 HTML slide-archetype thumbnails. `npm run previews` generates them and `npm run check:previews` checks them. Schema 2 establishes a new major-version pixel-stability baseline, with filled and empty region cases retained.
- Narrative beats now name existing v2 intent layouts, preserving narrative prose and the other beat fields. Themes, colour schemes, font schemes, audiences, purposes and tones remain unchanged. The published package remains dependency-free and registers through `catalogs: [gallery]`; OPF 0.19 obtains the default catalog from this package instead of a core-owned snapshot.
- Build tooling for this first schema-2 release can validate and draw the catalog using exact merged core/renderer sources before their registry releases. It stages development tarballs with original versions and unchanged runtime bytes, records original/staged manifests and integrity, and verifies a shared core/gallery installation. Bootstrap leaves the release package metadata and built catalog bytes intact; merged-source, preview, stability and trusted-publication gates still apply. This bootstrap is build tooling, not native acceptance or publication of the engine packages.

## 1.0.0 (2026-10-10)

Released from `3458f50`; the original tagged changelog kept this entry under Unreleased.

- First release of `@openpresentation/gallery` from OpenPresentation/gallery: the pptx.gallery catalog on its own version line. `import { gallery } from "@openpresentation/gallery"` and register it with `catalogs: [gallery]`. It holds the records that `@openpresentation/opf/catalog`'s `defaultCatalog` held up to OPF 0.18: 278 layouts, 4 themes, 14 colour schemes, 89 font schemes, 48 narratives, 16 audiences, 9 purposes and 7 tones. The package also exports `GALLERY_SOURCE`, `CATALOG_SCHEMA` (`1`, also `opf.catalogSchema` in `package.json`), `catalogDisplay`, `catalogIndexes` and `catalogManifest`; `@openpresentation/gallery/previews` exports the layout previews. It has no dependency, not even for its types: `GalleryCatalog` has the shape of core's `Catalog`. New records are a minor release; a removed or renamed id or a changed drawing is a major release, which CI enforces by drawing every existing layout, theme, colour scheme and font scheme against the previous published release. Replaces the 0.0.1 placeholder.
