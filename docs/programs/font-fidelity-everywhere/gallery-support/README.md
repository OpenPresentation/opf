# Gallery support audit (FF-23)

The reproducible audits behind [gallery-support.md](../gallery-support.md):

- The presence audits (A and B, FF-23) are the regression check for FF-24 to
  FF-39. An item that claims to fix a gap re-runs them on its heads and links
  the changed rows.
- The parity audit (FF-38) is the program's progress scoreboard. Every fix PR
  reports its before/after count of perfect values.

| Path | Contents |
| --- | --- |
| `audit-a/` | Layouts, content blocks, image treatments, backgrounds, headers/footers. `scripts/` (with controls for the image-treatment probe), `results.json`, generated `SUMMARY.md`. |
| `audit-b/` | Color schemes, font schemes, languages, themes, narratives, audiences, tones, socials and, since 2026-09-30, the 26 charts. `scripts/`, `results.json`, the audit's own `README.md` and generated per-dimension tables (`*.md`). |
| `parity/` | Parity scoreboard (FF-38): `scripts/`, `run.ps1`, `build.ps1`, `parity-results.json` and the generated `PARITY.md`, plus dated later runs (`parity-results-<date>-<topic>.json` and `PARITY-<date>-<topic>.md`; never overwritten). |
| `support-status.json` | One record per gallery value (819 presence items, the 26 charts among them), built from the presence and parity results. |
| `build-support-status.mjs` | Regenerates `support-status.json`. |
| `works-percent.mjs` | Prints how many gallery configs are `works`, overall and per dimension (`pnpm report:works`, `--reasons`, `--json`); the internal 100% `works` progress measure (FF-47), never shown on pptx.gallery. Unit test: `works-percent.test.mjs`. |

Results are copied byte for byte from the measured runs (heads in
[gallery-support.md](../gallery-support.md)), except for the normalized id
of earlier runs (below). Script edits are local paths (below) and, since the
2026-09-29 re-run, the updates for the current gallery contract listed under
"Re-running against new heads". The path edits:

- the author's pptx-gallery path became
  `process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'`;
- in `parity/run.ps1` and `parity/build.ps1`, the toolchain and clone paths
  became `NODE_TOOLCHAIN` and `OPF_REPOS` environment variables (default
  `<workspace>`), and `build.ps1` finds `sources` relative to itself, as
  `run.ps1` does.

The exported PPTX files, `out/` intermediates (snippet bundles,
`raw-results.json`, probes, controls) and build logs are not committed.
`audit-b/README.md` still mentions them because it describes the original
run.

### Normalized ids

None in the current run: the reduced gallery (FF-22) no longer has the United
Kingdom map chart. The earlier 900-value runs record it under a core slug, as
follows. pptx-gallery `f17e9ae` gives the United Kingdom map chart a misspelled slug.
Core renamed that slug to `united-kingdom`, and `check-text-integrity` rejects
the old spelling, so the committed files record that chart under
`united-kingdom`. This is the only byte change to `parity/parity-results.json`.
In `support-status.json` the `parityOnly` record carries
`galleryIdNormalized`: `{fromParts, joiner, to, reason}`. The original slug is
`fromParts.join(joiner)`. It is stored in parts because
`check-text-integrity` rejects the joined literal in core text; the check
script itself spells the slug the same way. Consumers join the parts and map
them back to the gallery slug. The
drift is removed by FF-22 and FF-37.

### Classifier changes

