# LibreOffice interoperability (experimental)

OPF's PPTX export targets PowerPoint first. LibreOffice Impress opening an OPF PPTX is **experimental**: OPF tests it in one pinned
Linux environment and publishes what it finds, but it makes no support promise until the owner promotes the baseline below. This is
PPTX interoperability only. OPF has no ODP exporter, and LibreOffice is never a runtime dependency of any package; it runs only in
the qualification described here ([opf#926](https://github.com/OpenPresentation/opf/issues/926)).

## The pinned environment

| Part | Pin | Where it is recorded |
| --- | --- | --- |
| LibreOffice | 26.8.2.2, The Document Foundation's Debian build, from its permanent archive, checked against SHA-256 `8290c8f4…a476` before it is unpacked | `scripts/libreoffice/environment.json` |
| Linux image | the pinned Playwright image every browser job and the goldens use (Ubuntu 24.04, digest-pinned) | `.github/workflows/nightly.yml` (`check:playwright-pin` keeps it one string); `scripts/libreoffice/image.mjs` reads it |
| Engines | the checkout under test: core, render, pptx and gallery at the commit the run records | the results |
| Measuring tools | pdf.js, `@napi-rs/canvas`, sharp and pdf-lib at the versions the lockfile pins for the renderer's own PDF tests | `pnpm-lock.yaml` |

`scripts/libreoffice/install.sh` installs the pinned build into `/opt/libreoffice26.8` and refuses any other version. A change of
version is a pull request that changes `environment.json` and records the new results.

Every run records the exact identities in `results.json`: `soffice --version` (version and build hash), the OS release, fontconfig's
version, Node, the commit and package versions, and for each font profile a digest of every font file fontconfig can see (family,
style and file SHA-256) plus, for every family a deck asks for, fontconfig's match, its file and SHA-256, and the faces LibreOffice
actually embedded in its PDF.

## Fonts

LibreOffice draws text with whatever face its machine resolves for the family the PPTX names. OPF exports the families the deck chose
(`typefaces: "selected"`, the default), and a deck without a font scheme uses Aptos Display and Aptos, which no Linux machine has.
The runner therefore checks every deck in two profiles:

- **`opf`, the documented profile, which the baseline is judged in.** The image's fonts and the fonts LibreOffice bundles, plus every
  pinned OPF preview font, script faces included (`copyPreviewFonts` of `@openpresentation/opf-render` with `scripts: "all"`,
  each file verified by SHA-256, licenses written beside them; all OFL, Apache, MIT or UFL), plus one fontconfig alias per row of OPF's font policy
  (`spec/reference/font-policy.json`) that has a replacement: Aptos to Intos, Aptos Display to Intos Display, Calibri to Carlito,
  Arial to Arimo, and so on. LibreOffice then draws each family with the face OPF measured it with; for the families whose replacement
  is metric-compatible (Intos for Aptos, Carlito for Calibri, Arimo for Arial) that face has the same advances as the original.
- **`stock`, for information.** The image's fonts and LibreOffice's bundled fonts only: what a Linux user who has not installed OPF's
  fonts sees. Results here show the cost of font substitution; they never decide the baseline.

To get the `opf` profile on your own Linux machine, one command installs the same fonts and aliases the runner uses (it calls the
same `copyPreviewFonts`, `fontconfigAliases` and `fontconfigConf` of `@openpresentation/opf-render/preview-fonts-node`):

```sh
npx --package @openpresentation/opf-render opf-preview-fonts ~/.local/share/fonts/opf --scripts all --fontconfig ~/.config/fontconfig/conf.d/60-opf-fonts.conf
```

Then run `fc-cache -f` and restart LibreOffice. Remove the two paths to undo it.

The aliases replace a family even where it is installed, so add them only on a machine that lacks the original fonts. The other
route is to export with `typefaces: "safe"`, which writes Arial, Georgia, Courier New or Times New Roman and lays the text out with
their metric twins; a viewer then needs those families or their metric equivalents (Liberation Sans, Liberation Serif and Liberation
Mono ship with LibreOffice; Gelasio for Georgia does not).

## Charts

The common chart types (column, bar, line, pie, doughnut, area, scatter, stacked and combo) export as native charts that LibreOffice
draws and keeps editable. For the chartex types (treemap, sunburst, histogram, Pareto, box and whisker, waterfall, funnel), the
default `charts: "auto"` writes the chartex part that PowerPoint draws natively. LibreOffice 26.8 reads that part too, but draws only a
single-series histogram from it; for the other types it shows "One or more chart types are unsupported in this version of LibreOffice".
For a deck that will be opened in LibreOffice, export with `charts: "picture"` (CLI `--charts picture`): every chartex type is then a
clustered column chart, which LibreOffice draws with all its data and which stays editable in every app. PowerPoint stays the primary
target, so the default does not change.

## How a deck is checked

`node scripts/libreoffice/run.mjs` (or `pnpm qualify:libreoffice`) does this for every case of the corpus and every profile:

1. **Export.** An OPF deck is exported by this checkout's `convert` (the CLI's path) to PPTX, to PNG (OPF's preview) and to PDF. A
   retained PPTX is used as it is.
2. **Convert.** `soffice --headless --convert-to pdf` turns each PPTX into a PDF, with a fresh LibreOffice user profile per font
   profile. `soffice --headless --convert-to "pptx:Impress MS PowerPoint 2007 XML"` re-exports it as LibreOffice's own PPTX (the round
   trip).
3. **Read the source.** `pptx-model.mjs` reads the exported PPTX itself, independently of the exporter: slides in presentation order,
   every shape's box on the slide (group transforms and inherited placeholder positions applied), its paragraphs with explicit breaks
   counted, table cells, chart strings and the families it names.
4. **Measure the rendered pages, not the XML.** pdf.js reads every text run of LibreOffice's PDF with its position and advance. Each run
   is attributed to the shape it was drawn in, and the runner measures how far it reaches past that box and past the slide. Each page
   is also rasterized on a canvas with a 72 pt margin around the slide, so ink drawn past the slide edge, which the page itself would
   clip, is counted.
5. **Content preservation, read back two ways.** Every word of every text shape and table cell must be on the rendered page (computed
   slide-number and date fields excepted), and every word and every explicit line break must survive in LibreOffice's re-exported
   PPTX. The words are compared as case-folded NFKC tokens, so a run that LibreOffice splits or draws in capitals (an eyebrow with
   `cap="all"`) still matches; right-to-left words, which a PDF's text layer gives as glyph clusters in visual order, are compared as
   letters. LibreOffice's PDF export leaves out glyphs past the page, so a word pushed off the slide is reported as clipped, not lost.
   A chart LibreOffice cannot draw shows its "unsupported chart type" placeholder, which is counted too.
6. **Compare with OPF's preview.** Each slide is rasterized at the preview's size and compared with OPF's PNG (mean channel error and
   the share of clearly different pixels), and a side-by-side image (preview left, LibreOffice right) goes into the artifact.
