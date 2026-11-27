# Select the files a release candidate opens (NT-13)

A release candidate does not need the whole corpus opened again: most slides export exactly as they did at the last release.
`pnpm native <target> --tier candidate --release <version>` builds every file of the `release` tier (building opens no
application), hashes what each file draws, and opens only:

- the `smoke` tier's files;
- the default export of the decks that unreleased changelog fragments (`native:`) or `--look` name;
- the files with a slide whose hash differs from the baseline summary's, or that the baseline does not have;
- every file whose deck hash differs from the baseline's (the step says so: every slide of such a file counts as changed).

Before the run it prints the files in the release tier, the unchanged files it skips, the files it selects with the reason,
and the slides changed. A baseline whose summary has no hashes (0.36.0) cannot say what changed: the selection is the smoke
tier and the named files, and one line says so. The `release` tier stays the per-release run.

## The hashes (`slide-parts.mjs`)

`exportHashes(bytes)` returns `{ deck, slides: [...] }`, each the first 16 hex digits of a SHA-256.

- **A slide** covers the slide part and every part it reaches through relationships: DrawingML charts and chartex parts with
  their cached values, chart style and color parts and the embedded workbook; SmartArt data, layout, quick style, colors and
  drawing; pictures and media; the notes slide; tags. The shared parts are not followed from a slide: the slide layout is
  named by its name (which layout the slide uses), the master, theme and notes master by their kind. A link to another slide
  is that slide's number.
- **The deck** covers `presentation.xml` without its slide list and OPF's document tag (slide size, default text style),
  `presProps.xml`, `tableStyles.xml`, every slide master with its theme, the notes master, and each layout a slide uses.
- **Not content**: `docProps`, `viewProps.xml`, `[Content_Types].xml`, part names and relationship ids. Each relationship id a
  part uses is replaced by the hash of what it reaches, so inserting a slide (which renumbers `chart5.xml`, `image3.png` and
  `rId4` elsewhere) changes no other slide's hash. An embedded workbook is hashed by its entries without `docProps`, so a zip
  timestamp does not count.

Two builds of the same commit give the same hashes. Between the 0.36.0 build and the 0.37.0 candidate, 53 of the 233
smoke-tier slides hash differently, 5 of them slides that 0.36.0 did not have.

## Where the hashes go

The classify step (`native.mjs`) hashes each file of the run from the exported files beside it (`<out>/build`, checked
against `result.file.sha256`), so a kept run directory classified later with `--from-run` gets them too. `classify.json`
carries `export` per file and `changed: true` on a slide whose hash differs from a baseline that has hashes; no class
changes. The summary (`runs/<version>/<target>.json`) keeps `export` per file for the next release's candidate.

`select.mjs`: `selectCandidate`, `selectionTable`, `exportChange`, `exportsOfResults`. Tests: `select.test.mjs`, on decks
made in memory and hand-written summaries.