- FF-51 (2026-09-30): audit A's layout export check compares a placement
  signature (`audit-a/scripts/placement.mjs`: every shape's `a:off`/`a:ext`
  box plus its body anchor and each paragraph's `algn`) instead of the boxes
  alone, because the preview check compares the whole SVG including the text
  anchor. It also compares every preview text with its native paragraph and
  reports "export paragraph alignment differs from preview" on a mismatch.
  `results.json`, `SUMMARY.md` and `support-status.json` still record the
  published run; FF-58 regenerates them. `pnpm check:audit-placement` unit-tests
  the helpers.

- FF-52 (2026-09-30): audit A's layout check no longer reports "geometry identical to the no-layout default" for two exact cases. A core layout named in `DEFAULT_BASELINE_LAYOUTS` (the 20 layouts that are the engine default for their content) is its own baseline. A record with `deprecation.replacedBy` is measured against its replacement instead: the same slide with only the layout id swapped must draw the same SVG and the same export placement signature (`checks.alias`), and the replacement must be bundled and not deprecated, otherwise the reason is "layout is deprecated in favour of X but ...". Everything else, including a layout with a real effect that the export ignores, is reported as before. FF-55: with the 70 legacy ids bundled, `origin` is `core-catalog` for them and no layout is `gallery-only`.

## Re-running against new heads

The scripts locate their inputs relative to their own folder, so copy them into
this layout (any `<workspace>` directory):

```text
<workspace>/
  pptx-gallery/                    checkout at the head to measure (GALLERY_DIR)
  sources/audit-A-opf/             opf, opf-render, opf-pptx worktrees for audit A
  sources/audit-A-opf-render/
  sources/audit-A-opf-pptx/
  sources/audit-B-opf/             opf, opf-render, opf-pptx, opf-editor for audit B
  sources/audit-B-opf-render/
  sources/audit-B-opf-pptx/
  sources/audit-B-opf-editor/
  dimension-audit/A/               copy of audit-a/
  dimension-audit/B/               copy of audit-b/
  dimension-audit/parity/          copy of parity/ (audits A and B import its font-host.mjs and font-availability.mjs)
```

Node 24 and pnpm (for core) are required. No Office or COM is used. From a
bash shell, with opf-render, opf-pptx and opf-editor cloned next to this
checkout and pptx-gallery checked out at `$W/pptx-gallery`:

```bash
W=<workspace>
OPF=<path to this opf checkout>
repo() { if [ "$1" = opf ]; then echo "$OPF"; else echo "$OPF/../$1"; fi; }
for r in opf opf-render opf-pptx opf-editor; do git -C "$(repo $r)" fetch origin; done
for s in A B; do
  for r in opf opf-render opf-pptx; do
    git -C "$(repo $r)" worktree add --detach "$W/sources/audit-$s-$r" origin/main
  done
done
git -C "$(repo opf-editor)" worktree add --detach "$W/sources/audit-B-opf-editor" origin/main

# Build: core with pnpm, siblings with npm (audit B imports sibling dist/).
for s in A B; do
  (cd "$W/sources/audit-$s-opf" && pnpm install --frozen-lockfile && pnpm -r --if-present build)
  for r in opf-render opf-pptx; do (cd "$W/sources/audit-$s-$r" && npm ci && npm run build); done
done
(cd "$W/sources/audit-B-opf-editor" && npm ci && npm run build)

mkdir -p "$W/dimension-audit"
cp -r "$OPF/docs/programs/font-fidelity-everywhere/gallery-support/audit-a" "$W/dimension-audit/A"
cp -r "$OPF/docs/programs/font-fidelity-everywhere/gallery-support/audit-b" "$W/dimension-audit/B"
cp -r "$OPF/docs/programs/font-fidelity-everywhere/gallery-support/parity" "$W/dimension-audit/parity"
export GALLERY_DIR="$W/pptx-gallery"

# Audit A: writes results.json, then SUMMARY.md. ONLY=layouts,blocks and LIMIT=n narrow a run (a narrowed run writes
# results.<only>.json instead). All five dimensions are measured, including the image treatments (image-treatment.mjs).
cd "$W/dimension-audit/A"
cp results.json results.previous.json          # the committed results of the earlier run
node --import ./scripts/register.mjs scripts/audit.mjs
node scripts/summary.mjs

# Audit B (26 charts included): snippets, measurement, then classification (results.json, *.md). The measurement holds every
# raw result in memory: give node --max-old-space-size=12000 if it runs out of heap.
cd "$W/dimension-audit/B"
mkdir -p out
h() { git -C "$1" rev-parse --short=7 HEAD; }
printf '{"pptx-gallery":"%s","opf":"%s","opf-render":"%s","opf-pptx":"%s","opf-editor":"%s","node":"%s"}\n' \
  "$(h "$GALLERY_DIR")" "$(h "$W/sources/audit-B-opf")" "$(h "$W/sources/audit-B-opf-render")" \
  "$(h "$W/sources/audit-B-opf-pptx")" "$(h "$W/sources/audit-B-opf-editor")" "$(node -p 'process.versions.node')" > out/heads.json
node scripts/gen-snippets.mjs
node --import "$W/sources/audit-B-opf/scripts/register-local-opf.mjs" scripts/audit.mjs
node scripts/summarize.mjs
```

Then copy the new `results.json` and generated markdown (`audit-a/SUMMARY.md`,
`audit-b/*.md`) back into this folder, replace any local absolute path with
`<workspace>`, regenerate the per-item file and update the counts and heads in
[gallery-support.md](../gallery-support.md):

```bash
node docs/programs/font-fidelity-everywhere/gallery-support/build-support-status.mjs
```

To measure a fix before it merges, point the matching `sources/audit-*-<repo>`
worktree at the fix branch instead of `origin/main`, and record that head.

## Parity scoreboard (FF-38)

The parity harness uses the same workspace convention. Copy `parity/` to
`<workspace>/dimension-audit/parity/`. It expects worktrees
`<workspace>/sources/<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}`, with
prefix `parity` by default; `GALLERY_DIR` overrides the gallery path.
`run.ps1` and `build.ps1` are Windows-only: they call `node.exe`, `pnpm.cmd`
and the Windows npm path, and use backslash paths. They need Node 24 and pnpm
on `PATH` or under `NODE_TOOLCHAIN`.

On other operating systems, run the steps directly:
- build the worktrees as in the presence section;
- run `node scripts/gen-snippets.mjs`;
- run `node --import <sources>/parity-opf/scripts/register-local-opf.mjs scripts/parity.mjs`;
- run `node scripts/summarize.mjs <out.json> <out.md> [baseline.json]`.

`PARITY_PREFIX`, `ONLY`, `LIMIT` and `OUT` work as in `run.ps1`.

```powershell
# Windows
$W = "<workspace>"
foreach ($r in 'opf','opf-render','opf-pptx','pptx-gallery') {
  git -C "<clones>\$r" fetch origin
  git -C "<clones>\$r" worktree add --detach "$W\sources\parity-$r" origin/main
}
Copy-Item -Recurse "<opf>\docs\programs\font-fidelity-everywhere\gallery-support\parity" "$W\dimension-audit\parity"
& "$W\dimension-audit\parity\build.ps1"                  # pnpm/npm install and build the worktrees
& "$W\dimension-audit\parity\run.ps1"                    # writes parity-results.json and PARITY.md
& "$W\dimension-audit\parity\run.ps1" -Only layouts,charts -Limit 20   # quick subset
$env:OPF_REPOS = "<clones>"; & "$W\dimension-audit\parity\run.ps1" -Update   # move worktrees to origin/main, rebuild, rerun
```

For a fix PR, create `sources\<prefix>-*` worktrees with the PR branch in the
repository you changed and `origin/main` elsewhere. Then run:

```powershell
& "$W\dimension-audit\parity\build.ps1" -Prefix fix123
& "$W\dimension-audit\parity\run.ps1" -Prefix fix123 -Baseline "$W\dimension-audit\parity\parity-results.json" -Out "$W\dimension-audit\parity\out\fix123.json"
```

The report then includes a before/after table; quote it in the PR. The first
baseline report is kept in `parity/history/2026-09-23-baseline/`; it predates
the OPC relationship and text-extent fixes to `parity.mjs`. After a
merged fix, copy `parity-results.json` and `PARITY.md` back into `parity/`,
regenerate `support-status.json`, and update the headline in
[gallery-support.md](../gallery-support.md) and [burndown.md](../burndown.md).

### Instrument notes (2026-09-29)

- **Field text.** PPTX text runs come from `scripts/pptx-runs.mjs`. It matches both
  `a:r` and `a:fld` (slide-number and date fields carry `id`/`type` attributes, so
  `<a:fld>` never appeared in the file). `node --test scripts/pptx-runs.test.mjs`
  covers it. A change to an instrument gets a before/after run on the same
  heads of all four repositories; only the fixed run is committed, as a new dated
  results file (`parity-results-2026-09-29-field-text.json`), and
  `build-support-status.mjs` reads that file by default.
- **Preview font host (2026-09-29 model, superseded 2026-09-30).** `parity.mjs` built the font-resolution registry with
  `prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'})` and no `scripts`, on the reading that the shipped previews
  load no script faces. Values whose fonts route to a Noto script face failed fontResolution ("preview has no face"). The
  shipped hosts do load them (next entry), so that model is kept only as `PARITY_FONT_HOST=office-only`, which reproduces the
  707 / 47 / 96 run of 2026-09-30 exactly.
- **Preview font host (FF-38, 2026-09-30): the gallery model.** `scripts/font-host.mjs` models the host that pptx.gallery
  ships. opf-editor 0.10.x builds a browser registry with `loadBrowserFontRegistry` from the office pack's eager faces
  (`substitutionPolicy: 'visual'`, `fallbackFamily: 'Roboto'`) and its font gate (`createFontGate`) calls
  `registry.ensureLazyFonts(document)` and `registry.ensureScripts(document)` before anything is rendered or measured.
  Those load the vendored preview faces (Intos, the open pack) and the script (Noto) faces the document's text and font
  schemes need (opf-render 0.11.2: `scripts: 'auto'` and `ensureScripts` include the faces a font scheme itself names).
  The harness runs the same calls per value, on the value's own document, against the same package files, with a stand-in for
  the Font Loading API and for `fetch` (the renderer still hash-verifies every file). One registry is built per distinct load
  (scripts, CJK characters, vendored families), so the large script faces load once. The value must also pass the strict
  measured render with that registry (`renderSvgDeck` with the registry's text measurement): a family that resolves but cannot
  measure or shape its text (`font-shaping-failed`) fails fontResolution as "the modelled host cannot draw this value". This
  is a model of the browser host in Node, not a browser. `PARITY_FONT_HOST` selects the model: `gallery` (default),
  `node-auto` (`prepareNodeFonts({scripts: 'auto', presentation})`, the Node loader) or `office-only` (the earlier model).
  `meta.fontHost` and `results[].fontHost` record the model, the scripts and packages loaded, and the render outcome. No
  tolerance changed and every check other than fontResolution is identical under all three models. The run is
  `parity-results-2026-09-30-gallery-font-host.json` (report: [PARITY-2026-09-30-gallery-font-host.md](parity/PARITY-2026-09-30-gallery-font-host.md)).
  `node --test scripts/font-host.test.mjs` covers the model names.
- **Audits A and B model the shipped font host (FF-48, 2026-09-30).** Before this change the presence audits classified font
  availability against strict no-host previews: audit B rendered each value with no registry, with the strict bundled base pack
  and with the office pack, and called a value `partial` when the base pack could not draw it ("no bundled or substitute face:
  strict preview throws font-unavailable", "non-Latin textSample: strict font-unavailable", "language font scheme X not bundled",
  "bundled Roboto lacks the script") or when the office pack drew a replacement ("preview needs office-pack substitution ...
  export writes <selected>"). No shipped host renders like that, and under the owner font policy (2026-09-29, README
  "The font policy defines `works`") a preview that draws the FF-31 policy table's look-alike while the PPTX names the family
  the user selected is correct. The audits now use the parity harness's host model, unchanged: `parity/scripts/font-host.mjs`
  (`gallery` by default: the editor's browser registry and font gate, `ensureLazyFonts` and `ensureScripts` on the value's own
  document, the same package files) and `parity/scripts/font-availability.mjs` (the per-family verdict of
  `font-resolution.mjs`, the strict measured render with the host registry, the preview's script slots; `parity.mjs` uses the
  same functions and its results are byte-identical before and after the extraction). Audit B records the host's verdict per
  value (`measure.hostFonts`, the `host` field of the non-Latin text sample and of the native-name probe of each language) and
  classifies from it: a family that resolves to its policy route (metric or visual-only) with the PPTX naming the selected family
  is `works`; only a `fail` verdict is a reason (no policy row, no face, an unrouted fallback such as Roboto for Raleway, a PPTX
  that writes the replacement or does not name the selected family) or a host that cannot draw the value (a missing glyph or
  face, `font-shaping-failed`). Audit A's font probe (`checks.fontRegistry`, which never made a value `partial`) now
  asks the same host and, for the first time, makes a value `partial` when the host cannot draw it; no value did. The
  export, re-import, geometry, text, colour and `ea`/`cs` checks and every tolerance are unchanged, and audit A's primary render
  is still the engine default measurement. `AUDIT_FONT_HOST` selects the model (`gallery` default, `node-auto`, `office-only`,
  or `strict`, the pre-FF-48 behaviour, kept as a diagnostic: it reproduces the earlier classes and reasons exactly on the same
  heads). `results.json` records the model (`fontHost`) and `support-status.json` carries it as `audits.<a|b|parity>.fontHost`.
  `node --test scripts/font-availability.test.mjs` (in `parity/`) covers the policy rules: a replacement with the selected name
  passes, and an unrouted fallback, a missing face, a written replacement name and a family with no policy row still fail.

- **Table frames (FF-39, 2026-09-29).** A PPTX table frame is compared with the
  preview's drawn table (`scripts/table-box.mjs`: the union of the table's cell
  rectangles), not with the composed allocation box, because PowerPoint derives a
  table's height from its rows and a table can be shorter than its allocation.
  Chart, picture and card frames still use the composed box. The tolerance is
  unchanged. `node --test scripts/table-box.test.mjs` covers it. The run is
  `parity-results-2026-09-29-table-drawn-extent.json`, and
  `build-support-status.mjs` reads it by default; the rationale and the
  before/after are in [gallery-support.md](../gallery-support.md).

- **Intos default (FF-31, 2026-09-29).** `parity-results-2026-09-29-intos-default.json` is the run on the merged mains after opf-render#54 (Intos previews Aptos as metric): 660 perfect, 33 near, 157 mismatch of 850. The instrument is unchanged. `build-support-status.mjs` reads it by default; the before/after is in [gallery-support.md](../gallery-support.md).

- **Chart series colours (FF-38, 2026-09-30).** A native chart series is compared as its construct paints it, not as its first
  `srgbClr`. A line-kind series (`c:lineChart`, and `c:radarChart` except `radarStyle` filled) is a stroke: the series `a:ln` fill
  against the strokes of the preview's series polylines and paths (traced to `data.columns`; axes, rings and gridlines are not
  series). A pie or doughnut series has one colour per slice: the `c:dPt` fills, not the 0.75 pt `F9F9F9` line PptxGenJS writes on
  the series, which is the slice border. Every other series is still its first fill. No tolerance changed. On the same heads of all
  four repositories the harness as merged scored 700 perfect, 48 near, 102 mismatch, and with this change 703, 51, 96 (charts 3 to 5
  perfect, 12 to 7 mismatch, blocks 20 to 21 perfect). Only the fixed run is committed
  (`parity-results-2026-09-30-charts-measured.json`).