7. **The control.** The same measurements run on OPF's own PDF of each deck. The control must pass; it shows that a finding comes from
   LibreOffice's rendering and not from the instrument.

The tolerances are 1 pt beside a text box, 0.5 pt at the slide edge and 0.35 em vertically. The measured advance of a run ignores its
trailing spaces.

## What is a defect, and what is a documented difference

A **defect** fails the case:

- the file does not convert, or the PDF has a different number of pages than the deck has visible slides (LibreOffice has no repair
  dialog in headless mode: a file it cannot read does not convert);
- a source word is missing from the rendered page, or from LibreOffice's re-export, or an explicit break is lost;
- text reaches past the slide edge, or ink is drawn past it where the deck itself draws nothing there;
- text reaches past the side of its box, or past the bottom of a single-line (`wrap="none"`) box: clipping or overlap.

A **documented difference** is listed but does not fail:

- the look of a substituted face (in the `stock` profile, or for a family OPF previews with a look-alike rather than a metric
  replacement);
- a wrapping body (native body text, a wrapped title, a table cell) that LibreOffice breaks into more lines and that grows downward;
- a chart drawn in LibreOffice's own chart style (and a chartex histogram with LibreOffice's own bins), and the pixel difference
  from OPF's preview in general;
- a family named by its weight (Roboto Medium, Roboto SemiBold) drawn with the nearest face LibreOffice finds (Roboto Bold);
- words LibreOffice adds in its re-export (for example a placeholder prompt).