- **Slide-number fields (owner default 2026-09-30).** A native slide-number field plus its adjacent literal text runs counts as one
  run when the combined line text equals the preview text (`{current} / {total}` is `<a:fld>2</a:fld><a:r> / 2</a:r>`, `A-{current}` is
  a literal run then the field), so `slide-number-progress` and `appendix-numbering` are perfect instead of near. Per-character
  family, size, bold, italic and colour were already compared, so only the run count is folded (`logicalRunCount` in
  `scripts/pptx-runs.mjs`, covered by `pptx-runs.test.mjs`). Date fields are not folded. With this change 703, 51, 96 becomes 707,
  47, 96.

### Slide-image mapping (FF-26)

opf-pptx exports `design.slideImage` as one native picture named
`OPF slide image slides.N`. `parity.mjs` maps that picture by name to the
preview's slide-image group, keyed by the resolved
`geometry.slideImage.sourcePath` (`slides.N.design.slideImage`, or the slide's
own image path when a deck-level slide image uses it). The frame check
compares the picture's visible image rect with the preview `<image>` at the
usual 0.02 pt tolerance. The visible rect is the picture frame widened by
its `a:srcRect` insets and clipped to the frame, so a negative inset (a fit
image letterboxed in its frame) compares as the image the preview shows. A
slide-image picture on a slide whose preview has no slide image fails
mapping, and so does a preview slide image with no picture.