The corpus sorts cases by scope. **Baseline** cases are the supported subset: a defect there is a compatibility defect of OPF's
export. **Advanced** cases are outside it: the chartex charts (treemap, sunburst, histogram, Pareto, box, waterfall, funnel and
map) and live SmartArt. LibreOffice 26.8 reads the chartex part itself rather than OPF's fallback: it draws the types it knows with
its own layout (a histogram with its own bins) and a type it lacks as an "unsupported chart type" placeholder, which the runner
reports as `chart-unsupported`. It draws SmartArt from the file's drawing part. Defects in advanced cases are known differences and
never block.
**Regression** cases are retained artifacts of an older exporter, checked as they are for diagnosis.

## Corpus

`scripts/libreoffice/corpus.mjs` lists the cases:

- `scripts/libreoffice/corpus/`: cover and text (wrapped titles, two columns, a statement, explicit breaks), long and nested lists
  (wrapping bullets, three levels, numbered lists with nested letters, descriptions), images and crops (a cover crop beside text, a
  square crop with focus, a contained picture with a caption, an ellipse, grayscale and an SVG), tables (numeric, long prose cells, a
  formatted table beside text) and common charts (column, bar, line, pie, stacked column, area, scatter). The pictures are copies of
  the MIT-licensed technical example assets (`examples/technical/assets`).
- [opf#925](https://github.com/OpenPresentation/opf/issues/925): the retained seven-slide artifact of the report
  (`packages/pptx/test/fixtures/native-long-text/llmreference.pptx`, unchanged), and its slides 3 and 5 rebuilt as an OPF deck and
  exported by today's engines three ways: default, `typefaces: "safe"` and `bodyText: "native"`.
- Two technical examples (`rich-text-runs`, `table-cell-types`).
- The shared native-acceptance corpus (`scripts/native-acceptance`).
- The release qualification corpus (`scripts/native-acceptance/qualification`, RR-105): with `--qualification <dir>` the runner
  takes the very files `build.mjs --out <dir>` writes (the PPTX files and previews the PowerPoint and Keynote streams open) and grades
  the manifest's features check by check (`features.mjs`): `opens`, `slides`, `noOverflow`, `noShrink` and `content` from the
  rendered pages, `nativeChart`, `nativeTable`, `connectors` and `shapes` from LibreOffice's own saved copy, `roundtrip` by importing
  that copy with OPF, `visual` as a number for a reviewer; `smartArt` and `footer` need the app's own model and are not graded.

## Running it

In CI: the `libreoffice` job of `nightly.yml` runs every night, on demand (Actions, Nightly, Run workflow) and on a pull request with
the `full-ci` label. It uploads `libreoffice-qualification` (the results, the exported PPTX files, LibreOffice's PDFs and re-exports,
and the side-by-side images) and writes the summary table to the job summary. It is report-only: the runner exits 0 whatever it finds,
the job carries `continue-on-error`, and the nightly report ignores it, so it can never turn the nightly red or stop a release.
Promoting the baseline means adding `--fail-on-defect` (which fails on a baseline defect in the `opf` profile) and removing
`continue-on-error` and the report's ignore entry; that is the owner's decision.

Locally, in the same environment (Docker, or any Linux machine or cloud agent with Docker):

```sh
docker build -f scripts/libreoffice/Dockerfile --build-arg IMAGE="$(node scripts/libreoffice/image.mjs)" -t opf-libreoffice .
docker run --rm -v "$PWD:/opf" -w /opf opf-libreoffice bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm build && node scripts/libreoffice/run.mjs --case opf#925"
```

`--case` takes case ids, group names or an id prefix ending in `*`; `--profiles opf` runs one profile; `--profiles none` runs only the
control, which works on any machine without LibreOffice. The portable tests are `pnpm check:libreoffice`.

## Reporting a LibreOffice problem with an OPF file

Attach the PPTX and say: the LibreOffice version from Help, About (or `soffice --version`), the operating system, whether the deck's
fonts are installed (for a deck without a font scheme: Aptos and Aptos Display, or OPF's Intos replacements), and the slide. If you can,
run the deck through `node scripts/libreoffice/run.mjs` in the pinned environment and attach `results.json`; a finding there is
reproducible by anyone.

## Results

The current results and the claim they support are in
[the v0.33 qualification note](programs/release-readiness/qualification-0.33-libreoffice.md).

The qualification runner needs a fresh or empty output directory. It refuses existing files and prior result folders, preserving earlier evidence; choose a new path for each attempt.