Every picture also gets a crop-position check. A positive crop
always leaves the visible rect equal to the frame, so the frame check alone
cannot tell `l=25000 r=25000` from `l=50000 r=0`. The harness takes the full
image rect (the frame widened by `a:srcRect`) and the preview's placed image
(the `<image>` viewport with `preserveAspectRatio` applied to the intrinsic
size), and measures how far the image content shown at the visible edges is
displaced between them. That displacement must be within the same 0.02 pt.
It is measured at the visible edges rather than at the clipped-away image
edges, where `a:srcRect`'s 1/100000 quantization is magnified by the crop
ratio. Any NaN or infinite coordinate or delta, including a crop with
`l+r` or `t+b` of 100000 or more, fails geometry, harness-wide.

The check needs the preview image's intrinsic size, read from its data URI:
PNG, GIF, JPEG (after EXIF orientation), WebP, or SVG (`width`/`height`, else
`viewBox`). `preserveAspectRatio="none"` needs no size. When the size is
unknown (an external `href` or an unreadable image) the check is not skipped:
the picture gets a near `picture crop unmeasured (preview image size
unknown)`, and `meta.cropCheck` in `parity-results.json` counts pictures,
measured and unmeasured (425, 425 and 0 in the current run). The picture frame
check uses the same placed image, clipped to the `<image>` viewport, so a
`meet` image is compared at its `preserveAspectRatio` alignment.

The gallery snippets no longer express image treatments with `design.slideImage`
(pptx-gallery#44). Until 2026-09-30 audit A's image-treatment probe measured
only that field, could not classify the merged snippets, and kept the September 23
rows. It now measures the snippet's actual design output
(`audit-a/scripts/image-treatment.mjs`, below); the slide-image geometry and
crop stay parity checks (the frame and crop of every picture at 0.02 pt).

### Watermark and furniture pictures (2026-09-29)

Two more native pictures are mapped to the preview image that carries the same
design path. `design.watermark` exports as one picture named `OPF watermark`
(opf-pptx#104); it maps by name to the preview `design.watermark` group, its
frame and crop are compared at 0.02 pt like any picture, and the harness also
checks that the preview `<g opacity>` around the watermark equals the picture's
`a:alphaModFix` amount (within 0.005). A header or footer image exports as
`OPF image N` inside the furniture slot; it maps to the preview
`design.header|footer.<slot>.image` whose viewport holds the picture's centre.
Before this mapping such pictures were unmapped (near) or, with a preview image
and no mapped shape, a mapping failure, which the merged snippets (which now
include the watermark and the footer logo) turned into false mismatches.

### Audit A and the gallery contract (2026-09-29)

Audit A's expectations follow the gallery's snippets instead of assuming the
September 23 builder: asset references are checked against the snippet's own
`assets` (`missingAssets`), the pattern check compares the exported `prst` with
the snippet's preset, the headers/footers probe measures the slide that shows
the furniture (the gallery title slide hides it), checks that a fixed date's formatted text is in the export (only a current date, `date: true`, needs a
native field) and decides which gallery settings the snippet expresses from
the snippet itself, and the editor path is
the gallery's per-item builder (`buildCatalogItemOpfSnippet`, pptx-gallery#48),
compared with the published snippet (`editorMatchesSnippet`).

### Audit A image treatments (owner default 2026-09-30)

`works` for a composed image treatment means: the treatment's actual design output, as the gallery snippet emits it
(a layout image, image blocks, an image slide background, `design.watermark`, `imageFill`), is written natively into the PPTX
and re-imports. `audit-a/scripts/image-treatment.mjs` starts from what the snippet emits:

1. the snippet declares N image references (an `image` object, an `asset:` string or the watermark, resolved to its bytes) and
   the traced preview draws N images;
2. the slide has N native image references (`p:pic`, the `a:blipFill` of the slide background, or of the layout or master
   background it inherits), each resolving to an image part, with the preview's image bytes (hash multiset);
3. `design.watermark` is the picture named `OPF watermark` with `a:alphaModFix` equal to its opacity, and an image background's
   opacity is the `a:alphaModFix` of its blip;
4. `fromPptx` returns the same number of images with the same bytes and keeps `design.watermark`, the image background (with its
   opacity) and `design.imageFill` where the snippet set them. A re-import diagnostic is recorded (`checks.reimport.diagnostics`,
   for example `unsupported-image-crop`) but does not make a retained treatment partial; a lost item does, diagnostic or not.

Frames and crops are the parity audit's checks. A treatment OPF v1 cannot express (mask, blur, duotone, device frame) is
still `works` when its emitted composition is native: the gallery's own label (`native`, `composed`, `gap`) and gap note stay in
the item's `gallery` block in `audit-a/results.json` and on the gallery page, and the support table lists it. The
snippet-distinctness check compares whole documents (not only `design`), the editor check compares the per-item editor builder
with the snippet (`editorMatchesSnippet`), and `image-treatment.test.mjs` holds negative controls (a missing picture, other
bytes, an unresolved relationship, a wrong opacity, a lost image, background or watermark).

### Audit B charts (2026-09-30)

Audit B measures the gallery's published chart snippet for every kept chart id (`audit-b/scripts/audit.mjs`, "Charts"). Preview:
the traced SVG has a group whose `data-opf-chart` equals the id, no "No chart data" and no legacy single-series sketch, and its
marks match the data (bars: rows x series; lines: one polyline per series and one circle per point with markers; areas and
radar: one path per series; pie and doughnut: one slice per positive value; scatter: one circle per point). Export: exactly one
chart part whose element, `barDir`, `grouping`, marker, `radarStyle` and `scatterStyle` equal the core catalog record's
`mappings.openxml`, with the data in its caches, an embedded workbook and no `chart-data-adapted` diagnostic. Re-import: the same
chart id and data. A chartex id (treemap, histogram, pareto, world, box-and-whisker, waterfall, funnel) has no classic construct
in the exporter or the renderer: the audit records the legacy preview, the clustered-column fallback with its `chart-data-adapted`
(`chartex-fallback`) diagnostic and the `column` that re-import returns, and classifies it `partial`. It is not `preview-only`
(the preview draws no chartex construct either).

## `support-status.json`

Schema version 1. Top level:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1`. Bump on any incompatible change. |
| `definitions` | Where the status legend lives (`gallery-support.md#status-legend`). |
| `parityDefinitions` | Where the parity checks are defined (`gallery-support.md#parity-scoreboard`). |
| `sectionAnchors` | `{dimension: anchor}` for the per-dimension sections of `gallery-support.md`; see the map below. |
| `statuses` | The allowed `status` values: `works`, `partial`, `schema-only`, `authoring-metadata`, `broken`, `gallery-only`. |
| `parityStatuses` | The allowed `parity.status` values: `perfect`, `near`, `mismatch`. |
| `audits` | Per audit (`a`, `b`, `parity`): measured dimensions or checks, `heads` (7-character commits plus Node), the source results file and `fontHost` (the preview font host model the audit classified against: `gallery`, or `strict` for the results before FF-48). `parity` also records tolerances, the record count (850), `withAssetsRecords` (31) and `parityOnlyValues` (0). |
| `notMeasured` | Dimensions without a presence status. Empty since 2026-09-30 (audit B probes the charts); the field stays for consumers. |
| `sharedExportGaps` | Gaps that apply to every exported value. |
| `counts` | Presence: `{dimension: {status: n}}`. |
| `parityCounts` | Parity: `{total, perfect, near, mismatch, checksPassed: {check: n}}` over all parity records (850 since the 2026-09-29 re-measure). |
| `items` | One record per presence-audited gallery value (819: 793 and the 26 charts), below. |
| `parityOnly` | Values measured only by parity, as `{dimension, galleryId, galleryIdNormalized?, parity}`; `galleryIdNormalized` is `{fromParts, joiner, to, reason}`. Empty since 2026-09-30: the 26 charts are items. |

The parity audit has 31 records that are not presence items: the `withAssets`
variants (backgrounds 6, image treatments 15, headers/footers 10), attached to
their item as `parity.variants.withAssets`. Before 2026-09-30 the 26 charts
were a further 26 records in `parityOnly`; they are now items with a presence
status.

Each item:

| Field | Type | Meaning |
| --- | --- | --- |
| `dimension` | string | Gallery dimension: `layouts`, `blocks`, `image-treatments`, `backgrounds`, `headers-footers`, `color-schemes`, `font-schemes`, `languages`, `themes`, `narratives`, `audiences`, `tones`, `socials`. |
| `subset` | string, optional | `legacy` for the gallery's inlined legacy font schemes. |
| `galleryId` | string | The gallery route slug. |
| `opfId` | string or null | The OPF id the snippet references. `null` for legacy layout slugs and for dimensions without an OPF catalog (backgrounds, image treatments, headers/footers, content blocks). |
| `inCoreCatalog` | boolean or null | Whether `opfId` is a record in the core bundled catalog at the measured head. `null` when not applicable. |
| `status` | string | One of `statuses`. |
| `measuredStatus` | string or null | For `gallery-only` layouts, the class the engines measured. |
| `withAssetsStatus` | string or null | Audit A class when the snippet's missing `asset:*` is supplied. |
| `previewOnly` | boolean or null | Audit A: the preview shows the value but the export has no native equivalent. `null` for audit B. |
| `opfValue` | object or null | Audit A: the OPF value the snippet emits for the dimension (for example the background or `slideImage`). |
| `reasons` | string[] | The audit's reasons, verbatim. Empty for `works`. |
| `audit` | `a` or `b` | Which audit measured it. |
| `measuredHeads` | object | Commits the presence record was measured at. |
| `parity` | object | FF-38 result for the published snippet: `status` (`perfect`, `near` or `mismatch`), `failedChecks[]`, `nearChecks[]`, and `topReasons[]` (up to five failing `check \| reason` strings, most frequent first). It has an optional `variants.withAssets` with the same shape. Heads are in `audits.parity.heads`. |

This file is internal (owner decision 2026-09-30): pptx.gallery does not display it, and no public site may show measured, pending or parity status. Internal consumers must key on
`dimension` + `galleryId`, read `status` (and `previewOnly` if they show a
preview-only badge) and `parity.status`, and link the definitions rather than
restating them.

### Section anchors

Link a dimension to its section as
`gallery-support.md#<anchor>`. The same map is in `sectionAnchors`:

| Dimension | Anchor |
| --- | --- |
| `layouts` | `#layouts` |
| `color-schemes` | `#color-schemes` |
| `font-schemes` | `#font-schemes` |
| `languages` | `#languages` |
| `backgrounds` | `#backgrounds` |
| `narratives` | `#narratives` |
| `charts` | `#charts` |
| `themes` | `#themes` |
| `audiences` | `#audiences` |
| `tones` | `#tones` |
| `socials` | `#socials` |
| `headers-footers` | `#headers-and-footers` |
| `blocks` | `#content-blocks` |
| `image-treatments` | `#image-treatments` |

Other anchors are `#status-legend` (presence statuses),
`#parity-scoreboard` (parity checks) and `#universal-blockers`.
