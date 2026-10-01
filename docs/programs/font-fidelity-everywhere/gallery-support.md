# pptx.gallery support by dimension (FF-23)

Presence and parity re-measured 2026-09-30 on the published set with opf-render 0.11.4, and with both presence audits modelling the gallery editor's font host and the owner font policy ([below](#audits-model-the-shipped-font-host-ff-48-2026-09-30)); parity with the harness modelling that host ([below](#gallery-font-host-model-2026-09-30)); the charts measured and three owner defaults applied ([below](#charts-measured-and-owner-defaults-2026-09-30)); the 2026-09-29 measurement stays below as history. Program: [README.md](README.md). Tracker:
[burndown.md](burndown.md). Audit scripts, raw results and the per-item
machine-readable file: [gallery-support/](gallery-support/README.md).

Internal record (owner decision 2026-09-30): this measurement is not shown on pptx.gallery, and the gallery displays no support or progress status.

This page records what a developer actually gets today when they take a
pptx.gallery value's "OPF Config" snippet and run it through the OpenPresentation
packages. It measures the engines, not the schema: a value that validates but
changes nothing in the preview or the PPTX is not reported as working.

**Latest measurement (2026-09-30, FF-56 on the published set with opf-pptx 0.11.6): 818 of 819 values `works` by presence (812 before), 734 of 850 perfect by parity, 116 near, 0 mismatch**
(core `2e838f5` (0.11.3), opf-render 0.11.8 `0ce9bb9`, opf-pptx 0.11.6 `e4c0c4b`, pptx-gallery `9e8d59a`; [PARITY-2026-09-30-published-pptx-0.11.6.md](gallery-support/parity/PARITY-2026-09-30-published-pptx-0.11.6.md)). opf-pptx 0.11.6 exports the treemap, histogram, pareto, box-and-whisker, waterfall and funnel as native chartex parts by default (`chartex: 'auto'`, native check in opf#222), and audit B and the parity harness now read the `chartEx` Choice part (opf#223), with real mark checks per kind. Charts are 25 of 26 `works`; the one that is not is the `world` map, an accepted limitation (agent decision, vetoable): PowerPoint draws a map chart only with online geodata (an accepted `cx:regionMap` with no `cx:geoCache` shows "There was a problem getting the information for your map chart" and draws nothing, native evidence in opf#222), so `toPptx` keeps it on the clustered column fallback with `chart-data-adapted` (`chartex-fallback`); no provider data is fabricated. Every other dimension is 100%. Parity has no mismatch left (the `histogram` cache mismatch is gone); six chartex values are near because the part's text is 9 pt where the preview draws 12 pt (FF-62).

**Previous measurement (2026-09-30, FF-58 goal closure, published set with opf-render 0.11.6): 812 of 819 values `works` by presence (431 before), 685 of 850 perfect by parity, 161 near, 4 mismatch**
(core `2e838f5` (package 0.11.3), opf-render 0.11.6 `b7e62ef`, opf-pptx 0.11.4 `c08105f`, opf-editor 0.10.4 `1529f26`, pptx-gallery `edb77b2`; audit B also ran with the editor). Every dimension is 100% `works` except the charts: the 7 chartex charts (FF-56, native PowerPoint check pending) are the 7 that are not. Details, the instrument change and every remaining reason
are in ["Goal closure on the published set"](#goal-closure-on-the-published-set-ff-58-2026-09-30) below.

**Parity on the published set with the tag fix (2026-09-30, FF-59 and FF-60): 738 of 850 perfect, 111 near, 1 mismatch** (core `2e838f5` (0.11.3), opf-render 0.11.8 `0ce9bb9`, opf-pptx 0.11.5 `da6a879`, pptx-gallery `fa8a965`; [PARITY-2026-09-30-published-0.11.8.md](gallery-support/parity/PARITY-2026-09-30-published-0.11.8.md)). Presence is unchanged at 812 of 819. Measured on the npm packages (renderer 0.11.8 draws the tag in the primary colour, PPTX 0.11.5 writes it as `a:schemeClr accent1`), it reproduces the source-worktree run of opf#218 exactly. The three tag-colour mismatches are gone, 50 Aptos Medium, SemiBold and ExtraBold values are perfect by the face the export selects (FF-60), and the one remaining mismatch is the `histogram` chart cache (FF-56). The 111 near values are 16 chart-label wraps and the visual-only look-alikes (Segoe UI and Segoe UI Semibold with Red Hat Display, Grandview with Barlow, Arial Black with Montserrat, the script families with their Noto faces, Impact with Anton, Sylfaen, Georgia with Gelasio at one weight).

**Previous measurement (2026-09-30, FF-48, published set with opf-render 0.11.4): 431 of 819 values `works` by presence (427 on the same heads with the strict no-host font model), 734 of 850 perfect by parity, 113 near, 3 mismatch**
(core `3e1cbf0` package 0.11.2; opf-render 0.11.4 `1a724a6`; opf-pptx 0.11.3 `ecdbb42`; opf-editor 0.10.2 `c7995ed`; pptx-gallery `59ff36c`). The presence audits now judge font availability against the host that ships and the owner
font policy instead of strict no-host previews: the four themes become `works`, and every font-availability reason of the 93 font schemes and 93 languages clears (92, 93 and 4 values carried one), leaving the reasons FF-49 and FF-50 own
([below](#audits-model-the-shipped-font-host-ff-48-2026-09-30)). Renderer 0.11.4 clears the three parity font mismatches and moves 7 chartex charts from mismatch to 3 perfect and 4 near. No presence or parity value regressed.

Before that (2026-09-30, published set, gallery font host modelled): 729 of 850 values are perfect by parity, 108 near, 13 mismatch
(core `3d51ba1` plus the harness change `26a1d82`; opf-render 0.11.3 `a66caa3`; opf-pptx `6f6122c`; pptx-gallery `1f0e382`; the run before it scored 707, 47 and 96; opf#186 scored 657, 37 and 156).
The 86 font-resolution mismatches were a modelling artifact for 83 values: the harness loaded no script faces, and the gallery editor does. Three real gaps remain
([below](#gallery-font-host-model-2026-09-30)).

Before that, the same day (published set, charts measured): 707 of 850 perfect, 47 near, 96 mismatch
(core `aedd364`, package 0.11.2; opf-render 0.11.3 `a66caa3`; opf-pptx 0.11.2 `0400434`; pptx-gallery `b2238ac`). Presence: 427 of 819 values `works` (379 of 793 before; the 26 charts are now presence items: 19 `works`, 7 `partial`). See
["Charts measured and owner defaults"](#charts-measured-and-owner-defaults-2026-09-30) below.

Earlier (2026-09-29, merged and published heads): 657 of 850 values are perfect by parity, 37 near, 156 mismatch
(core `930577d`, package 0.11.2; opf-render 0.11.2 `021cca0`; opf-pptx 0.11.1 `0d15f1c`; pptx-gallery `0b2dec8`; opf#175 scored 660, 33 and 157). Presence: 379 of 793 values `works` (352 before). See
["Merged and published heads"](#merged-and-published-heads-2026-09-29-audit) below, with the regressions investigated to their causes (all four in the harness or by construction, none in an engine).

Earlier the same day (Intos as the default Aptos preview): 660 of 850 perfect, 33 near, 157 mismatch
(opf `338ddcd`, opf-render `d528be5`, opf-pptx `3c44a40`, pptx-gallery `efb63ac`; the previous mains scored 25 perfect, 667 near, 158 mismatch). See
["Aptos previews with Intos"](#aptos-previews-with-intos-2026-09-29-measurement) below. The accepted-graph headline that follows is the earlier 900-value measurement.

**Headline: 5 of 900 gallery values are perfect by parity** (FF-38, accepted
merged source graph on 2026-09-29; 0 near, 895 mismatch under the old fontResolution definition; 608 near, 287 mismatch under the definition adopted on 2026-09-29, see [below](#fontresolution-definition-change-owner-decision-2026-09-29)). The unchanged full
audit improves the September 23 result from 4 to 5, with no classification
regressions. This graph includes PPTX79 and PPTX81 and core145's FF-04 evidence.
This is the program's progress metric. The 900 values are the 793
presence-audited values plus 107 parity-only records: 76 charts and 31
`withAssets` variants. The presence audits below find 352 of 793 values
`works` (7 at the first measurement). Audit B now resolves theme colours and
classifies languages from measured fields, and audit A detects the native
slide-image picture; see the
[measurement notes](#measurement-notes-2026-09-23-re-run).

Two measurements are recorded here:

- **Presence (audits A and B, FF-23).** Does the value have an effect, in
  native form, and does it survive re-import?
- **Parity (FF-38).** Do the preview and the exported PPTX agree element by
  element?

| Repository | Presence and parity, merged and published heads (September 29 re-run) | Presence audits A and B (September 23) | Accepted parity (September 29) | Previous parity run (opf#122) | Parity baseline (history) |
| --- | --- | --- | --- | --- | --- |
| opf (core) | `930577d` | `1ad25df` | `a85facf` | `c278532` | `53be042` |
| opf-render | `021cca0` (0.11.2) | `bc436f3` | `6c7d781` | `47d19b2` | `e500ed9` |
| opf-pptx | `0d15f1c` (0.11.1) | `9092954` | `c749c35` | `5b657c9` | `cf0bc0c` |
| opf-editor | `4af6ea6` (0.10.1, audit B) | `214ae69` (audit B) | not used | not used | not used |
| pptx-gallery | `0b2dec8` | `f17e9ae` | `f17e9ae` | `f17e9ae` | `f17e9ae` |

Node 24.21.0. No Office or COM was used; native PowerPoint behaviour is
recorded separately (FF-04, FF-12). The presence audits were re-run on the
September 29 merged heads (first column); only the audit A image-treatment
rows keep the September 23 heads (see below). The September 23 heads that the
next paragraphs describe are history.
The accepted source graph includes FF-07, FF-08, FF-17, FF-18, FF-19, FF-24, FF-28,
FF-32, FF-35, FF-35b and FF-39, the merged engine halves of FF-25, FF-26,
FF-27 and FF-34 (opf-pptx#65 included), FF-31's exporter half
(opf-pptx#63) and FF-22's core half. The September 23 parity scoreboard was re-run at opf
`6263985` (opf#139; documentation and harness only since `a74f3f6`) after
the harness learned to map the FF-26 slide-image picture and, since, to fail
non-finite geometry and check crop position; the run before the mapping is
kept at
[parity/history/2026-09-23-opf137/PARITY.md](gallery-support/parity/history/2026-09-23-opf137/PARITY.md).
The presence audits were re-run at opf `33d636d` (documentation and harness
only since `a74f3f6`) with the FF-36 audit probe update; unmodified, they
reproduce the committed `a74f3f6` classes exactly. They were re-run again at
opf `1ad25df` (documentation only since `33d636d`) after the FF-36 audit
hardening, with no class change. pptx-gallery is still `f17e9ae`: none
of its program PRs (#40 to #46) has merged, so every snippet is the
pre-program snippet. The per-dimension prose below the summary
table describes the first measurement unless a paragraph says otherwise.

The accepted local raw receipt is `baseline81-results.json`, generated at
`2026-09-29T08:23:46.429Z`; the committed [results](gallery-support/parity/parity-results.json)
and [scoreboard](gallery-support/parity/PARITY.md) record that run with the
[documented one-slug normalization](gallery-support/README.md#normalized-ids).
Editor `d0c95a1` was refreshed by a dependency-only merge and was not used by
parity. A separate local raw candidate receipt, `candidate78-results.json`
at `2026-09-29T08:30:22.322Z`, uses the same core, renderer and gallery with
[PPTX78](https://github.com/OpenPresentation/opf-pptx/pull/78) head
`7cc779129323af6123ef5e194226a545e743f195`: also 5 perfect, 0 near, 895 mismatch (old fontResolution definition),
with text 798 to 799 and fills 790 to 791 and no classification change.
Candidate CI [36543078806](https://github.com/OpenPresentation/opf-pptx/actions/runs/36543078806)
is pending at this checkpoint. It does not replace the accepted baseline.
PPTX80's old-base caption/fallback findings were reconciled into PPTX78;
PPTX80 was not merged as-is. These are source/package measurements, without
new Office acceptance; FF-29 remains in review and FF-05 remains open.

## Method

Each value uses the exact document the gallery page emits: `lib/opf-snippets.ts`
from pptx-gallery is bundled with esbuild and linked to the local core build.
Two audits split the 14 dimensions.

- **Audit A** (layouts, content blocks, image treatments, backgrounds,
  headers/footers): core `validatePresentation`; catalog and reference
  resolution; opf-render SVG compared with a baseline document without the
  dimension; opf-pptx export with OPC and dimension-specific native XML checks;
  `fromPptx` re-import; docs/evidence hits. Values whose snippet references an
  undeclared `asset:*` id are re-run with a real raster (`withAssets`).
- **Audit B** (color schemes, font schemes, languages, themes, narratives,
  audiences, tones, socials and, since 2026-09-30, the 26 charts): core validate and lint; catalog lookup;
  opf-render in three strict font modes (no registry, the strict bundled base pack,
  and the office pack with visual substitution; diagnostics since FF-48) and against the modelled gallery font host (`gallery`, the
  parity harness's host, which decides font availability; [below](#audits-model-the-shipped-font-host-ff-48-2026-09-30)); opf-pptx export with a
  full-package inventory (every `typeface=`, script fonts, `lang`/`rtl`, theme
  `clrScheme`, slide colours, `app.xml`); re-import; and for metadata
  dimensions a consumption diff (field removed, SVG and every PPTX part compared
  byte for byte). Charts: a traced preview (the chart id and its marks against
  the data), the native chart part against the core catalog's `mappings.openxml`,
  and a same-id re-import.
- **Parity (FF-38)** covers every dimension, charts included. It renders the
  traced preview (`renderSvgDeck` with `trace: true`, plus
  `resolvePresentation` geometry) and exports with `toPptx` (default options,
  no registry). It maps PPTX shapes to preview items, first by the exporter's
  stable object names and otherwise by geometric containment, then compares
  them check by check. Scripts and results are in
  [gallery-support/parity/](gallery-support/parity/PARITY.md).

## Parity scoreboard

A value is **perfect** when every check passes, **near** when the only
failures are near deltas, and **mismatch** when at least one check fails. The
checks are:

| Check | Passes when |
| --- | --- |
| geometry | Text-line anchors and baselines are within 0.02 pt; chart, picture and card frames equal the composed box within 0.02 pt; a table frame equals the preview's drawn table, the union of its cell rectangles, within 0.02 pt (since 2026-09-29; see "Table frames and the drawn table" below); a picture's crop places the image content where the preview does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt are near; a non-finite delta fails. |
| text | Same line text and run segmentation. Per run: the same family in the script slot the text uses (`latin`/`ea`/`cs`), size within 0.005 pt, bold, italic and resolved colour. Also the same paragraph alignment and list markers. Native charts: preview labels are in the chart caches, the chart XML names the preview font, and each text role the preview draws (axis, data labels, legend, title) has the same size in the chart part's same role (FF-62; not "any size in the part"). |
| fills | Same background kind and colour; per element group, the same solid fill colours and the same images (sha256); chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in `spTree` matches the SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part, charts and embedded workbooks included, and every font in `app.xml` is a family the preview uses. Theme per-script supplements are reported but not gated. |
| reimport | `fromPptx` preserves color scheme, font scheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic is near; a silent loss fails. |
| fontResolution | Since the owner decision of 2026-09-29, for every family the selected design uses: **pass** when the PPTX names the selected family (theme major/minor for the heading and body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table's metric-compatible replacement; **near** when the PPTX names the selected family and the preview draws the policy table's route for it at the visual look-alike tier only ("visual-only replacement"); **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table's route, or the PPTX writes a replacement name instead of the selected one. Before that decision: every family the preview uses resolved, in the office pack with visual substitution, to the real face or a metric-compatible substitute (the September 23 and earlier rows below use this). |
| theme | Theme major/minor `latin` equal the preview heading/body fonts, and the theme `clrScheme` equals the document color scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse; an unmapped PPTX shape is near. |

Checks passed, all 900 values (accepted merged graph, 2026-09-29), with the
run before the slide-image mapping (opf#137) and the opf#122 run for
comparison:

| Run | perfect | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Published set with native chartex (September 30, FF-56; core `2e838f5` (0.11.3), opf-render 0.11.8 `0ce9bb9`, opf-pptx 0.11.6 `e4c0c4b`, pptx-gallery `9e8d59a`) | 734 (116 near, 0 mismatch) | 850 | 831 | 850 | 850 | 850 | 850 | 850 | 757 pass, 93 near, 0 fail | 850 | 850 |
| Published set with the tag colour and the weight-face rule (September 30, FF-59 and FF-60 on the published packages; core `2e838f5` (0.11.3), opf-render 0.11.8 `0ce9bb9`, opf-pptx 0.11.5 `da6a879`, pptx-gallery `fa8a965`) | 738 (111 near, 1 mismatch) | 850 | 831 | 850 | 850 | 850 | 850 | 850 | 757 pass, 93 near, 0 fail | 850 | 850 |
| Published set (September 30, FF-58, renderer 0.11.6, PPTX 0.11.4, core 0.11.3; core `2e838f5`, opf-render `b7e62ef`, opf-pptx `c08105f`, pptx-gallery `edb77b2`) | 685 (161 near, 4 mismatch) | 850 | 828 | 850 | 850 | 850 | 850 | 850 | 707 pass, 143 near, 0 fail | 850 | 850 |
| Gallery font host modelled (September 30, harness change; core `3d51ba1` plus `26a1d82`, opf-render `a66caa3`, opf-pptx `6f6122c`, pptx-gallery `1f0e382`) | 729 (108 near, 13 mismatch) | 850 | 824 | 850 | 850 | 850 | 850 | 850 | 755 pass, 92 near, 3 fail | 850 | 850 |
| Published set, charts measured (September 30, chart series colours and slide-number fields; core `aedd364`, opf-render `a66caa3`, opf-pptx `0400434`, pptx-gallery `b2238ac`) | 707 (47 near, 96 mismatch) | 850 | 824 | 850 | 850 | 850 | 850 | 850 | 733 pass, 31 near, 86 fail | 850 | 850 |
| Merged and published heads (September 29, watermark and furniture-picture mapping; core `930577d`, opf-render `021cca0`, opf-pptx `0d15f1c`, pptx-gallery `0b2dec8`) | 657 (37 near, 156 mismatch) | 850 | 826 | 783 | 850 | 850 | 850 | 850 | 733 pass, 31 near, 86 fail | 850 | 850 |
| Same heads, harness as merged before this run | 653 (37 near, 160 mismatch) | 848 | 826 | 781 | 848 | 850 | 850 | 850 | 733 pass, 31 near, 86 fail | 850 | 846 |
| Intos previews Aptos (September 29, first run on the merged FF-31 mains; opf `338ddcd`, opf-render `d528be5`, opf-pptx `3c44a40`, pptx-gallery `efb63ac`) | 660 (33 near, 157 mismatch) | 850 | 830 | 782 | 850 | 850 | 850 | 849 | 733 pass, 31 near, 86 fail | 850 | 850 |
| Same harness, previous mains (before opf-render#54; opf `89eb735`, opf-render `e016f4e`, opf-pptx `06e4843`, pptx-gallery `a08718e`) | 25 (667 near, 158 mismatch) | 850 | 830 | 782 | 850 | 850 | 850 | 849 | 28 pass, 735 near, 87 fail | 850 | 850 |
| Table frames compared with the drawn table (September 29, harness change; opf `b1fdfa7`, opf-render `762dbb9`, opf-pptx `874d9e9`, pptx-gallery `5963702`) | 5 (627 near, 218 mismatch) | 850 | 805 | 782 | 830 | 850 | 850 | 849 | 5 pass, 741 near, 104 fail | 850 | 840 |
| Same heads, old table check (composed box) | 5 (608 near, 237 mismatch) | 830 | 805 | 782 | 830 | 850 | 850 | 849 | 5 pass, 741 near, 104 fail | 850 | 840 |
| New table check with opf-pptx#93 (`844e9e6`, furniture paints last; other heads as above) | 5 (647 near, 198 mismatch) | 850 | 805 | 782 | 850 | 850 | 850 | 849 | 5 pass, 741 near, 104 fail | 850 | 840 |
| Field text counted, 850-value set (September 29, after pptx-gallery#40 and a harness fix; opf `03a55ae`, opf-render `aa7e898`, opf-pptx `ca34da7`, pptx-gallery `23f9216`) | 5 (608 near, 237 mismatch) | 830 | 805 | 782 | 830 | 850 | 850 | 849 | 5 pass, 741 near, 104 fail | 850 | 840 |
| Look-alike fonts accepted, new fontResolution definition (September 29, owner decision 2026-09-29; opf `401f2e3`, opf-render `c62b3f9`, opf-pptx `54f7e4c`, pptx-gallery `4b48e69`) | 5 (608 near, 287 mismatch) | 880 | 800 | 791 | 880 | 900 | 900 | 899 | 5 pass, 791 near, 104 fail | 900 | 890 |
| Same run, old fontResolution definition | 5 (0 near, 895 mismatch) | 880 | 800 | 791 | 880 | 900 | 900 | 899 | 5 | 900 | 890 |
| Accepted merged graph (September 29) | 5 | 880 | 798 | 790 | 880 | 900 | 900 | 899 | 5 | 900 | 890 |
| Previous scoreboard (September 23) | 4 | 880 | 759 | 766 | 880 | 900 | 900 | 899 | 5 | 900 | 890 |
| Before slide-image mapping (opf#137) | 4 | 774 | 759 | 674 | 784 | 900 | 900 | 899 | 5 | 900 | 672 |
| Previous (opf#122) | 0 | 390 | 326 | 734 | 880 | 900 | 0 | 0 | 5 | 900 | 890 |

#### fontResolution definition change (owner decision, 2026-09-29)

The first two rows above are one run, measured on the merged heads listed in
the row, and differ only in how fontResolution is judged. The owner decided on
2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing
restrictions. They are desirable for open source but if we export to PowerPoint
the pptx file should include references to the font they selected and want to
see in PowerPoint." Later the same day (verbatim): "if the user wants Aptos...
if Aptos is license restricted we can substitute a font (Aptos2 or whatever
it's named) that looks similar and has the same size in pixels on the screen
for rendering live previews of SVG. When we export to PPTX we should have
PowerPoint open that file and display actual Aptos." So a look-alike preview
font is intended, the PPTX must name the selected family and never the
replacement, and the target look-alike is metric-compatible. The check now
takes its routes from core's FF-31 font policy table (the listed replacement,
or a listed alternate when the replacement is not loaded in the preview):
metric-compatible passes, visual-only is near, and a family with no route, a
face that is not the table's route, or a PPTX that writes a replacement name
fails. No tolerance and no other check changed; the same run under the old
definition is stored per value (`results[].legacy`), and every other check
count is identical under both.

Under the new definition 791 values are near only because of visual-only
replacements (Aptos to Roboto and Aptos Display to Carlito for 754 values, then
27 families in all; the list is in [the run's scoreboard](gallery-support/parity/PARITY-2026-09-29-lookalike-fonts.md#selected-families-with-only-a-visual-only-replacement-near)),
and the 104 fontResolution failures are all faces the modelled preview does
not load (the office pack without script packs): Noto and other script
replacements that the `scripts` pack bundles (85 values), and open families no
pack bundles (Open Sans, Montserrat, Poppins, Raleway, PT Serif, Playfair
Display, Bebas Neue, Lora, Merriweather Sans, Source Sans Pro: 19 values, some
with a script-pack family as well). No value fails because the PPTX names a
replacement. Head drift since the earlier accepted run (opf-pptx, opf-render,
core) moves text 798 to 800 and fills 790 to 791; that is not part of this
change. pptx-gallery `origin/main` moved to `23f9216` (FF-22, reduced charts)
after the audited `4b48e69` and is not measured here. Results:
[parity-results-2026-09-29-lookalike-fonts.json](gallery-support/parity/parity-results-2026-09-29-lookalike-fonts.json),
[scoreboard](gallery-support/parity/PARITY-2026-09-29-lookalike-fonts.md).
The earlier accepted results and scoreboard are kept unchanged.

#### Field text and the 850-value set (2026-09-29 re-measure)

The first row of the table above is a later run on the current mains of all four
repositories (opf `03a55ae`, opf-render `aa7e898`, opf-pptx `ca34da7`,
pptx-gallery `23f9216`). Two things changed against the look-alike row, and a third was checked.

- **Value set: 900 to 850.** pptx-gallery#40 (FF-22) reduced the charts from 76
  to the 26 Aspose.Slides-supported types, so the 900 values are now 850 (793
  presence-audited values, 26 charts and 31 `withAssets` variants). The
  50 removed charts were all mismatches and passed geometry, zOrder, slideSize,
  typefaces, reimport, theme and mapping (15 passed text, 9 passed fills), so
  those passing counts fall by 50, 15 and 9: a change of denominator, not a
  regression. The presence audits A and B still measure the earlier gallery heads.
- **Instrument fix: field text.** The harness read PPTX text runs with
  `<a:(r|fld)>`, which never matches `<a:fld id="{...}" type="slidenum">`, so the
  slide-number and date text ("1") of the 20 header and footer values (10, and 10
  `withAssets`) was reported missing from the PPTX. It now uses
  `parity/scripts/pptx-runs.mjs` (`<a:(r|fld)\b[^>]*>`, unit-tested in
  `pptx-runs.test.mjs`). Run on the same four heads, the old and the fixed harness
  differ in exactly those 20 values: text fails 20 fewer (785 to 805 passing of
  850), and every other check and every classification is identical (5 perfect, 608
  near, 237 mismatch both times). The 20 values stay mismatches: zOrder still
  fails for all 20 (z-order inversions between element groups) and fontResolution is
  near.
- **Script font pack: not modelled, a product gap.** The modelled preview host
  still loads the office pack with visual substitution and no `scripts` pack, so
  the 85 fontResolution failures that need Noto script faces stay failures. The
  shipped previews do the same: the opf-editor playground that pptx.gallery embeds
  builds its registry with `loadOfficeFontRegistry()` (33 faces of 11 open
  families, no Noto), the gallery layout thumbnails use no registry, and
  opf-render never loads the script pack by itself (a host has to pass
  `scripts`, for example from `detectScripts(presentation)`; no shipped host
  does). For scale, an exploratory run of the same heads with `scripts: 'all'`
  gives 29 perfect, 669 near, 152 mismatch (24 fontResolution fail to pass, 61 to
  near; nothing else changes). It is not on the scoreboard.

Results:
[parity-results-2026-09-29-field-text.json](gallery-support/parity/parity-results-2026-09-29-field-text.json),
[scoreboard](gallery-support/parity/PARITY-2026-09-29-field-text.md) (the
before/after in it compares against the old harness at the same heads; that
baseline run is not committed). `support-status.json` is rebuilt from this run.

#### Aptos previews with Intos (2026-09-29 measurement)

opf-render#54 makes Intos (metric-compatible with Aptos, Aptos Display, Aptos Narrow and Aptos Serif) the default Aptos preview, and core#166 records that in the policy table. The instrument is unchanged: the same harness (`parity/scripts`), all engines on one local core through `register-local-opf`, the 850-value set, current mains for core, renderer, exporter and gallery. Same harness, before and after the two merges:

| | perfect | near | mismatch | fontResolution pass | near | fail |
| --- | --- | --- | --- | --- | --- | --- |
| Previous mains (opf-render `e016f4e`) | 25 | 667 | 158 | 28 | 735 | 87 |
| Current mains (opf-render `d528be5`) | 660 | 33 | 157 | 733 | 31 | 86 |

Checks passed of 850 (pass/near/fail where not all pass): geometry 850, text 830 (6 near, 14 fail), fills 782 (68 fail), zOrder 850, slideSize 850, typefaces 850, reimport 849 (1 near), fontResolution 733 (31 near, 86 fail), theme 850, mapping 850. Only fontResolution changed between the two runs: 705 values move from near (Aptos Display to Carlito, Aptos to Roboto, visual look-alikes) to pass (Intos, metric), and one value's failure clears. No other check and no value regresses. The remaining near values are visual-only replacements (Segoe UI, Grandview, Arial Black, Impact) and native chart labels; the 157 mismatches are unchanged causes (chart series colours and caches, families whose script faces the preview does not load (Arabic and East Asian among them), one Playfair Display legacy value).

Results: [parity-results-2026-09-29-intos-default.json](gallery-support/parity/parity-results-2026-09-29-intos-default.json), [scoreboard](gallery-support/parity/PARITY-2026-09-29-intos-default.md) (before/after against the previous-mains run, which is not committed). `support-status.json` is rebuilt from this run.

#### Audits model the shipped font host (FF-48, 2026-09-30)

**The problem.** Audits A and B judged preview font availability with strict no-host previews: audit B rendered every value with no registry, with the strict bundled base
pack and with the office pack, and called a value `partial` when the base pack could not draw it or when the office pack drew a replacement ("preview needs
office-pack substitution ... export writes <selected>"). No shipped host renders that way, and the owner font policy (2026-09-29; [README](README.md#next-goal-every-gallery-config-works-100))
says a preview that draws the FF-31 policy table's look-alike while the PPTX names the family the user selected is correct. The parity harness already models the
host (`PARITY_FONT_HOST=gallery`, FF-38); the presence audits did not.

**The change (instrument only).** Both audits use the parity harness's host model, unchanged: the gallery editor's browser registry and its font gate
(`ensureLazyFonts` and `ensureScripts` on the value's own document, the same package files) from `parity/scripts/font-host.mjs`, then the FF-38 fontResolution
verdict per selected family and the strict measured render with that registry, now in `parity/scripts/font-availability.mjs` (shared with `parity.mjs`, whose results are
byte-identical before and after the extraction). Audit B classifies font schemes, themes and languages from that verdict, and adds a host probe to the non-Latin
text sample and to each language's native name. A family that resolves to its policy route (metric or visual-only) while the PPTX names the selected family is not a
reason. A reason remains only when the family has no policy row, the host has no face or draws an unrouted fallback (Roboto for Raleway), the PPTX writes the
replacement name or does not name the selected family, or the host cannot draw the value (missing glyph or face, `font-shaping-failed`). Audit A's font probe asks the same
host and, for the first time, makes a value `partial` when the host cannot draw it (none is). No tolerance, export, re-import, geometry, text, colour or `ea`/`cs` check
changes, and audit A's primary render is still the engine default measurement. `AUDIT_FONT_HOST=strict` classifies from the strict measurements instead and reproduces
the earlier classes and reasons exactly on the same heads (271 audit B and 548 audit A values, no difference); `office-only` (no script faces) is a negative control.
See [gallery-support/README.md](gallery-support/README.md) for the run commands and `font-availability.test.mjs` for the rules.

**Measured four ways** (audit B, published packages; `works` and the value counts carrying a font-availability reason):

| | before: committed results (strict; core `aedd364`, opf-render 0.11.3, opf-pptx 0.11.2, pptx-gallery `b2238ac`) | strict, on the new heads (core `3e1cbf0`, opf-render 0.11.4, opf-pptx 0.11.3, pptx-gallery `59ff36c`) | gallery host, on the old heads | gallery host, on the new heads (committed) |
| --- | --- | --- | --- | --- |
| **Themes `works`** | 0 of 4 | 0 of 4 | 4 of 4 | **4 of 4** |
| themes with a font reason (office-pack substitution) | 4 | 4 | 0 | 0 |
| **Font schemes `works`** (93) | 0 | 0 | 0 | **0** (the ea/cs reason of FF-49 remains for all 93) |
| font schemes with a font-availability reason | 92 | 92 | 3 | 0 |
| ... "no bundled or substitute face: strict preview throws font-unavailable" | 61 | 59 | 0 | 0 |
| ... "non-Latin textSample: strict font-unavailable" | 60 | 60 | 1 (host: font-shaping-failed, Noto Sans Mongolian) | 0 |
| ... "preview needs office-pack substitution ... export writes <selected>" | 31 | 33 | 0 | 0 |
| ... host reasons (a real gap; see below) | 0 | 0 | 3 (one also in the row above) | 0 |
| **Languages `works`** (93) | 0 | 0 | 0 | **0** (the reason of FF-50 remains for all 93) |
| languages with a font-availability reason | 93 | 93 | 0 | 0 |
| ... "language font scheme X not bundled: strict preview" | 93 | 93 | 0 | 0 |
| ... "bundled Roboto lacks the script (missing-glyph)" | 26 | 26 | 0 | 0 |
| **Presence `works` overall** (819) | 427 | 427 | 431 | **431** |

The renderer and exporter bump alone (second column) moves no presence class: it is FF-48 that moves the themes. What is left in font schemes and languages is exactly the work of
FF-49 ("theme major/minor ea or cs typeface is empty": 93 font schemes, and the empty `cs` slot of 2 languages) and FF-50 ("engines do not derive the font scheme from language alone":
93 languages). `pnpm report:works --reasons` shows no other reason in those dimensions.

**Real failures stay real.** On the old heads the gallery host model still reported three gaps, each with its exact reason: `font-schemes/raleway` (host preview: "preview uses an unexpected
fallback face for Raleway: Roboto (not the policy route)"), `font-schemes-legacy/classic-editorial` (the same for Playfair Display) and `font-schemes/noto-sans-mongolian` ("the modelled
host cannot draw this value: font-shaping-failed (Noto Sans Mongolian), Not a fixed size", and the same for its non-Latin text sample). They are the three parity mismatches of the
gallery-font-host run, and opf-render 0.11.4 (#68 bundles Raleway and Playfair Display, #69 lets Noto Sans Mongolian shape) clears them: on the new heads no value has a font-availability
reason. With the `office-only` model (no script faces) 59 font schemes and 27 languages carry one again, so the host probes discriminate.

**Policy-table rows behind the reasons removed.** The four themes (host preview under the gallery model; every one names the selected families in the PPTX):

| theme | selected families | preview draws | policy row (`spec/reference/font-policy.json`) |
| --- | --- | --- | --- |
| `minimal` | Aptos Display, Aptos | Intos Display, Intos | `proprietary-standard`, replacement Intos Display and Intos, `metric` |
| `classic` | Tenorite Display, Tenorite | Figtree | `proprietary-standard`, replacement Figtree, `visual` |
| `dark` | Seaford Display, Seaford | Source Sans 3 | `proprietary-standard`, replacement Source Sans 3, `visual` |
| `bold` | Impact, Grandview | Anton, Barlow | `proprietary-standard`, replacements Anton and Barlow, `visual` |

Across the 93 font schemes the host tier (the worst over a scheme's selected families) is real for 33 (open or Noto families drawn as themselves), metric for 5 and visual-only for 55; each scheme's route is in the `gallery host preview` column
of [audit-b/font-schemes.md](gallery-support/audit-b/font-schemes.md), and the languages' native-name verdicts are in the same column of [audit-b/languages.md](gallery-support/audit-b/languages.md). A visual-only route is `near` in the
FF-38 perfect/near tiers (a separate measure) and `works` here.

**Audit A.** The host draws all 548 values; no class changes (layouts 291 `works`, 124 `partial`, 70 `gallery-only`; the other four dimensions as before). The strict `loadOfficeFontRegistry()`
probe that failed 8 values is now a diagnostic (`AUDIT_FONT_HOST=strict`); it never made a value `partial`.

**Parity.** The same run scores 734 perfect, 113 near, 3 mismatch of 850 (was 729, 108, 13); see [PARITY-2026-09-30-renderer-0.11.4.md](gallery-support/parity/PARITY-2026-09-30-renderer-0.11.4.md).
The audit B chart probe has no mark rule for the chartex kinds, so its "marks match" is vacuous for them; FF-56 defines the chartex checks.

#### Gallery font host model (2026-09-30)

The 86 fontResolution failures of the previous run ("the script faces the modelled preview does not load": 60 font schemes, 1 legacy scheme, 25 languages) came from the
harness, not from the hosts. It resolved every family in one office-pack registry with no script faces, on the reading that no shipped host loads them. The pptx.gallery
editor does: opf-editor 0.10.x builds a browser registry from the office pack's eager faces and its font gate (`createFontGate`, FF-41) runs
`ensureLazyFonts(document)` and `ensureScripts(document)` before every render, and opf-render 0.11.2 (FF-19) makes those load the script faces a font scheme itself names.
`parity/scripts/font-host.mjs` now runs the same calls per value against the same package files (a model of the browser host in Node; no browser draws anything), and
the value must also pass the strict measured render with that registry. No tolerance changed; every other check is identical in every value. `PARITY_FONT_HOST=office-only` reproduces the
previous run exactly (707, 47, 96). Full report, with the per-family table and the before and after by dimension:
[PARITY-2026-09-30-gallery-font-host.md](gallery-support/parity/PARITY-2026-09-30-gallery-font-host.md); results
[parity-results-2026-09-30-gallery-font-host.json](gallery-support/parity/parity-results-2026-09-30-gallery-font-host.json). `support-status.json` is rebuilt from this run (only
the parity fields of 83 values change; presence is untouched), so the pptx.gallery badges need the re-import that follows this change.

| | perfect | near | mismatch | fontResolution pass | near | fail |
| --- | --- | --- | --- | --- | --- | --- |
| Before (office pack, no script faces) | 707 | 47 | 96 | 733 | 31 | 86 |
| Node loader (`scripts: 'auto'`) | 729 | 105 | 16 | 755 | 89 | 6 |
| Gallery editor host (committed) | 729 | 108 | 13 | 755 | 92 | 3 |

Of the 86: 22 values (font schemes whose family is itself a pinned Noto face) are perfect, 61 (proprietary script fonts routed to their Noto replacement, a visual tier) are near, and 3 remain mismatches, all real:
Raleway and Playfair Display are not bundled (the editor draws Roboto; tracker `loading-gap`, FF-43 and FF-41), and the Noto Sans Mongolian face cannot shape any text in fontkit (`font-shaping-failed`; FF-44).
The three Sylfaen values pass in the editor model and fail in Node, where `scripts: 'auto'` leaves Noto Sans fallback-only; the small opf-render change that fixes it is recorded in the report (FF-19, FF-44).

#### Chartex native export and the audits (FF-56, 2026-09-30)

opf-pptx 0.11.6 exports six chartex chart types natively by default; the audits read what PowerPoint draws. The slide carries an `mc:AlternateContent`: the Choice is a frame whose graphicData references a `cx:chartSpace` part (relationship type `chartEx`), the Fallback a classic clustered column. Audit B and the parity harness (opf#223) read the Choice. The id comes from the core catalog: `mappings.openxml.element` (`treemapChart`, `histogramChart`, `boxWhiskerChart`, `waterfallChart`, `funnelChart`, `mapChart`) and the Pareto `extension` (`cx:paretoLine`) give the `cx:series` layoutIds each id must carry (`treemap`, `clusteredColumn`, `clusteredColumn` with an owned `paretoLine`, `boxWhisker`, `waterfall`, `funnel`, `regionMap`). Real checks, all exact apart from the SVG's rounding: the part's category and value caches equal the data columns; the histogram series is binned; the Pareto line is an owned series; and the preview draws one tile per positive value with areas proportional to the values (treemap), the Scott bin count with bar heights proportional to the bin counts (histogram), sorted bars and a cumulative line ending at 100% (Pareto), one box per category and one mark per Tukey outlier with exclusive quartiles (box and whisker), bars proportional to the magnitudes starting at the running total (waterfall), widths proportional to the values on one centre line (funnel). A chart must re-import as the same id and data. The checks have unit tests with perturbed marks (`pnpm check:audit-chartex`). No tolerance changed.

**Result (core `2e838f5` (0.11.3), opf-render 0.11.8 `0ce9bb9`, opf-pptx 0.11.6 `e4c0c4b`, pptx-gallery `9e8d59a`).** Audit B charts: 25 of 26 `works`. The six native kinds pass every check. The remaining one is the `world` map, an accepted limitation (agent decision, vetoable): PowerPoint draws a map chart only with online geodata (an accepted `cx:regionMap` with no `cx:geoCache` shows "There was a problem getting the information for your map chart" and draws nothing, native evidence in opf#222), so `toPptx` keeps it on the clustered column fallback with `chart-data-adapted` (`chartex-fallback`); no provider data is fabricated. It reports "export writes barChart ...; core catalog mappings.openxml mapChart", "chart-data-adapted (chartex-fallback)" and "re-import returns chart type column, expected world". `pnpm report:works`: **818 of 819 (99.9%)**.

**Parity.** 734 perfect, 116 near, 0 mismatch of 850 (738 / 111 / 1 on the previous run). The histogram cache mismatch is gone (the native part carries the values). Six chartex values moved from perfect to near: with the chartex part read (it was the fallback column before), the chart text is 9 pt where the preview draws 12 pt. See FF-62 below.

**Label size, FF-62 (open).** The preview draws chart text at 16 px (12 pt on a 13.33 in slide): `opf-render` `charts.js` takes `max(14, composition.minFontSize ?? 16)` px, the readability floor. opf-pptx writes 9 pt axis labels in every chart it builds (classic `catAxisLabelFontSize` and `valAxisLabelFontSize` 9, chartex `cx:txPr` 900 and the style part 900); the other classic chart text (the legend, the data labels) is 12 pt. PowerPoint therefore shows 9 pt axis text where the preview shows 12 pt. The classic charts hid this because the parity size check passes when any size in the part matches (the 12 pt legend). Which side should move: the preview models what PowerPoint shows, and the export is the side that disagrees with OPF's own readability floor, so the export should write the floor size (12 pt) for chart text. That changes the bytes of every classic chart export and the fit of dense charts in PowerPoint (the preview rotates and skips labels at 12 pt, renderer 0.11.6), so it needs the corpus diff and a native check; it is not a small change and is tracked as FF-62, together with a stricter parity size check (per text role, not "any size in the part").

#### Goal closure on the published set (FF-58, 2026-09-30)

The audits re-run on the packages that npm serves, not on source worktrees: core `2e838f5` (package 0.11.3), opf-render 0.11.6 `b7e62ef`, opf-pptx 0.11.4 `c08105f`, opf-editor 0.10.4 `1529f26`, pptx-gallery `edb77b2`. Node 24.21.0, no Office, `AUDIT_FONT_HOST=gallery`
and `PARITY_FONT_HOST=gallery`. Core is one local core: the published `@openpresentation/opf@0.11.3` tarball (623 files) is byte-identical to a build of
tag `opf-v0.11.3`, and `register-local-opf.mjs` (parity, audit B) and the audit A loader route every engine to it. opf-render, opf-pptx and opf-editor are the
unpacked npm tarballs (`dist/` also exposed as `src/` for audit A, dependencies and the optional script-font peers installed from the registry, the registry's `gitHead` stamped
into `package.json` so the heads are recorded). pptx-gallery is main `edb77b2`; the bump PR that follows changes no snippet builder and no catalog record (only the key order of 24 deprecated layout
records, see below). Raw results: [audit A](gallery-support/audit-a/SUMMARY.md), [audit B](gallery-support/audit-b/results.json),
[parity](gallery-support/parity/parity-results-2026-09-30-published-0.11.6.json) and [PARITY-2026-09-30-published-0.11.6.md](gallery-support/parity/PARITY-2026-09-30-published-0.11.6.md); `support-status.json` is regenerated from them.

**Result.** `pnpm report:works`: **812 of 819 `works` (99.1%)**, from 431 (52.6%) in the committed file (427 at the start of the goal).

| Dimension | works before | works now | Why |
| --- | --- | --- | --- |
| Layouts | 291 of 485 | **485 of 485** | FF-51 (placement check), FF-52 (contracts, aliases, baselines), FF-53 (image re-import), FF-54 (samples fit), FF-55 (70 canonical ids), FF-57 (quote re-import) |
| Font schemes | 0 of 93 | **93 of 93** | FF-48 (host model), FF-49 (theme slots written where selected) |
| Languages | 0 of 93 | **93 of 93** | FF-48, FF-49, FF-50 (language contract) |
| Content blocks | 31 of 32 | **32 of 32** | FF-57 |
| Charts | 19 of 26 | 19 of 26 | unchanged: the 7 chartex charts (FF-56) |
| the other nine dimensions | 100% | 100% | backgrounds, color schemes, headers and footers, image treatments, narratives, audiences, tones, socials, themes |

**Every remaining non-`works` reason (7 configs).** All are chartex charts with the same cause, the default `toPptx` export keeping the clustered-column fallback until FF-56:
`treemap`, `pareto`, `world`, `box-and-whisker`, `waterfall` and `funnel` each report "export writes barChart, barDir col, grouping clustered; core catalog mappings.openxml <chartex part>", "export reports chart-data-adapted (chartex-fallback)" and "re-import returns chart type column, expected <id>";
`histogram` also reports "chart-data-adapted (histogram-binned)", "export chart cache: 1 series in the chart, 0 in the data" and "re-import chart data: 7 rows, expected 60". The native export (`toPptx({chartex: 'native'})`, opf-pptx 0.11.4) and the native previews (opf-render 0.11.6) are published; the
default flips only after the root owner's native PowerPoint check (FF-56). Nothing else is a presence gap.

**Parity (separate evidence, not required to be perfect for the goal).** 685 of 850 perfect, 161 near, 4 mismatch (729, 108, 13 on the opf-render 0.11.3 run of the same day). Every check other than fontResolution and text passes for all 850 values. What is left:
143 values are near on fontResolution because the preview draws the policy look-alike at a weight the replacement does not ship (Aptos Medium, SemiBold and ExtraBold drawn with Intos Regular or Bold, Segoe UI with Red Hat Display, Grandview, Arial Black and the script families with their Noto or open faces);
16 chart values are near on "chart label wrapped/split in preview"; 4 mismatches: the tag text colour of `pitch-deck-intro`, `section-break` and `closing-cta` and the `histogram` chart cache. (This run's note said the PPTX run carried no explicit colour where the preview drew the accent colour. That was inverted: the preview drew the text colour, `000000`, and the PPTX run carried the accent, `2874A6`, `F77F00`, `A41410`. Corrected by FF-59, see [Tag text colour](#tag-text-colour-ff-59-2026-09-30).)

**Instrument change: the host model follows face-level lazy loading.** The first parity run on renderer 0.11.6 scored 51 perfect, 795 near, 4 mismatch. The cause was the harness, not an engine: opf-render 0.11.5 (FF-41) loads vendored faces by face, so the modelled
gallery host holds only the Intos faces a document draws, and the harness asked the registry for Regular. `font-host.mjs` now records the faces the document draws (`presentationFaces`) and keys the host cache on them, `resolveDrawnFamily` resolves a family through those faces (every drawn face must resolve; the weakest compatibility is reported), and a family
the document draws no text in resolves through a probe registry that loaded its faces (what the editor's gate does once an edit draws it). Audits A and B use the same functions. No tolerance and no other check changed; unit tests in `font-availability.test.mjs`.
The earlier runs are unchanged. `head()` in the audit scripts falls back to the package `gitHead` for a published package.

**Gallery bump notes.** With core 0.11.3 the gallery's catalog builder writes the `deprecation` member of the 24 deprecated layout records in schema order (before `summary`) instead of last; the records are otherwise identical. The packed editor example now loads its eager faces on demand
(`base-fonts.json`): first load 701,692 bytes of font files (was 12,796,015), and an Aptos deck adds the two Intos faces (1,539,908).

#### Charts measured and owner defaults (2026-09-30)

Audits A and B and the parity audit re-run on the published set (FF-36): core `aedd364` (package 0.11.2), opf-render 0.11.3 `a66caa3`
(classic charts render natively), opf-pptx 0.11.2 `0400434` (native classic chart constructs, `chart-data-adapted` diagnostics, theme colour
references), pptx-gallery `b2238ac` (category-major chart snippets; 26 kept chart ids), audit B also opf-editor 0.10.2 `c7995ed`. Node 24.21.0, no
Office, one local core (`register-local-opf.mjs` for the parity and audit B runs, the audit A loader for audit A). Full report, with the before and
after tables against opf#186:
[PARITY-2026-09-30-charts-measured.md](gallery-support/parity/PARITY-2026-09-30-charts-measured.md); results
[parity-results-2026-09-30-charts-measured.json](gallery-support/parity/parity-results-2026-09-30-charts-measured.json). `support-status.json` is rebuilt
from this run and the presence audits.

**Parity: 707 perfect, 47 near, 96 mismatch of 850** (opf#186: 657, 37, 156). On the same heads the harness as merged scores 700, 48 and 102; the
chart series-colour comparison makes it 703, 51 and 96; the slide-number field folding 707, 47 and 96.

| Dimension | Values | perfect | near | mismatch | opf#186 |
| --- | --- | --- | --- | --- | --- |
| layouts | 485 | 483 | 2 | 0 | 444 / 2 / 39 |
| color-schemes | 14 | 14 | 0 | 0 | same |
| font-schemes | 89 + 4 legacy | 14 (11 + 3) | 18 | 61 (60 + 1) | same |
| languages | 93 | 66 | 2 | 25 | same |
| backgrounds | 6 (+6 withAssets) | 6 (6) | 0 (0) | 0 (0) | same |
| narratives | 10 | 10 | 0 | 0 | same |
| charts | 26 | 5 | 14 | 7 | 0 / 0 / 26 |
| themes | 4 | 1 | 3 | 0 | same |
| audiences | 14 | 14 | 0 | 0 | same |
| tones | 7 | 7 | 0 | 0 | same |
| socials | 10 | 10 | 0 | 0 | same |
| headers-footers | 10 (+10 withAssets) | 10 (10) | 0 (0) | 0 (0) | 8 (8) perfect, 2 (2) near |
| blocks | 32 | 21 | 8 | 3 | 19 / 8 / 5 |
| image-treatments | 15 (+15 withAssets) | 15 (15) | 0 (0) | 0 (0) | same |
| **all** | 850 | 707 | 47 | 96 | 657 / 37 / 156 |

The 96 mismatches are the 86 font-resolution failures (unchanged: 60 font schemes, 1 legacy scheme, 25 languages whose script faces the modelled preview does not
load), 7 chartex charts whose preview labels are not in the exported chart cache, and 3 blocks with a text colour mismatch.
Attribution of the +50 perfect: the engine releases account for 43 (39 layouts that embed a native chart, 1 block, 3 charts), the chart series-colour
comparison for 3 (2 charts, 1 block), the slide-number folding for 4 (two values, published and withAssets).

**Presence (audits A and B): 427 of 819 `works`** (379 of 793 at opf#186; the 26 charts are new presence items). Every changed row:

| Dimension | 2026-09-29 | Now | Why |
| --- | --- | --- | --- |
| charts | not measured | 19 `works`, 7 `partial` | audit B probes the 26 kept ids (below); the seven chartex ids are `partial` |
| image-treatments | 15 `partial` (retained from 2026-09-23) | 15 `works` | the probe is redefined (owner default) and measures the merged snippets; the retained rows are dropped |
| color-schemes | 14 `partial` | 14 `works` | opf-pptx 0.11.2 writes `a:schemeClr` references (FF-24b): no slide colour is a literal scheme slot colour any more |
| themes | 4 `partial` | 4 `partial` | the colour reason is gone; the font availability reasons remain |
| every other dimension | as before | as before | layouts 291 `works`, 124 `partial`, 70 `gallery-only`; blocks 31 `works`, 1 `partial`; backgrounds 6, headers-footers 10, socials 10, narratives 10, audiences 14, tones 7 `works`; font schemes and languages `partial` |

**Charts.** Audit B classifies a chart id `works` when the traced preview draws that id (`data-opf-chart`) with marks matching the data, the export writes exactly the
construct core's `mappings.openxml` records for it with the data in its caches and no `chart-data-adapted` diagnostic, and `fromPptx` returns the same
id and data. The 19 classic ids meet all of it. The seven chartex ids do not: the preview keeps the legacy single-series sketch, the
export writes a clustered column chart and reports `chart-data-adapted` (`chartex-fallback`), and re-import returns `column`. They are `partial`, not
`preview-only` (the preview draws no chartex construct either). A native PowerPoint check of the classic constructs and native chartex export remain
FF-22b.

| Gallery chart | Pipeline | Preview | Export | Re-import | Parity | text | fills |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `column` | works | column (marks match) | barChart, barDir col, grouping clustered | column | near | near | pass |
| `stacked-column-3x` | works | stacked-column-3x (marks match) | barChart, barDir col, grouping stacked | stacked-column-3x | near | near | pass |
| `100pct-stacked-column-3x` | works | 100pct-stacked-column-3x (marks match) | barChart, barDir col, grouping percentStacked | 100pct-stacked-column-3x | perfect | pass | pass |
| `line` | works | line (marks match) | lineChart, grouping standard, no markers | line | near | near | pass |
| `line-with-markers` | works | line-with-markers (marks match) | lineChart, grouping standard, markers | line-with-markers | near | near | pass |
| `stacked-line-3x` | works | stacked-line-3x (marks match) | lineChart, grouping stacked, no markers | stacked-line-3x | near | near | pass |
| `stacked-line-with-markers-3x` | works | stacked-line-with-markers-3x (marks match) | lineChart, grouping stacked, markers | stacked-line-with-markers-3x | near | near | pass |
| `pie` | works | pie (marks match) | pieChart | pie | perfect | pass | pass |
| `doughnut` | works | doughnut (marks match) | doughnutChart | doughnut | perfect | pass | pass |
| `bar` | works | bar (marks match) | barChart, barDir bar, grouping clustered | bar | near | near | pass |
| `stacked-bar-3x` | works | stacked-bar-3x (marks match) | barChart, barDir bar, grouping stacked | stacked-bar-3x | near | near | pass |
| `100pct-stacked-bar-3x` | works | 100pct-stacked-bar-3x (marks match) | barChart, barDir bar, grouping percentStacked | 100pct-stacked-bar-3x | perfect | pass | pass |
| `area` | works | area (marks match) | areaChart, grouping standard | area | near | near | pass |
| `stacked-area-3x` | works | stacked-area-3x (marks match) | areaChart, grouping stacked | stacked-area-3x | near | near | pass |
| `100pct-stacked-area-3x` | works | 100pct-stacked-area-3x (marks match) | areaChart, grouping percentStacked | 100pct-stacked-area-3x | perfect | pass | pass |
| `scatter` | works | scatter (marks match) | scatterChart, scatterStyle marker | scatter | near | near | pass |
| `radar` | works | radar (marks match) | radarChart, radarStyle standard, no markers | radar | near | near | pass |
| `radar-with-markers` | works | radar-with-markers (marks match) | radarChart, radarStyle marker, markers | radar-with-markers | near | near | pass |
| `filled-radar` | works | filled-radar (marks match) | radarChart, radarStyle filled, no markers | filled-radar | near | near | pass |
| `treemap` | partial | treemap (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | perfect | pass | pass |
| `histogram` | partial | histogram (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | near | near | pass |
| `pareto` | partial | pareto (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | near | near | pass |
| `world` | partial | world (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | perfect | pass | pass |
| `box-and-whisker` | partial | box-and-whisker (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | near | near | pass |
| `waterfall` | partial | waterfall (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | near | near | pass |
| `funnel` | partial | funnel (chartex preview; marks not counted) | barChart, barDir col, grouping clustered (chartex-fallback) | column | perfect | pass | pass |

**Owner defaults, recorded as "owner default 2026-09-30".**

1. *Slide-number formats.* A native slide-number field plus adjacent literal text runs counts as matching when the combined text equals the preview text. `slide-number-progress`
   (`{current} / {total}`) and `appendix-numbering` (`A-{current}`) are perfect instead of near (the harness folds the run count; per-character styles were already compared).
2. *Image treatments.* `works` for a composed treatment means the treatment's actual design output, as the gallery snippet emits it (layout image, image blocks, image
   background, `design.watermark`, `imageFill`), is written natively into the PPTX and re-imports. Audit A's probe now measures that (see
   [Image treatments](#image-treatments)); frames and crops stay parity checks, and the gallery's own `native`, `composed`, `gap` labels still say what OPF v1 cannot express.
3. *Socials.* Icons are catalog metadata only (authoring); the profile URLs render in the preview and the export and link. See [Socials](#socials).

#### Merged and published heads (2026-09-29 audit)

All four audits re-run on the merged mains after the 2026-09-29 merges and releases (FF-37 core#128 and pptx-gallery#46 landed during the run; the audits ran on both graphs, first on core `a386d4f` with gallery `0f6064b` and then on the heads below, with identical per-value results): core `930577d` (package 0.11.2), opf-render 0.11.2
`021cca0`, opf-pptx 0.11.1 `0d15f1c`, pptx-gallery `0b2dec8` (audit B also opf-editor 0.10.1 `4af6ea6`). Node 24.21.0, no Office. All
engines resolve to one local core (`register-local-opf.mjs` for the parity and audit B runs, the audit A loader for audit A). Full report, including
the per-check before and after tables against opf#175: [PARITY-2026-09-29-merged-heads.md](gallery-support/parity/PARITY-2026-09-29-merged-heads.md);
results [parity-results-2026-09-29-merged-heads.json](gallery-support/parity/parity-results-2026-09-29-merged-heads.json). `support-status.json` is rebuilt
from this run and the presence audits below.

**Parity: 657 perfect, 37 near, 156 mismatch of 850** (opf#175: 660, 33, 157). With the harness exactly as merged before this run, the same heads score
653, 37 and 160.

| Dimension | Values | perfect | near | mismatch |
| --- | --- | --- | --- | --- |
| layouts | 485 | 444 | 2 | 39 |
| color-schemes | 14 | 14 | 0 | 0 |
| font-schemes | 89 + 4 legacy | 14 (11 + 3) | 18 | 61 (60 + 1) |
| languages | 93 | 66 | 2 | 25 |
| backgrounds | 6 (+6 withAssets) | 6 (6) | 0 (0) | 0 (0) |
| narratives | 10 | 10 | 0 | 0 |
| charts | 26 | 0 | 0 | 26 |
| themes | 4 | 1 | 3 | 0 |
| audiences | 14 | 14 | 0 | 0 |
| tones | 7 | 7 | 0 | 0 |
| socials | 10 | 10 | 0 | 0 |
| headers-footers | 10 (+10 withAssets) | 8 (8) | 2 (2) | 0 (0) |
| blocks | 32 | 19 | 8 | 5 |
| image-treatments | 15 (+15 withAssets) | 15 (15) | 0 (0) | 0 (0) |
| **all** | 850 | 657 | 37 | 156 |

Against opf#175, one value improves and four values regress, all four in the harness or by construction:

- **Improved.** Backgrounds `photography` (mismatch to perfect): the snippet now carries its `assets.cover` (pptx-gallery#43).
- **Harness gap, now closed (not an engine regression).** Image treatment `watermark` and header/footer `brand-logo-footer`, each published and with
  assets. The earlier snippets never emitted the constructs (the treatment used a background slide image, and the logo was dropped by the snippet), so
  there was nothing native to compare. The merged snippets emit a real `design.watermark` and `footer.left.image`, the engines draw and
  export both correctly (0 pt frame delta, opacity 0.12 equal to `alphaModFix` 12000), and the harness did not know how to map the
  `OPF watermark` and `OPF image N` pictures. It now does (README, "Watermark and furniture pictures"); no tolerance changed.
- **Near by construction.** Header/footer `slide-number-progress` and `appendix-numbering` (published and with assets): the snippet now sets a slide-number
  format, the exporter writes the native field and the literal text as two elements, and the preview draws one text line, so
  the run count differs (1 against 2) while the text, fonts, sizes and colours are identical. Whether a field counts as part of its neighbouring run is
  left to the owner; the harness was not changed for it.

Every other value keeps its class, and fontResolution is identical to opf#175 (733 pass, 31 near, 86 fail). The 156 mismatches are 86 font-resolution
failures (60 font schemes, 1 legacy scheme and 25 languages whose script faces the modelled preview does not load), 67 native chart series-colour failures
(26 charts, 39 layouts and 2 blocks; 11 charts also fail text: preview labels not in the chart cache) and 3 blocks with a text colour mismatch.

**Presence (audits A and B): 379 of 793 `works`** (352 at the September 23 heads). Every changed row:

| Dimension | September 23 | Now | Why |
| --- | --- | --- | --- |
| backgrounds | 2 works, 4 partial | 6 works | distinct native `pattFill` presets (`openDmnd`, `wave`, `pct5`) and a self-contained `photography` asset (pptx-gallery#43); audit A no longer hard-codes `pct5` or assumes a missing asset |
| headers-footers | 1 works, 9 partial | 10 works | the snippet expresses `hideOnTitleSlide`, slide-number and date formats and the legal line (pptx-gallery#47), the furniture is measured on the slide that shows it, and the logo is supplied. The three dated snippets carry a fixed date, which core defines as static content and the exporter writes as static text (checked in the export); only a current date (`date: true`, with a host date) is a live `datetime` field, and no gallery snippet uses one |
| blocks | 29 works, 3 partial | 31 works, 1 partial | `market-opportunity` and `financial-snapshot` keep their metric text (pptx-gallery#44 and #49); `quote-slide` still loses the `quote` payload kind on re-import |
| layouts | 289 works, 126 partial | 291 works, 124 partial | `title-center` and `title-center-box` now place shapes as the preview does |
| socials | 10 partial | 10 works | the organization profile URL renders in the preview and the export (pptx-gallery#42, FF-34) |
| color-schemes, font-schemes, languages, themes | partial | partial | unchanged: theme `ea`/`cs` typefaces are empty and scripts the preview does not load (FF-05, FF-19, FF-41); font-schemes moves from 7 to 28 `substitute` preview tiers because more replacement faces are now bundled |
| narratives, audiences, tones | works | works | unchanged |
| image-treatments | 15 partial | 15 partial (retained) | not re-measured then; re-measured 2026-09-30, see [above](#charts-measured-and-owner-defaults-2026-09-30) |

For the editor path, audit A now compares the gallery's per-item editor builder with the published snippet: headers/footers (10 of 10) and
blocks (32 of 32) are identical to the snippet and no longer the same document for every slug. The image-treatment, background and layout editor paths are
not probed by audit A.

**Audit A image treatments are retained, not re-measured (superseded 2026-09-30: re-measured, 15 of 15 `works`, see [above](#charts-measured-and-owner-defaults-2026-09-30)).** The probe classifies a treatment by whether the export adds a native picture for
`design.slideImage`. The merged snippets (pptx-gallery#44) express the 15 treatments with image backgrounds, image blocks, `imageFill` and `design.watermark`, and
carry their own image assets, so the probe would report all 15 as "no native picture" for a reason that no longer applies, and it now stops
with an error instead. The 15 rows, and their heads (`1ad25df`, `bc436f3`, `9092954`, `f17e9ae`), are kept from the September 23 run
(`meta.retained`; `support-status.json` gives each item its own `measuredHeads`). Redefining what `works` means for a composed treatment (native
pictures matching the preview images, re-import keeping them, gaps labelled) is an owner decision that this re-run does not make. The parity audit does measure the
current snippets: 15 of 15 perfect, with and without a supplied image.

#### Table frames and the drawn table (2026-09-29 instrument change)

The geometry check used to compare a PPTX table frame with the box composed for
the table (`composeSlide` `item.box`). It now compares it with the table the
preview draws: the union of the table's cell rectangles in the traced SVG
(`scripts/table-box.mjs`, unit-tested in `table-box.test.mjs`), within the same
0.02 pt tolerance. Chart, picture and card frames still equal the composed box.

Why: FF-39's criterion "table frames equal the composed box" is read as "table
frames equal the drawn table box". Rows are only as tall as their text needs
(short rows keep 54 px; the composed box is the space allocated to the table), so
a table is usually shorter than its allocation: 162 pt of rows in a 514.92 pt
box in the color-scheme gallery decks. PowerPoint derives a table's height from
its rows, so a frame that declares more than the rows sum to is inconsistent XML
that PowerPoint ignores or rewrites: a parity pass on it would describe the XML,
not what a user sees. opf-pptx already writes the frame as the row total, which
is exactly the drawn table; the old check flagged 20 values (14 color-schemes, 2
blocks, 4 layouts, all "table frame delta >50pt") for a preview/PPTX agreement
that was never wrong. Only the reference box changed; no tolerance changed. The
new check is not vacuous: an exporter that writes the frame at the composed
height instead (the first version of opf-pptx#93) still fails the same 20 values.

Same four heads, harness before and after (exporter opf-pptx `874d9e9`):

| | geometry | zOrder | perfect | near | mismatch |
| --- | --- | --- | --- | --- | --- |
| Old table check (composed box) | 830 | 830 | 5 | 608 | 237 |
| New table check (drawn table) | 850 | 830 | 5 | 627 | 218 |
| New check, opf-pptx#93 (`844e9e6`) | 850 | 850 | 5 | 647 | 198 |

The improved checks are geometry for color-schemes (0 to 14 of 14), blocks (30 to
32 of 32) and layouts (481 to 485 of 485), and, with opf-pptx#93 only, zOrder for
the 20 header/footer values (0 to 20). No check regresses for any value, and no
value changes class except mismatch to near (19 for the check change alone, a
further 20 with #93). None becomes perfect, because fontResolution near or fail
remains for every value except the five perfect ones.

Results:
[parity-results-2026-09-29-table-drawn-extent.json](gallery-support/parity/parity-results-2026-09-29-table-drawn-extent.json)
(new check, current mains),
[scoreboard](gallery-support/parity/PARITY-2026-09-29-table-drawn-extent.md) (its
before/after compares with the old check at the same heads; those baseline runs
are not committed). `support-status.json` is rebuilt from this run.

The five perfect values are the font schemes `calibri`, `courier-new`,
`times-new-roman` and `roboto`, plus the content block `kpi-dashboard`.
slideSize, typefaces and theme pass
everywhere. Re-import passes for 899; the `photography` snippet, which has no
asset, loses its background with a specific diagnostic (near).

Per dimension (accepted September 29 graph, old fontResolution definition, so its fontResolution column counts only real or metric-compatible faces; slideSize, typefaces and theme pass everywhere; the new definition's per-dimension near and fail counts are in the [look-alike run's scoreboard](gallery-support/parity/PARITY-2026-09-29-lookalike-fonts.md)):

| Dimension | Values | perfect | geometry | text | fills | zOrder | reimport | fontResolution | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| layouts | 485 | 0 | 481 | 472 | 445 | 485 | 485 | 0 | 475 |
| color-schemes | 14 | 0 | 0 | 14 | 14 | 14 | 14 | 0 | 14 |
| font-schemes | 89 + 4 legacy | 4 | 93 | 93 | 93 | 93 | 93 | 4 | 93 |
| languages | 93 | 0 | 93 | 93 | 93 | 93 | 93 | 0 | 93 |
| backgrounds | 6 (+6 withAssets) | 0 (0) | 6 (6) | 6 (6) | 5 (6) | 6 (6) | 5 (6) | 0 (0) | 6 (6) |
| narratives | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| charts | 76 | 0 | 76 | 26 | 9 | 76 | 76 | 0 | 76 |
| themes | 4 | 0 | 4 | 4 | 4 | 4 | 4 | 0 | 4 |
| audiences | 14 | 0 | 14 | 14 | 14 | 14 | 14 | 0 | 14 |
| tones | 7 | 0 | 7 | 7 | 7 | 7 | 7 | 0 | 7 |
| socials | 10 | 0 | 10 | 10 | 10 | 10 | 10 | 0 | 10 |
| headers-footers | 10 (+10 withAssets) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) | 0 (0) | 10 (10) |
| blocks | 32 | 1 | 30 | 28 | 30 | 32 | 32 | 1 | 32 |
| image-treatments | 15 (+15 withAssets) | 0 (0) | 15 (15) | 0 (15) | 15 (15) | 15 (15) | 15 (15) | 0 (0) | 15 (15) |

Under the old fontResolution definition, socials, tones, narratives, languages
and the other non-layout metadata dimensions failed only font resolution
(visual substitutes, including Aptos Display to Carlito and Aptos to Roboto).
Under the definition adopted on 2026-09-29 those visual substitutes are near,
so the same run reports 608 near and 287 mismatch in all.

### Measurement notes (2026-09-23 re-run)

- **Fills 842 to 734 at opf#122 is a stricter check, not a regression.** The
  chart series-colour comparison was already in the baseline harness, but the
  baseline built chart part names as `ppt/slides/` plus the relationship
  target. The exporter writes absolute targets (`/ppt/charts/chartN.xml`), so
  no chart part was found and the comparison passed vacuously. opf#122 resolves
  targets per OPC, so the comparison now runs. In the committed opf#122
  results, 166 values fail fills; exactly 108 of them fail only on
  `chart series colors not in preview` (charts 67, layouts 39, blocks 2), and
  those are exactly the per-dimension drops from the baseline (charts 76 to 9,
  layouts 442 to 403, blocks 25 to 23). 842 minus 108 is 734. The other 58
  failures are the same as the baseline's.
- **Fills 734 to 674, mapping 890 to 672 and zOrder 880 to 784 at opf#137
  were a harness gap, now closed.** The FF-26 exporter writes
  `design.slideImage` as one picture named `OPF slide image slides.N`, which
  the name matcher did not recognise. The containment fallback left it
  unmapped or put it in a content item's group, so 225 values failed mapping,
  106 of them also image count and picture frame geometry, and 96 z-order.
  The 225 are every value whose snippet has a slide image: 202 layouts, 4
  blocks, 3 audiences, `themes/dark` and the 15 image treatments with assets.
  Compared directly, every one has exactly one preview slide image and one
  exported picture, with 0 pt frame delta, identical image bytes and the
  picture first in `spTree`. Cropped side and band placements carry the
  preview's 25% `a:srcRect` crop; fit placements use a -50% inset that
  letterboxes the image as the preview does. The harness now maps the picture
  to the preview slide-image group and compares its visible image rect (see
  the [gallery-support README](gallery-support/README.md#slide-image-mapping-ff-26)).
  No tolerance changed and no value regressed.
- **Audit B probes and classifier (FF-36 audit update).** Before the update,
  audit B read slide colours and the `p:bg` fill only from `srgbClr`, so after
  FF-24 all 14 colour schemes and all 4 themes were `broken` ("colour
  mismatch", "export non-solid"), and several reasons were fixed text printed
  whatever was measured. Now:
  - Slide colours resolve `a:schemeClr` through each slide's own chain,
    followed by relationships: slide to layout to master to theme. The colour
    map is the innermost override (slide `clrMapOvr`, then layout `clrMapOvr`,
    then the master `p:clrMap`). A missing or ambiguous link, or a master
    without `p:clrMap`, is a reason in every dimension, and nothing falls back
    to master 1, theme 1 or a default map. If the slides reach more than one
    theme, that is also a reason, because the theme font and `clrScheme`
    checks read one theme. Current exports have one master and one theme, with
    no override. A colour with child transforms (`lumMod`, `lumOff`, `tint`,
    `shade`, `alpha`) is reported as unresolved and can never count as
    agreeing, because the audit, like the parity harness, does not compute
    transforms. None occurs in current exports.
  - Preview and export are compared deck-wide and slide by slide: scheme slots
    used, any resolved export colour the preview slide does not paint, and the
    slide background. All 14 schemes and 4 themes agree on every slide, with
    the theme `clrScheme` at 12/12. They are `partial` because 42 of the 55
    slide colour uses in each colour-scheme deck (2 of 3 in each theme deck)
    still write a scheme slot colour as literal `srgbClr`, for example text in
    `light1` `FFFFFF`. The FF-24 acceptance asks for `schemeClr` there.
  - Languages are classified from the catalog `ooxmlLang`, `direction` and the
    script slot of the gallery's native name, against the slide runs, `rtl`
    paragraphs, run and theme `ea`/`cs` faces, the preview and re-import.
    All 93 are `partial`; see [Languages](#languages).
  - Every reason is conditional on a measured field, and `works` needs an
    empty reason list. Socials therefore move from `works` to `partial`: the
    pre-program snippet renders no handle in preview or export
    (`handleInPreview` and `handleInExport` false), although re-import returns
    the socials for 10 of 10. Narratives, audiences and tones stay `works`:
    removing the field changes `ppt/tags/opfDocument.xml` and re-import returns
    the value for all 31; the preview is identical, as expected for authoring
    metadata.
  - `sharedExportGaps` is now measured over the 245 exports. The only gap
    every export shares is the `heading-import-reflow` re-import diagnostic.
  - Mutation checks, run on scratch copies of the exported packages: pointing
    the slides' `accent1` references at `accent2`, swapping `bg2`/`tx2` in the
    master colour map, or recolouring theme `accent1` makes every colour scheme
    `broken`; adding `lumMod` to `accent1` references reports the unresolved
    transform. None of these leaves a value `works`. Pointing the master at a
    second theme part (`accent1` and `dk2` changed, `theme1.xml` left in
    place), or giving the layout a `bg2`/`tx2`-swapped `clrMapOvr`, makes every
    colour scheme `broken`. Dropping slide 1's layout relationship adds
    "export colour chain unresolved" to all 245 values (0 `works`). The
    previous audit, which read `theme1.xml` and `slideMaster1.xml` by name,
    ignored all three.
  - `handleInExport` searches only slide, layout and master XML. Before, it
    also searched `ppt/tags/opfDocument.xml`, which embeds the OPF document
    (hex-encoded today, so the result was the same). With the handles written
    in plain text into that part, the previous audit dropped the "not in the
    export" reason; the current one keeps it, and drops it only when the
    handles are in slide text.
- **Audit A image treatments (FF-36 audit update).** The probe used to require
  more pictures than a baseline document, but the baseline keeps the slide's
  own image as a picture, so it never fired. It now finds the picture named
  `OPF slide image slides.N`, requires its `r:embed` to resolve to an image
  part, and compares its visible frame and crop with the traced preview at
  0.02 pt, using the parity harness geometry (`visibleImage`, `placedImage`,
  `cropDelta`). With the asset supplied, all 15 pictures match at 0 pt with
  the preview's image bytes, and `side-by-side` and `image-strip` are `works`.
  The other 13 are `partial` because their treatment collapses to the same OPF
  document as others. The published snippets have no asset, so neither preview
  nor export has a slide image and all 15 stay `partial`. In mutation checks,
  removing or renaming the picture, taking its crop from one side (240 pt and
  135 pt crop deltas), or moving it by 1 pt turns both `works` values
  `partial` with a named reason. When the probe does not run (the value or
  baseline export failed), the value gets "slide-image probe not run" and
  cannot be `works`. Before, a failing baseline left `native` null, and
  `side-by-side` and `image-strip` stayed `works` without a probe. The gallery fixes are
  pptx-gallery#44 and #45, which are still open.

### Universal blockers

One failure still blocks nearly every value. Three earlier universal blockers
no longer fail on the accepted September 29 graph: the theme `clrScheme` (FF-24; theme 900
pass), re-import (FF-32; 899 pass, and the one other value loses its
background with a specific diagnostic) and package typefaces (FF-08; 900
pass). FF-07 and FF-08 stay in review pending FF-05. The fourth, centered
preview text against left-aligned PPTX text (FF-39), is much reduced but not
cleared across every check: text passes for 798 and geometry for 880. The
September 23 reverse mismatch, "alignment l (preview) vs ctr (pptx)", no
longer occurs in this run; remaining text/geometry failures and native
acceptance keep FF-39 in review.

| Blocker | Check (passed) | Values hit | Fix |
| --- | --- | --- | --- |
| Under the new fontResolution definition (owner decision 2026-09-29), Aptos Display (Carlito) and Aptos (Roboto) are visual-only replacements: 754 values are near (791 in all across 27 families). 104 values fail because the modelled office-pack preview has no face: 85 values need script-pack faces that the `scripts` pack bundles but the preview does not load, and 19 values name open families no pack bundles (Open Sans, Montserrat, Poppins and others). | fontResolution (5 pass, 791 near, 104 fail) | 791 near, 104 fail | FF-31 metric-compatible open replacements (Intos candidate for Aptos); font bundling PR in progress |

Other recurring parity failures:

- Charts and chart blocks: native series colours are not in the preview for
  67 values (26 charts, 39 layouts and 2 blocks), and preview labels are
  not in the chart cache for 11 charts (FF-22, FF-22b). This is 67 of the 70
  non-font mismatches.
- Text colours: 3 blocks (`pitch-deck-intro`, `section-break`, `closing-cta`).
- Font resolution: 86 values (60 font schemes, 1 legacy, 25 languages) whose
  script faces the modelled preview does not load.
- Z-order, geometry, mapping, typefaces, re-import and theme pass for every
  value on the merged heads, with the mapping fixes above.

The per-item parity status is in `support-status.json` (`parity`, plus
`parityOnly` for charts). The full report, with a before/after table against
the previous run, is [PARITY.md](gallery-support/parity/PARITY.md).

### Baseline (history)

First run, 2026-09-23, at opf `53be042`, opf-render `e500ed9`, opf-pptx
`cf0bc0c` and pptx-gallery `f17e9ae`, before both opf#122 harness fixes
(relationship targets resolved per OPC; single text lines compared by rendered
extent). 0 of 900 were perfect. Checks passed:

| geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 378 | 273 | 842 | 880 | 900 | 0 | 0 | 5 | 0 | 890 |

The report is kept at
[parity/history/2026-09-23-baseline/PARITY.md](gallery-support/parity/history/2026-09-23-baseline/PARITY.md).
The previous run (opf#122, after both fixes) is kept at
[parity/history/2026-09-23-opf122/PARITY.md](gallery-support/parity/history/2026-09-23-opf122/PARITY.md).

## Status legend

The definitions are the audits' own classifiers
([audit A `classify`](gallery-support/audit-a/scripts/audit.mjs),
[audit B `classify`](gallery-support/audit-b/scripts/summarize.mjs)).

| Status | Definition |
| --- | --- |
| `works` | Schema-valid; every catalog reference resolves; the preview shows the value (differs from the baseline); the export is a valid package with the dimension's native PowerPoint XML; re-import keeps the value; and the audit recorded no reason against it. In audit B every reason is a measured result, and `works` needs an empty reason list. |
| `partial` | Schema-valid, preview and export succeed and the value has an effect in at least one of them, but at least one fidelity check fails (no native XML, preview/export disagreement, re-import loss, unresolved reference, gallery option dropped by the snippet). Audit B: color schemes and themes whose preview and export colours agree deck-wide and slide by slide; font schemes whose export writes the chosen major/minor families with no foreign typeface; languages whose field changes the preview or export. |
| `schema-only` | Validates and renders/exports without error, but the preview is identical to the baseline and the export has no native equivalent (audit A); or, for languages, removing the field changes neither the preview nor any PPTX part (audit B). |
| `authoring-metadata` | The catalog id resolves in core, and removing the field leaves the SVG and every PPTX part byte-identical. It is consumed only by validator/lint/bundle catalog checks, opf-editor transfer mapping and authoring skills. |
| `broken` | Schema-invalid, or preview, export or re-import throws; or the export contradicts the value, for example typefaces that differ from the scheme, or slide colours (`a:schemeClr` resolved through the exported theme) or backgrounds that differ from the preview (audit B). No value is `broken` on current mains. |
| `gallery-only` | The gallery id has no core equivalent: a legacy gallery layout slug with no OPF canonical id, portable only through inline `catalogs.layouts.records` (audit A; its measured class is kept as `measuredStatus`); or a narrative/audience id missing from the core catalog (audit B). |

Two dimensions read `works` with their own measured fields. Charts (audit B): the traced preview draws the id with marks matching the data, the export writes the construct
core's `mappings.openxml` records with the data in its caches and no `chart-data-adapted` diagnostic, and re-import returns the same id and data. Image treatments
(audit A, owner default 2026-09-30): the design output the snippet emits is written natively into the PPTX and re-imports.

`support-status.json` also flags `previewOnly` for audit A values whose
preview shows the value while the export has no native equivalent.

## Summary

Presence: 819 values measured across 14 dimensions (the 26 charts joined the presence audits on 2026-09-30). 818 values are `works` on the FF-56 published set (opf-pptx 0.11.6, renderer 0.11.8, core 0.11.3; 812 on the FF-58 set); 734 of 850 are perfect by parity. 812 values were `works` on the FF-58 published set (renderer 0.11.6, PPTX 0.11.4, core 0.11.3; 431 on the set with opf-render 0.11.4); 685 of 850 are perfect by parity. The columns below are the FF-58 numbers; the older wording is kept and marked "Now (FF-58)" where a row changed. On the earlier set, 431 values were
`works` on the September 30 published set with opf-render 0.11.4 (427 on the same heads under the strict no-host font model, 427 on the earlier September 30 heads, 379 of 793 on September 29, 352 at the September 23 heads, 7 at the first measurement). Parity: 734 of 850
perfect on the same heads. The "What actually works" column keeps the first
measurement's wording unless marked "Now".

| Dimension | Values | works | partial | schema-only | authoring-metadata | gallery-only | broken | Parity perfect | What actually works for a developer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Layouts](#layouts) | 485 | 485 | 0 | 0 | 0 | 0 | 0 | 436/485 (+49 near) | Snippets validate, preview and export. Only 30 layouts are in the core catalog. Now: re-import keeps design and emits specific diagnostics (FF-32), and `title-center` and `title-center-box` now agree between preview and export, so 291 are `works`. Now (FF-58): all 485 are `works`: the 70 legacy ids are canonical in core 0.11.3, the geometry contracts and aliases are measured, the placement check sees alignment, image and quote payloads re-import, and no sample overflows. Parity: 49 near are visual-only weights (Intos has no Medium, SemiBold or ExtraBold face). |
| [Color schemes](#color-schemes) | 14 | 14 | 0 | 0 | 0 | 0 | 0 | 14/14 | Now (2026-09-30): all 14 are `works`. The theme `clrScheme` matches 12/12 and slide colours are `a:schemeClr` references (opf-pptx 0.11.2, FF-24b); preview and export colours agree slide by slide. |
| [Font schemes](#font-schemes) | 93 | 93 | 0 | 0 | 0 | 0 | 0 | 38/93 (+55 near) | Export without a font registry writes the chosen heading/body families for all 93. Now (FF-48, 2026-09-30): the modelled gallery host draws every one (the family itself, or a policy look-alike with the PPTX naming the selected family), so no font-availability reason remains; all 93 are `partial` on one reason, the empty theme `ea`/`cs` typefaces (FF-49). Parity: 38 perfect (35 of 89 upstream and 3 of 4 legacy), 55 near (visual-only look-alikes), none mismatched. Now (FF-58): all 93 are `works`: the theme `ea`/`cs` slots are written only where a script font is selected (opf-pptx 0.11.4) and the modelled host draws every family. |
| [Languages](#languages) | 93 | 93 | 0 | 0 | 0 | 0 | 0 | 66/93 (+27 near) | Now: slide runs carry the catalog `ooxmlLang` (93/93), right-to-left text exports `rtl` and previews right-to-left (6/6), and re-import keeps the language (93/93). `partial` on engine font-scheme derivation (FF-50) and, for two languages, the empty `cs` theme typeface (FF-49); since FF-48 the modelled gallery host draws all 93 native names, so no font-availability reason remains. Parity: 66 perfect and 27 near (a proprietary script font drawn with its Noto replacement). Now (FF-58): all 93 are `works` under the language contract (FF-50). |
| [Backgrounds](#backgrounds) | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 6/6 | Solid and gradient work end to end. Now: all 6 are `works`: the three pattern slugs are distinct native `pattFill` presets and `photography` carries its own asset (pptx-gallery#43). |
| [Narratives](#narratives) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 10/10 | Now: every id resolves in core (FF-28). `works` only because the exporter-written `ppt/tags/opfDocument.xml` part changes; the preview is identical when the field is removed. |
| [Charts](#charts) | 26 | 25 | 1 | 0 | 0 | 0 | 0 | 5/26 (+21 near) | Now (2026-09-30): the 19 classic types preview the catalog construct, export the native construct core records and re-import to the same id (`works`); the 7 chartex types (treemap, histogram, pareto, world, box-and-whisker, waterfall, funnel) preview natively since opf-render 0.11.4 but still export a clustered column chart with `chart-data-adapted` and re-import as `column` (`partial`, FF-56). Parity: 8 perfect, 18 near (native chart labels), none mismatched. Per type in [Charts](#charts). Still 19 `works` and 7 `partial` (FF-56): the chartex charts export the clustered-column fallback by default and report `chart-data-adapted`; `histogram` also differs in its cached series. The native export is published but opt-in. Now (FF-56, opf-pptx 0.11.6): 25 are `works`: the six confirmed chartex types export natively and re-import to the same id and data. `world` stays `partial` (accepted limitation: PowerPoint maps need online geodata). Parity: 5 perfect, 21 near (15 label wraps, 6 chartex label sizes, the `world` re-import loss), 0 mismatch. |
| [Themes](#themes) | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 1/4 (+3 near) | Background and fonts apply in preview and export. Now: background and colours resolve through the theme and agree with the preview, and (FF-48, 2026-09-30) the modelled gallery host draws the fonts (Intos, Figtree, Source Sans 3, Barlow and Anton replace the licensed families in the preview, the PPTX names the selected ones), so all 4 are `works`. Parity: 1 perfect, 3 near (visual-only look-alikes). |
| [Audiences](#audiences) | 14 | 14 | 0 | 0 | 0 | 0 | 0 | 14/14 | Now: every id resolves in core (FF-28). `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Tones](#tones) | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 7/7 | `works` only because `ppt/tags/opfDocument.xml` changes; the preview is identical. |
| [Socials](#socials) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 10/10 | Now: all 10 are `works`. The snippet adds a footer with the organization and its profile URL (pptx-gallery#42), which renders in the preview, exports as a linked native run and re-imports (FF-34). Owner default 2026-09-30: icons are catalog metadata only (authoring); URLs render and link. |
| [Headers & footers](#headers-and-footers) | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 10/10 | Now: all 10 are `works` and, since the 2026-09-30 owner default, all 10 are perfect: a native slide-number field plus its adjacent literal runs is one run (`{current} / {total}`, `A-{current}`). Native slide-number fields, the gallery options the snippet expresses (`hideOnTitleSlide`, number and date formats, legal line; pptx-gallery#47), and the footer logo. The snippets use fixed dates, which export as static text; no gallery snippet exercises a native `datetime` field. |
| [Content blocks](#content-blocks) | 32 | 32 | 0 | 0 | 0 | 0 | 0 | 18/32 (+11 near, 3 mismatch) | Now: `market-opportunity` and `financial-snapshot` keep their metric text in preview and export (FF-30, pptx-gallery#44 and #49); `quote-slide` still loses its `quote` payload kind on re-import. Parity: 21 perfect, 8 near (visual-only fonts), 3 mismatch (text colours). Now (FF-58): all 32 are `works`; `quote-slide` re-imports its `quote` payload (opf-pptx 0.11.4). Parity: 3 mismatches remained, the tag text colour (`pitch-deck-intro`, `section-break`, `closing-cta`: the preview drew the tag in the text colour, the PPTX run carried the accent); fixed by FF-59, parity now 21 perfect and 0 mismatch for blocks. |
| [Image treatments](#image-treatments) | 15 | 15 | 0 | 0 | 0 | 0 | 0 | 15/15 | Now (2026-09-30, owner default): re-measured with a probe of the snippet's actual design output; all 15 are `works` (the emitted layout image, image blocks, image background, watermark and `imageFill` are written natively and re-import). Perfect parity means preview and export agree; the masks, blur, duotone and device frames stay documented gaps (gallery labels 7 `native`, 2 `composed`, 6 `gap`). |

### Shared export gaps (every exported value, audit B)

At the first measurement. On current mains FF-24, FF-07, FF-08 and FF-32 have
merged, and the parity theme, typefaces and re-import checks pass for 900,
900 and 899 values.

- The theme `clrScheme` is the Office default (`accent1` `4472C4`); only
  `dk1`/`lt1` match a chosen scheme, and only by coincidence (FF-24).
- Theme major/minor `ea`/`cs` are `typeface=""` (FF-07).
- `docProps/app.xml` "Fonts Used" lists Arial and Calibri (FF-08).
- Every run is `lang="en-US"`, with no `rtl` (FF-07).
- `fromPptx` keeps only `design.dimensions`: colour scheme, font scheme, theme,
  language, narrative, tone, audience, organization and speaker are dropped
  with no diagnostic, and every re-import emits `heading-import-reflow`
  (FF-32).

### Fonts in every environment

Per-font status, priorities and next actions for every family behind these readings are in the
[font tracker (FF-40)](font-tracker.md); its priority score weighs the values each family affects in the
parity scoreboard above by the size of its gap.

- **Export.** With no font registry, `toPptx` writes the chosen family names
  and needs no installed fonts, so it behaves the same locally and in
  containers or serverless functions without system fonts. With the office
  pack and `substitutionPolicy: 'visual'`, `toPptx` writes the substitute
  (Carlito, Cousine, Gelasio, Arimo or Tinos) instead of the chosen family, for
  7 font schemes and the `minimal` theme (FF-31). Do not pass a substituting
  registry to export until FF-31 lands.
- **Preview.** Without a registry the SVG names the family and the host
  resolves it; in a browser that is the installed or web font, and on a
  fontless server it is an unmeasured fallback. The shipped host is the gallery editor's font gate, not a strict pack (FF-48): it draws all 93 font
  schemes, all 93 languages' native names and the four themes, with a policy look-alike where the family is licensed. The strict readings that follow are diagnostics
  (`AUDIT_FONT_HOST=strict`), not how any shipped host renders. The strict bundled pack throws
  `font-unavailable` for 92 of 93 font schemes (only `roboto` passes). Under
  `loadOfficeFontRegistry()`, 547 of the 548 audit A values throw
  `font-unavailable`, mostly because the default `aptos` scheme's
  `Aptos Display` has no local face there (the others name Segoe UI Semibold,
  Georgia, Montserrat, Poppins, Grandview Display or Open Sans).
- **Licensing.** 30 of 89 upstream schemes and all 4 legacy gallery schemes
  use openly licensed families (Roboto, Montserrat, Open Sans, Poppins,
  PT Serif, Raleway, 24 Noto families; Playfair Display, Source Sans Pro,
  Bebas Neue, Lora, Merriweather Sans). Only Roboto is bundled. The other 59
  upstream schemes, including the default Aptos, use Microsoft fonts that are
  not openly licensed; they cannot be bundled. Today they must come from the
  host or be supplied by the caller through `createFontRegistry`
  ([font fidelity](../../font-fidelity.md)). FF-31 implements the owner font
  policy. Licensed (proprietary) families are never bundled or embedded: they
  render through shipped open replacements, and the PPTX keeps the real name.
  Open families are bundled, and they may be embedded only through the
  explicit FF-13 embed path.
  FF-35 records the owner decision to keep `aptos` as the one shared default.

### Aptos at weights 500, 600 and 800 (FF-60, 2026-09-30)

Question: can opf-render vendor Intos faces at 500, 600 and 800 so the Aptos preview draws those weights? Answer: no, and the near rows do not need it.

- **Which values.** Of the 143 `near` fontResolution values in the FF-58 run, 48 are near only because of Aptos (47 layouts, 1 block); the other 95 are other families (Segoe UI, Grandview, Mangal, and so on). The 48 draw `Aptos` at 500 (metric labels; 47 values), `Aptos Display` at 800 (metric values; 39) and 600 (three quote layouts), or `Aptos` at 600 (one layout). The registry resolves 500 to Intos Regular and 600 and 800 to Intos Bold, and reports `visual` because the metric claim of the Intos rows is scoped to 400 and 700 (`weights: [400, 700]`).
- **Upstream** (github.com/muglug/intos, pinned `fef9315c`, still the newest commit on `main` on 2026-09-30; no other branch, tag or release; OFL-1.1, no Reserved Font Name). It has no variable font and no Medium or ExtraBold in any family. It has one extra static pair, `fonts/Intos-Semibold.ttf` and `Intos-SemiboldItalic.ttf` (Git LFS; weight class 600; sha256 `d39f69f11395ea416509fc8ea0804d8328ce95defabf267bca6254a99e407f16` and `82825e86a4da6ad119b10b11668f2016bd8d5a2b4159d49b9f518b71ac3fd557`; 1.4 MB and 0.8 MB), for the sans family only: Intos Display, Narrow and Serif have no Semibold. The README calls them review masters. Their name table is family "Intos Semibold" with subfamily Regular, so resvg would load them as a separate family; using them as weight 600 of "Intos" needs a rename, which the OFL allows without a Reserved Font Name but makes them derived bytes, not pinned upstream bytes. Upstream's own `scripts/compare-semibold.py` asserts that every shared advance and the vertical metrics equal a supplied Aptos file, and the Semibold advances sit at 0.497 of the way from Regular to Bold on a mixed corpus string. We could not re-verify against Aptos SemiBold: the host has only the Regular, Italic, Bold and Bold Italic cloud styles of Aptos, Aptos Display and Aptos Narrow, and fetching SemiBold and ExtraBold through PowerPoint is a root-only step (PowerPoint was in use by another session).
- **Why vendoring does not help.** `toPptx` writes bold (`b="1"`) for weights from 600 and regular below, and names the family `Aptos` or `Aptos Display`. PowerPoint therefore draws these runs as Aptos Regular (500) and Aptos Bold (600, 800), exactly the faces the preview already uses, with identical advances. A Medium or ExtraBold preview face would be wider or narrower than what PowerPoint shows for the same file. Semibold would fix one of the 48 values (the plain-Aptos 600 layout) and could not help the three Display 600 values. So the near classification says "no metric-compatible face at this weight", while the preview is in fact metric-exact for the face the PPTX selects.
- **Decision (agent, vetoable; FF-60), as implemented.** No Intos weights are vendored and nothing in opf-render changes (the lazy-font count stays at 94 faces, no core count entry). Instead the parity harness states what "metric" means for a weight the exporter cannot write: in `font-availability.mjs` (`resolveDrawnFamily`, `asExportedFace`) a drawn weight counts at the tier of the face `toPptx` selects for it (`exportedFaceWeight`: bold from 600, regular below; the parity text check compares the same bit), **when the preview draws exactly that face** (the same resolved family and weight that the exported weight resolves to) and that face is metric. No width tolerance changes; a route whose own tier is visual stays visual at every weight; a host that would draw a different face (for example Regular for a Bold request) gets no exemption; the raw registry tier is kept as `rawCompatibility` and the legacy (pre-owner-decision) definition still reads it. Unit tests: `font-availability.test.mjs` (Aptos 500, 600, 800 pass; visual-only route stays near; mismatched face gets no exemption; `exportedFaceWeight`).
- **Result** (local, one core `da3f886`, opf-render `55e1b51` plus the FF-59 branch, opf-pptx `c08105f` plus the FF-59 branch, pptx-gallery `fa8a965`; no Office; [PARITY-2026-09-30-weight-faces.md](gallery-support/parity/PARITY-2026-09-30-weight-faces.md)): all 850 values 688 perfect, 161 near, 1 mismatch to **738 perfect, 111 near, 1 mismatch**; fontResolution near values 143 to 93. 50 values change class, all near to perfect: the 48 Aptos values and two Georgia blocks (`customer-journey`, `quote-slide`: Georgia at 500 and 800 against Gelasio Regular and Bold). The other 93 near values are other families; no other check changes for any value.
- **Still open, not done here.** Making the PPTX name the weight (`Aptos SemiBold`, `Aptos ExtraBold`, real Microsoft 365 cloud fonts) would need matching faces (Semibold for Intos Display and ExtraBold for both have no upstream) and Aptos SemiBold and ExtraBold measured through PowerPoint (root). Authoring 400 and 700 only for the Aptos gallery layouts is a design change. Neither is planned.

### Low-contrast tags (FF-61, 2026-09-30)

With the tag drawn in the scheme primary (FF-59), 10 of the 95 tags in the core example corpus are below 4.5:1 against the slide background, in the preview as in the PPTX, which already wrote these colours (contrast computed against the first fill rect of the slide SVG; approximate):

| example | tag colour | background | contrast |
|---|---|---|---|
| gallery/industries/rural-broadband-expansion-proposal | `FE938C` | `FFFFFF` | 2.15 |
| gallery/industries/food-bank-distribution-capacity-plan | `6A1B9A` | `000000` | 2.24 |
| gallery/business-functions/partner-ecosystem-launch-kit | `4A1BE4` | `000000` | 2.57 |
| gallery/business-functions/onboarding-experience-redesign | `F77F00` | `FFFFFF` | 2.63 |
| gallery/government/digital-services-modernization | `9E9E9E` | `FFFFFF` | 2.68 |
| gallery/industries/ambulatory-access-recovery-plan | `9E9E9E` | `FFFFFF` | 2.68 |
| gallery/presentation-types/monthly-board-update | `9E9E9E` | `FFFFFF` | 2.68 |
| gallery/government/grant-equity-review | `A41410` | `000000` | 2.69 |
| gallery/business-functions/fy27-budget-tradeoff-deck | `FD3223` | `FFFFFF` | 3.71 |
| gallery/education/stem-lab-funding-proposal | `997929` | `FFFFFF` | 4.10 |

A fix is a design choice for both engines together (for example, fall back to the text colour, or a contrast-adjusted primary, when the primary is under 4.5:1 against the slide background, in the renderer and the exporter with the same rule). Tracked as FF-61; not started.

## Layouts

485 measured entries: 415 canonical OPF layout ids (30 in the core bundled
catalog: 15 under the Dark master and 15 under the OPF master; 385 carried by
the snippet as inline `catalogs.layouts.records`) plus 70 legacy gallery-master
slugs with no OPF canonical id (`gallery-only`; all 70 measured `partial`).

- **Works.** Every snippet validates, previews and exports. None is `works`.
- **Doesn't.**
  - The core catalog has 30 of the 415 canonical ids; the rest are portable
    only as inline records.
  - The preview shows a layout effect for 387; export placement differs from
    the no-layout default for 277. 98 are identical to the default in both.
  - Re-import keeps the layout id for 0 of 485: 81 drop it silently (geometry
    flattened), 404 with import diagnostics that do not name the layout (for
    example `heading-import-reflow`).
  - If a re-import that drops the id with any diagnostic counted as a pass,
    211 of 485 would be `works`.
- **Preview vs export.** 110 layouts change the preview but not the PPTX
  shape placement.
- **Fonts.** Layout snippets use the default scheme; see the registry probe
  above.
- **Parity (FF-38).** On the September 30 published set, 483 of 485 perfect,
  2 near and 0 mismatch (September 29: 444, 2 and 39). The 39 that failed
  embedded a native chart whose series colours the preview did not paint;
  opf-render 0.11.3 draws the classic charts, so they agree now. Geometry,
  text, z-order and mapping pass for every layout.
- **Fixes.** FF-29 (catalog parity, export placement, re-import id or specific
  diagnostic); FF-31 (fonts).

### Layout contracts and canonical ids (FF-52, FF-55, 2026-09-30)

Layouts only (audit A, ONLY=layouts), published engines (opf-render 0.11.4 `1a724a6`, opf-pptx 0.11.3 `ecdbb42`), one local core (`register-local-opf.mjs`), no Office:

| Layouts (485) | Core `0f60d3d` (before FF-51) | Core `be4bd221` (main, FF-51 audit) | This change (core PR + [pptx-gallery#70](https://github.com/Data-Advantage/pptx-gallery/pull/70)) |
| --- | --- | --- | --- |
| `works` | 291 | 341 | 440 |
| `partial` | 124 | 74 | 45 |
| `gallery-only` | 70 | 70 | 0 |
| reason "legacy gallery slug with no OPF canonical id" | 70 | 70 | 0 |
| reason "geometry identical to the no-layout default" or "preview identical with and without layout" | 69 | 69 | 0 |

The 45 `partial` layouts carry only reasons other items own: image re-import (24, FF-53), quote re-import (3, FF-57) and text-overflow or small-cell diagnostics (18 with 12 overlaps, FF-54). The FF-38 parity audit on layouts is unchanged before and after (483 of 485 perfect, 2 near, 0 mismatch). `support-status.json` is not regenerated here (FF-58); the numbers come from local audit runs on the heads above.

**FF-55: canonical ids.** The gallery already published the 70 legacy slugs (`master: "Gallery"`) as schema-valid `opf-layout/v1` records under their own id, but the core snapshot bundled only 30 of its 485 layouts, so a snippet carried the rest as inline `catalogs.layouts.records` and the audit classed the 70 as `gallery-only`. `sync-gallery-catalog.mjs` gains `--include <kind>:<id>[,<id>...]`, which adds published ids to a subset kind once (the snapshot then keeps them, as it keeps every id). The layouts snapshot is now 100 records (30 core plus the 70 legacy ids), synced from pptx.gallery `2c7cc73` (pptx-gallery#70, merged: the FF-52 contracts); the other 385 gallery layouts (Dark master) stay gallery-only and portable through inline records. Nothing is retired and no slug changes. The gallery snippet builder already inlines a layout record only when the pinned `@openpresentation/opf` does not bundle the id, so once this snapshot ships in a core release and the gallery pin moves, the 70 snippets name the id directly with no `catalogs`. Until then the gallery's inline record keeps them portable, and the audit, which links the local core, already reports them as core-catalog ids. The 70 ids also become valid narrative `layoutHint` values for `check:spec` rule (e); restoring the hints is not part of this item.

**FF-52: 69 layouts, three outcomes.** Decisions are recorded here and in the README Decisions (owner can veto; nothing was retired or removed from the gallery listing):

- **(a) Fix the contract (25 legacy layouts).** `data/layouts.json` gives each a `composition` or `contentBox` from a small vocabulary that both engines compose: gutter (`{ mode: "row", gap: 0.06 }`), primary (`weights`), narrow (`padding: 0.12`), wide (`padding: 0.04`), cards (`contentBox: true`, the convention 19 legacy layouts already use). The audit sees a different preview and different export placement for every one, with no new diagnostic. These are minimal distinguishing geometry; richer designs for sparse legacy layouts (for example `executive-summary`) are a later improvement, not required for FF-52.
- **(b) Alias (24 Dark-master variants).** A layout whose placeholders and composition are those of a core layout, differing only by design attributes the engines do not read (title-left where left is the default, itemimage bullets, crop/fit that the default equals), carries `deprecation.replacedBy` and stays resolvable, published and listed. There is no layout-hiding convention (charts were removed with redirects; that is a retirement and needs the owner), so aliases stay in the gallery listing. Audit A measures the replacement instead of the default: the same slide with only the layout id swapped must draw the same SVG and place the same export shapes (`checks.alias`), and the replacement must be bundled and not itself deprecated. All 24 are equivalent. Where an engine later reads one of those attributes (for example `design.listBullet`), the alias must stop being one.
- **(c) Baseline (20 core layouts).** `blank`, `title`, `title-subtitle`, `text-1x`, `text-2x`, `text-3x`, `list-1x` to `list-6x`, `image-1x`, `image-2x`, `image-3x`, `code-1x`, `media-1x`, `quote-1x`, `table-1x` and `timeline-1x` are the engine default arrangement for their content. Audit A lists them by name (`DEFAULT_BASELINE_LAYOUTS`); the list is exact, and a layout added to it needs a review of its contract.

| Layout | Source | Before | Decision | Contract or target | After (audit A) |
| --- | --- | --- | --- | --- | --- |
| `two-column` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,gap:0.06}`: two equal columns with a wide gutter | works |
| `three-column` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,gap:0.06}`: three equal columns with a wide gutter | works |
| `stats-metrics` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,gap:0.06}`: three metric tiles with a wide gutter | works |
| `data-visualization` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,weights:[2,1]}`: the chart takes two thirds, supporting text one third | works |
| `waterfall-bridge` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,weights:[3,1]}`: the bridge chart takes three quarters, the walk notes one quarter | works |
| `forecast-scenario` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,weights:[3,2]}`: the forecast chart takes three fifths, the scenario text two fifths | works |
| `org-chart` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{mode:row,weights:[2,1]}`: the org chart takes two thirds, the secondary chart one third | works |
| `bullet-list` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin keeps the bullet measure short | works |
| `funnel-pyramid` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin narrows the funnel stack | works |
| `executive-summary` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin keeps the summary measure short | works |
| `executive-decision` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin frames one decision statement | works |
| `qa-discussion` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin around the centred question | works |
| `appendix-index` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.12}`: a wider margin around the index heading | works |
| `timeline` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.04}`: a tight margin gives the timeline the full canvas | works |
| `gantt-project-plan` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.04}`: a tight margin gives the plan the full canvas | works |
| `heatmap-cohort` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.04}`: a tight margin gives the cohort grid the full canvas | works |
| `customer-logos` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `{padding:0.04}`: a tight margin gives the logo wall the full canvas | works |
| `faq` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: the question and answer block sits on a card | works |
| `process-flow` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: the process steps sit on a card | works |
| `roadmap` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: the roadmap sits on a card | works |
| `before-after` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: before and after sit on two cards | works |
| `pros-cons` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: pros and cons sit on two cards | works |
| `architecture-stack` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: the layered stack sits on a card | works |
| `status-rag` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: the status statement sits on a card | works |
| `assumptions-dependencies` | legacy | gallery-only (measured partial), geometry identical to default | (a) fix the contract | `contentBox: true`: assumptions and dependencies sit on a card | works |
| `chart-1x-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: chart-1x` | works |
| `image-1x-fit` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-1x-fit-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-only-1x-crop` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-only-1x-crop-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-only-1x-fit` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-only-1x-fit-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-1x` | works |
| `image-2x-fit` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-2x` | works |
| `image-only-2x-crop` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-2x` | works |
| `image-only-2x-fit` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: image-2x` | works |
| `list-1x-itemimage` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-1x` | works |
| `list-1x-itemimage-vertical` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-1x` | works |
| `list-1x-itemimage-vertical-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-1x` | works |
| `list-1x-vertical` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-1x` | works |
| `list-1x-vertical-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-1x` | works |
| `list-2x-itemimage` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-2x` | works |
| `list-4x-itemimage` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-4x` | works |
| `list-5x-itemimage` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-5x` | works |
| `list-6x-itemimage` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: list-6x` | works |
| `text-1x-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: text-1x` | works |
| `text-1x-title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: text-1x` | works |
| `text-2x-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: text-2x` | works |
| `title-left` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: title-subtitle` | works |
| `title-left-box` | Dark variant | partial, geometry identical to default | (b) alias | `deprecation.replacedBy: title-subtitle` | works |
| `blank` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `code-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `image-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `image-2x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `image-3x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `media-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `quote-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | partial: re-import quote |
| `table-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `text-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `text-2x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `text-3x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `timeline-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `title` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `title-subtitle` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-1x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-2x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-3x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-4x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-5x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |
| `list-6x` | core | partial, geometry identical to default | (c) baseline | listed by name in audit A: the layout is the engine default for its content | works |

A decision can be reversed per row: an (a) contract is a data edit in the gallery, and an (b) alias is removed by deleting its `deprecation`, after which the audit flags it as identical to the default again.

## Color schemes

14 values, all `works` on the September 30 published set (`partial` before opf-pptx 0.11.2). Every id resolves in core.

- **Now (audit B, 2026-09-30).** `works` 14: no reason is left. opf-pptx 0.11.2 writes `a:schemeClr` references, so no slide colour is a
  literal scheme slot colour; the theme `clrScheme` matches 12/12; preview and export colours agree on every slide, backgrounds included; re-import
  returns the colour scheme id for 14 of 14. The bullets below are the history.
- **Works.** Preview and export apply the scheme colours and agree slot for
  slot (at least five scheme colours used per deck).
- **Doesn't.** Colours are exported as literal `srgbClr`, not `schemeClr`, and
  the theme `clrScheme` is the Office default: it matches 2 of 12 slots (4 of
  12 for `corporate-blue`). Recolouring the deck in PowerPoint therefore does
  not follow the chosen scheme.
- **Re-import.** The colour scheme id is dropped silently (14/14).
- **Now (audit B, opf `33d636d`).** `partial` 14. The theme `clrScheme`
  matches 12/12 slots, 11 of 55 slide colour uses per deck are `schemeClr`,
  and resolved through the theme they agree with the preview on every slide,
  backgrounds included. 42 uses still write a scheme slot colour as literal
  `srgbClr` (for example text in `light1`), which FF-24 asks to be
  `schemeClr`. Re-import returns the colour scheme id for 14 of 14.
- **Parity (FF-38).** 14 of 14 perfect on the September 30 published set.
- **Fixes.** FF-24 (theme colours and scheme references), FF-32 (re-import).

## Font schemes

93 values (89 upstream catalog schemes and 4 legacy gallery schemes that the
gallery inlines, not in the core catalog), all `partial`.

- **Works.** Export without a registry writes the chosen major/minor families
  into the theme and runs, with no foreign typeface, for all 93.
- **Doesn't.**
  - Theme `ea`/`cs` are empty for all 93 (FF-07, FF-49). This is the only reason left (2026-09-30, FF-48).
- **Preview (FF-48, 2026-09-30).** Font availability is decided against the modelled gallery host and the owner font policy
  ([below](#audits-model-the-shipped-font-host-ff-48-2026-09-30)), not strict no-host previews. The host draws all 93 (opf-render 0.11.4):
  33 with the families themselves (open or Noto families, including Raleway and Noto Sans Mongolian), 5 with a metric-compatible policy replacement
  (`aptos` with Intos, `calibri` with Carlito, `courier-new` with Cousine, `georgia` with Gelasio, `times-new-roman` with Tinos) and 55 with a visual-only replacement, in each case
  with the PPTX naming the selected family. Each scheme's route is in [audit-b/font-schemes.md](gallery-support/audit-b/font-schemes.md).
  The strict readings (base pack throws `font-unavailable` for 92 of 93; 5 non-Latin schemes fail their sample text under it) are kept as diagnostics.
- **Preview vs export.** With the office pack and visual substitution passed to `toPptx`, the
  preview renders the substitute and the export then writes it, so the chosen
  family is lost (a diagnostic, not the shipped path; 7 schemes plus the `minimal` theme). Without a registry, export always succeeds with the
  chosen names, and that is what the audit classifies.
- **Re-import.** `fontScheme` is dropped silently.
- **Fonts and licensing.** See [Fonts in every environment](#fonts-in-every-environment).
- **Parity (FF-38).** 38 of 93 perfect, 55 near and none mismatched on the 2026-09-30
  renderer 0.11.4 run (36, 54 and 3 on the gallery-font-host run before it; 14, 18 and 61 before that).
  The gallery-font-host run: Font resolution:
  the 22 schemes whose family is a pinned Noto face became perfect, 54 are near (36 of them newly: a
  proprietary script font drawn with its Noto replacement; the other 18 were near before), and 3 fail: `raleway` and the legacy
  `classic-editorial` (Playfair Display), which are not bundled, and `noto-sans-mongolian`, whose
  face cannot shape text. opf-render 0.11.4 bundles the first two and shapes the third: `raleway` and `noto-sans-mongolian` are perfect, and
  `classic-editorial` is near (its Source Sans Pro body is a visual-only replacement).
- **Fixes.** FF-31 (availability, substitution never rewrites export), FF-35
  (shared default), FF-07 and FF-08 (script slots, no leaked defaults), FF-17
  (code role), FF-32 (re-import).

## Languages

93 values, all `partial`. Audit B derives the class from measured fields
only (re-run at opf `33d636d`, opf-pptx `9092954`, opf-render `bc436f3`;
see the [measurement notes](#measurement-notes-2026-09-23-re-run)). Every id
resolves in core.

- **Works (FF-07, FF-19, FF-32).**
  - Removing `language` changes both the preview and the export for all 93.
    In the preview the only change is the SVG `lang` attribute. The export
    parts that change include the slide, masters, theme and
    `ppt/tags/opfDocument.xml`.
  - Slide runs carry exactly the catalog `ooxmlLang` for 93 of 93, for
    example Arabic `ar-SA`, Japanese `ja-JP`, Norwegian `nb-NO` and
    Chittagonian `bn-BD`. Only the two English entries export `en-US`.
  - Direction is measured on the gallery's native name used as the title. The
    six right-to-left languages (Arabic, Hebrew, Pashto, Persian, Urdu and
    Punjabi (Shahmukhi)) export `rtl="1"` on that paragraph, and the preview
    marks the same line right-to-left, 1 of 1 each. No left-to-right language
    has an `rtl` paragraph. The snippet's own Latin subtitle is written
    `rtl="0"`. The earlier count of 39 `rtl` attributes was package-wide
    (presentation, master and notes defaults), not slide paragraphs.
  - The native name uses the `cs` font slot for 21 languages and `ea` for 4
    (the parity harness's script test). In each, the runs name the language's
    font in that slot. For the 24 languages whose scheme is not `aptos`,
    theme major/minor `ea` and `cs` carry the language's font, for example
    Arabic Typesetting, Shonar Bangla and Microsoft YaHei. No foreign typeface
    appears in any export.
  - Re-import returns the language id for 93 of 93, and the font scheme with
    it.
- **Font availability (FF-48, 2026-09-30).** Not a gap. Under the strict no-host previews the language's font scheme was "not bundled" for all 93 and 26 hit `missing-glyph`
    on bundled Roboto (Amharic, Arabic, Armenian, the Indic scripts, CJK, Georgian, Hebrew, Khmer, Persian, Pashto, Thai, Urdu and others). The modelled gallery host loads the script
    faces the native name needs (`ensureScripts` on the probe's own document) and draws all 93 native names; the 66 languages on `aptos` preview with Intos and the PPTX names Aptos
    ([audit-b/languages.md](gallery-support/audit-b/languages.md), column `gallery host preview`). This was FF-31 and FF-19; the strict readings are diagnostics.
- **Remaining gaps.**
  - Theme `ea`/`cs` stay empty for 69 languages: the 66 on `aptos`, plus
    Amharic (Nyala), Armenian and Georgian (Sylfaen). Whether those empty
    values are allowed depends on FF-05. Amharic and Georgian native text uses
    the `cs` slot, so audit B records it as a reason for those two.
  - The engines do not yet derive the font scheme from `language` alone
    (`engineAppliesLanguageFontScheme` false for all 93). The visible font
    comes from the `design.fontScheme` that the gallery snippet injects (FF-50).
- **Native finding (FF-04, not yet a merged evidence bundle).** PowerPoint's
  `Presentation.Fonts` for an unedited exporter deck lists a nameless font and
  `Aptos` at open. Filling theme major/minor `ea`/`cs` (Carlito) did not change
  that list, so the empty script slots are not the source of the at-open
  `Aptos` (FF-05 continues).
- **Parity (FF-38).** 66 of 93 perfect, 27 near and none mismatched on the 2026-09-30
  gallery-font-host run and again on the renderer 0.11.4 run (was 66, 2, 25). Geometry, text, fills, z-order,
  typefaces, re-import, theme and mapping pass for all 93. The 25 languages whose
  scheme is a proprietary script font are near: the editor's font gate loads the
  Noto replacement, a visual tier.
- **Fixes.** FF-31 (font availability), FF-19 (script fonts), FF-05 (empty
  `ea`/`cs` policy).

## Backgrounds

6 values, all `works` on the September 29 merged heads (audit A; 2 at the first measurement).

- **Works.** Solid and gradient backgrounds export as native `solidFill` and
  `gradFill`. The three pattern slugs are distinct OPF backgrounds
  (`geometric-pattern` is `openDmnd`, `abstract-shapes` is `wave`,
  `minimal-texture` is `pct5`), each exported as a native `a:pattFill` with
  that preset in `p:bg` and returned by re-import as a pattern. `photography`
  carries its own `assets.cover` (pptx-gallery#43), exports as `a:blipFill`
  in `p:bg` and re-imports as an image background.
- **Preview vs export.** None disagree.
- **Parity (FF-38).** 6 of 6 perfect, and 6 of 6 with an image supplied.
- **History.** At the first measurement the three patterns collapsed to one
  OPF background, the export wrote solid white with no `pattFill`, and
  `photography` referenced `asset:cover` without an `assets` entry.
  Audit A itself was updated (2026-09-29): it hard-coded `pct5` as the expected
  preset and assumed a missing asset, so it now reads the preset and the assets
  from the snippet.
- **Fixes.** FF-25 (engine halves and pptx-gallery#43 merged).

## Narratives

10 values: `authoring-metadata` 1 (`problem-solution`), `gallery-only` 9.

- **Role.** Narrative is authoring metadata: it is consumed by
  validator/lint/bundle catalog checks, opf-editor transfer mapping and
  authoring skills. It currently has no effect on preview or export
  (byte-identical when removed). The narrative schema describes a story arc of
  beats and does not state a render role.
- **Doesn't.** 9 of 10 gallery ids (`heros-journey`, `what-so-what-now-what`,
  `situation-complication-resolution`, `star-method`, `pyramid-principle`,
  `sparkline`, `data-story`, `change-story`, `vision-roadmap`) are not in the
  core narratives catalog. Validator and lint warn. The same ids make 24
  content blocks `partial`.
- **Re-import.** Dropped silently.
- **Parity (FF-38).** 0 of 10 perfect. Re-import drops the narrative with no
  diagnostic.
- **Fixes.** FF-28.

## Charts

26 gallery chart objects, reduced under FF-22 to the chart types Aspose.Slides
supports:

- **Core half, merged.** [opf#121](https://github.com/OpenPresentation/opf/pull/121) (`13ab00b`) keeps 26 non-deprecated chart-type
  records, one per supported Aspose.Slides `ChartType`. It deprecates the other 50 with a
  named replacement rather than deleting them. See
  [aspose-chart-types.md](aspose-chart-types.md).
- **Gallery half, merged.** [pptx-gallery#40](https://github.com/Data-Advantage/pptx-gallery/pull/40) (`23f9216`) reduces
  `data/charts.json` from 76 to the same 26 types; `b2238ac` (pptx-gallery#63) gives the snippets category-major data.
- **Engines.** opf-render 0.11.3 previews the 19 classic constructs natively
  (`data-opf-chart` on the chart group); opf-render 0.11.4 also previews the seven chartex ids natively (#66); opf-pptx 0.11.2 exports the classic ones as native
  constructs and reports the seven chartex ids as a `chart-data-adapted`
  fallback (opf-pptx 0.11.3 adds an opt-in native chartex export, FF-22b; the default is unchanged, FF-56).
- **Follow-up.** FF-22b covers native `chartex` export and renderer coverage for
  the seven chartex types, and a native PowerPoint check of the classic constructs.

Measured on the September 30 published set with opf-render 0.11.4 (core `3e1cbf0`, opf-render `1a724a6`, opf-pptx `ecdbb42`, pptx-gallery `59ff36c`) by audit B (pipeline)
and the parity audit, per type (the seven chartex rows are the only ones that changed from the earlier September 30 run on opf-render 0.11.3, `a66caa3`: their preview and parity):

| Gallery chart | Pipeline | Preview | Export | Re-import | Parity | text | fills |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `column` | works | column (marks match) | barChart, barDir col, grouping clustered | column | near | near | pass |
| `stacked-column-3x` | works | stacked-column-3x (marks match) | barChart, barDir col, grouping stacked | stacked-column-3x | near | near | pass |
| `100pct-stacked-column-3x` | works | 100pct-stacked-column-3x (marks match) | barChart, barDir col, grouping percentStacked | 100pct-stacked-column-3x | perfect | pass | pass |
| `line` | works | line (marks match) | lineChart, grouping standard, no markers | line | near | near | pass |
| `line-with-markers` | works | line-with-markers (marks match) | lineChart, grouping standard, markers | line-with-markers | near | near | pass |
| `stacked-line-3x` | works | stacked-line-3x (marks match) | lineChart, grouping stacked, no markers | stacked-line-3x | near | near | pass |
| `stacked-line-with-markers-3x` | works | stacked-line-with-markers-3x (marks match) | lineChart, grouping stacked, markers | stacked-line-with-markers-3x | near | near | pass |
| `pie` | works | pie (marks match) | pieChart | pie | perfect | pass | pass |
| `doughnut` | works | doughnut (marks match) | doughnutChart | doughnut | perfect | pass | pass |
| `bar` | works | bar (marks match) | barChart, barDir bar, grouping clustered | bar | near | near | pass |
| `stacked-bar-3x` | works | stacked-bar-3x (marks match) | barChart, barDir bar, grouping stacked | stacked-bar-3x | near | near | pass |
| `100pct-stacked-bar-3x` | works | 100pct-stacked-bar-3x (marks match) | barChart, barDir bar, grouping percentStacked | 100pct-stacked-bar-3x | perfect | pass | pass |
| `area` | works | area (marks match) | areaChart, grouping standard | area | near | near | pass |
| `stacked-area-3x` | works | stacked-area-3x (marks match) | areaChart, grouping stacked | stacked-area-3x | near | near | pass |
| `100pct-stacked-area-3x` | works | 100pct-stacked-area-3x (marks match) | areaChart, grouping percentStacked | 100pct-stacked-area-3x | perfect | pass | pass |
| `scatter` | works | scatter (marks match) | scatterChart, scatterStyle marker | scatter | near | near | pass |
| `radar` | works | radar (marks match) | radarChart, radarStyle standard, no markers | radar | near | near | pass |
| `radar-with-markers` | works | radar-with-markers (marks match) | radarChart, radarStyle marker, markers | radar-with-markers | near | near | pass |
| `filled-radar` | works | filled-radar (marks match) | radarChart, radarStyle filled, no markers | filled-radar | near | near | pass |
| `treemap` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `histogram` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `pareto` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `world` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `box-and-whisker` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `waterfall` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |
| `funnel` | partial | legacy sketch | barChart, barDir col, grouping clustered (chartex-fallback) | column | mismatch | fail | pass |

**Pipeline (audit B, 2026-09-30): 19 `works`, 7 `partial`.**

- **Works (19).** The traced preview draws the id (`data-opf-chart` equals the id, no "No chart data", no legacy sketch) and its marks match the data (bars: rows x series;
  one polyline per line series and one circle per point with markers; one area or radar path per series; one slice per positive pie or doughnut value; one circle per scatter
  point). The export has one chart part whose element, `barDir`, `grouping`, marker, `radarStyle` and `scatterStyle` equal core's `mappings.openxml` for the id, the
  series values and labels equal the source data, the workbook is embedded and no diagnostic is reported. `fromPptx` returns the same id and data.
- **Partial (7): the chartex ids** `treemap`, `histogram`, `pareto`, `world`, `box-and-whisker`, `waterfall`, `funnel`. Since opf-render 0.11.4 (#66) the preview draws each natively (`data-opf-chart` equals the id; the audit's mark-count rule has no chartex kind, so
  the marks are not counted for these seven). The export still writes a clustered column chart of the data and reports `chart-data-adapted` (`chartex-fallback`), and
  re-import returns `column`. The data is not lost, but the chart the id names is not exported (FF-56 flips the default to the native chartex export after the native PowerPoint check).

**Parity (FF-38): 8 perfect, 18 near, none mismatched of 26** (the earlier September 30 run on opf-render 0.11.3: 5, 14, 7; September 29: 0, 0, 26). Geometry, fills, z-order, slide size, typefaces (FF-08), re-import, theme, font
resolution and mapping pass for all 26. The five perfect charts are `100pct-stacked-column-3x`, `100pct-stacked-bar-3x`, `100pct-stacked-area-3x`, `pie` and `doughnut`. The other 14
classic charts are near for one reason: a native chart lays out its own labels, so a label the preview wraps is one line in the chart cache. The chartex charts
failed text on opf-render 0.11.3 (the legacy sketch's labels, "Q1 2024", ..., were not in the exported column chart's caches). With the native chartex preview `treemap`, `world` and `funnel` are perfect, and
`histogram`, `pareto`, `box-and-whisker` and `waterfall` are near for the same native-label wrapping as the classic charts.

**The harness change (2026-09-30).** Series colours are compared as each construct paints them: a line-kind series (line, stacked line, radar, radar with markers) on its
stroke, a pie or doughnut on its slice fills with the 0.75 pt `F9F9F9` slice border that PptxGenJS writes not counted as a series colour, every other series on its
fill. No tolerance changed. With the harness as merged, the 26 charts score 3 perfect, 11 near and 12 mismatch on these heads; with the change, 5, 14 and 7. The 39 layouts
and 2 blocks that embed a native chart moved from series-colour failures to perfect with the engines (opf-render 0.11.3), not with the harness. Per-chart parity is also in
`support-status.json` (charts are items since 2026-09-30, no longer `parityOnly`). Earlier readings (76 charts, typefaces failing, series colours failing for all 26) predate the
reduction, FF-08 and the native classic constructs.

## Themes

4 values, all `works` since FF-48 (2026-09-30; `partial` before, on font availability under the strict model). Every id resolves in core.

- **Works.** Background and fonts apply in preview and export, and a
  theme-only document applies the bundle: `minimal` `011842` with Aptos
  Display/Aptos; `classic` `FFFFFF` with Tenorite; `dark` `000000` with
  Seaford; `bold` `FFFFFF` with Impact/Grandview.
- **Doesn't.** The theme `clrScheme` is the Office default (2 of 12 slots).
  Fonts: `minimal` previews only through the Carlito substitute (and exports
  Carlito if that registry is passed to `toPptx`); `classic` and `dark` fonts
  are not bundled and have no substitute; `bold` substitutes (Anton, Oswald)
  are not bundled.
- **Re-import.** Keeps only `dimensions`; the theme id is dropped silently.
- **Now (audit B, opf `33d636d`).** `partial` 4. The theme `clrScheme`
  matches 12/12, the `p:bg` `schemeClr` resolves to the expected
  background, and colours agree with the preview. Reasons: text written in a
  scheme slot colour as literal `srgbClr` (2 uses each), and fonts that are
  not bundled (`minimal` previews through Carlito). Re-import returns the
  theme id for 4 of 4.
- **Now (audit B, 2026-09-30).** Still `partial` 4, and the colour reasons are gone (opf-pptx 0.11.2 writes `a:schemeClr`); the fonts that are not bundled remain.
- **Now (audit B, FF-48, 2026-09-30).** `works` 4. The fonts are not a gap: the modelled gallery host draws the policy replacements (Intos, Figtree, Source Sans 3, Anton and Barlow) and the PPTX
  names the selected families; the policy rows are in [the FF-48 section](#audits-model-the-shipped-font-host-ff-48-2026-09-30).
- **Parity (FF-38).** 1 of 4 perfect and 3 near (visual-only fonts) on the September 30 published set.
- **Fixes.** FF-24, FF-31, FF-32.

## Audiences

14 values: `authoring-metadata` 2 (`board`, `all-hands`), `gallery-only` 12.

- **Role.** Authoring-only by design: the audience schema describes records as
  hints "used by AI-driven generation". Byte-identical preview and export when
  removed.
- **Doesn't.** 12 of 14 gallery ids are not in core. Some differ only in form
  from core ids (gallery `executive`, `investor`, `customer`, `regulatory`;
  core `executives`, `investors`, `customers`, `regulators`). Unlike
  narratives, the validator does not warn on an unknown audience. 12 snippets
  also reference a narrative missing from core.
- **Re-import.** Dropped silently.
- **Parity (FF-38).** 0 of 14 perfect. Geometry and text pass for 10 of 14.
- **Fixes.** FF-28.

## Tones

7 values, all `authoring-metadata`. Every id resolves in core.

- **Role.** Authoring-only by design: the tone schema describes voice cues
  that AI-driven generation uses to shape output. Byte-identical preview and
  export when removed.
- **Re-import.** Dropped silently (FF-32 requires a diagnostic).
- **Parity (FF-38).** 0 of 7 perfect. Re-import drops the tone with no
  diagnostic.

## Socials

10 values, all `works` on the September 30 published set (audit B; `authoring-metadata`
at the first measurement, `partial` before pptx-gallery#42). Every id resolves in core.

- **Role.** Decision recorded for FF-34 (pptx-gallery#42): platform records are URL
  and handle formatters, not size presets. `Speaker.socials`, glyphs and brand
  colours stay authoring metadata.
- **Works.** The gallery snippet adds a footer with `organization` and
  `socials: true`, so the organization profile URL renders in the preview and in
  the export, is linked in the PPTX and re-imports. Removing the socials changes both
  the preview and the exported slide XML (audit B, `handleInPreview` and
  `handleInExport` true for 10 of 10).
- **Icons (owner default 2026-09-30).** Icons are catalog metadata only: the
  social-platform records keep glyphs and brand colours for authoring, and no
  engine draws them. What renders and links is the profile URL. This is the
  recorded FF-34 decision; the social-platform schema description and the gallery
  `/socials` copy now say so ([opf#191](https://github.com/OpenPresentation/opf/pull/191),
  [pptx-gallery#64](https://github.com/Data-Advantage/pptx-gallery/pull/64)).
- **Parity (FF-38).** 10 of 10 perfect.
- **Fixes.** FF-34.

## Headers and footers

10 values, all `works` on the September 29 merged heads (audit A; 1 works at the first measurement).
Headers and footers are OPF furniture; native PowerPoint `p:hf` objects stay out
of scope.

- **Works.** Furniture text, the native `a:fld type="slidenum"` slide number
  and, for `brand-logo-footer`, the logo picture appear in the preview and the
  export, on the slides that show them. The snippet now expresses the gallery
  options (pptx-gallery#47): `hideOnTitleSlide` (slide-level `header`/`footer`:
  false on the title slide), the slide-number formats `{current} / {total}` and
  `A-{current}`, the date formats, and the legal line beside the classification
  line. The date and slide number sit in separate slots, and the snippets
  differ from each other (`slide-number-only` and `slide-number-progress` no longer
  emit the same OPF). `brand-logo-footer` supplies its logo asset.
- **Dates.** `dated-footer`, `client-delivery-footer` and
  `version-control-footer` carry a fixed ISO date (`2026-04-23`) with a format.
  Core treats that as static content and the exporter writes the formatted text
  (checked in the export); only a current date (`date: true`, with a host-supplied
  date) is a live field, and no gallery snippet uses one, so no `datetime` field
  is exercised here. Native confirmation that the slide-number field renumbers is
  FF-12, not measured here.
- **Editor.** `/editor?config=headers-footers:<slug>` builds the same document as
  the snippet (pptx-gallery#48; 10 of 10 identical, and the slugs differ).
- **Parity (FF-38).** 10 of 10 perfect, with or without assets (owner default
  2026-09-30). `slide-number-progress` (`{current} / {total}`) and
  `appendix-numbering` (`A-{current}`) write the slide number as a native field
  next to literal text, which is two elements where the preview draws one run;
  a native slide-number field plus adjacent literal runs now counts as one run
  when the combined text equals the preview text (they were near on September 29).
  Z-order, which failed for all 10 at the first measurement, passes.
- **Fixes.** FF-27, FF-33.

## Content blocks

32 values on the September 29 merged heads: `works` 31, `partial` 1 (audit A;
5 at the first measurement, 29 at September 23).

- **Doesn't.** `quote-slide` loses the `quote` payload kind on re-import (one
  `heading-import-reflow` diagnostic only). Since FF-28 the narrative ids resolve, and
  `market-opportunity` and `financial-snapshot` keep every metric string in the
  preview and the export (pptx-gallery#44 and #49), without the `text-overflow`
  diagnostic.
- **Editor.** `/editor?config=blocks:<slug>` builds the same document as the
  snippet (pptx-gallery#48; 32 of 32 identical, and the slugs differ).
- **Parity (FF-38).** 21 of 32 perfect, 8 near (visual-only fonts), 3 mismatch:
  `pitch-deck-intro`, `section-break` and `closing-cta` differ in a text colour
  (fixed by FF-59: 21 perfect, 11 near, 0 mismatch, see
  [Tag text colour](#tag-text-colour-ff-59-2026-09-30)).
  `financial-snapshot` and `data-story-insight`, which embed a native chart (a
  line and a bar series), were mismatches on September 29 and are perfect now.
- **Fixes.** FF-28, FF-30, FF-33, FF-59.

### Tag text colour (FF-59, 2026-09-30)

The three mismatches of the FF-58 parity run ("text color 000000 vs 2874A6", "000000 vs F77F00", "000000 vs A41410"; first value the preview, second the PPTX) were recorded as "the PPTX run carries no explicit colour where the preview draws the accent". The measurement says the opposite, and the record above is corrected:

- **Preview.** `renderTextPayload` in opf-render drew every text payload with `colors.text`, so the slide `tag` was black (`000000`) on these white slides.
- **Export.** opf-pptx has written the tag in the deck "accent" since its first exporter (`2c58c58`), a literal `srgbClr`. Its `colors.accent` is the scheme's primary (`colorScheme.primary`, else `accent1`), which is the preview's `colors.primary`; the preview's own `colors.accent` is `accent3`. The gallery's own block preview also draws the eyebrow in its accent. The tag is the eyebrow label, so the accent is the design intent and the preview was the outlier.
- **Fix.** [opf-render#79](https://github.com/OpenPresentation/opf-render/pull/79) draws the tag in `colors.primary`; [opf-pptx#115](https://github.com/OpenPresentation/opf-pptx/pull/115) writes it as `a:schemeClr accent1` where the deck theme's accent1 holds exactly that colour (every catalog scheme) and as the literal otherwise (a scheme with a separate `primary`, a slide with its own scheme), the FF-24 rule for engine chrome. The colour does not change in PowerPoint.
- **Before and after** (local, one core `da3f886`, opf-render `55e1b51` and the branch `425285c`, opf-pptx `c08105f` and the branch `848fc50`, pptx-gallery `fa8a965`; no Office; [PARITY-2026-09-30-tag-colour.md](gallery-support/parity/PARITY-2026-09-30-tag-colour.md)): blocks 18 perfect, 11 near, 3 mismatch to 21, 11, 0; all 850 values 685 perfect, 161 near, 4 mismatch to 688, 161, 1 (the `histogram` chart cache remains). Only the three blocks change class. The preview change touches 95 of the 805 core example slides, each only in the fill of its tag text; the export change touches 24 of 976 exports (the tag run fill and the style-signature hash in `opfSlide1.xml`), and nothing else.
- **Contrast.** 10 of those 95 tags are below 4.5:1 against their background (8 below 3:1, lowest 2.15:1; the ten are listed under [Low-contrast tags](#low-contrast-tags-ff-61-2026-09-30)), in the preview as already in the PPTX. No contrast adjustment is made: it would have to land in both engines together.
- **Same role elsewhere.** Only the `tag` field uses this role. Metric values and timeline markers also use the literal primary in the export (and `colors.primary` in the preview); they already agree and stay literal.

## Image treatments

15 values, all `works` on the September 30 published set (owner default 2026-09-30; `schema-only` or `partial` on the retained September 23 rows).

- **What `works` means (owner default 2026-09-30).** The treatment's actual design output, as the gallery snippet emits it (a layout image, image blocks, an
  image slide background, `design.watermark`, `imageFill`), is written natively into the PPTX and re-imports. Audit A's probe
  ([`image-treatment.mjs`](gallery-support/audit-a/scripts/image-treatment.mjs), with negative controls) checks that the snippet's declared images equal the
  images the traced preview draws; that the slide has that many native image references (`p:pic`, or the `a:blipFill` of the slide, layout or master background), each
  resolving to an image part with the preview's bytes; that a watermark is the picture `OPF watermark` with `a:alphaModFix` equal to its opacity and an image background's
  opacity is its blip's `a:alphaModFix`; and that `fromPptx` returns the same images and bytes and keeps the watermark, the image background with its opacity and
  `imageFill`. Frames and crops are parity checks (0.02 pt).
- **What the merged snippets do (pptx-gallery#44).** The treatments no longer
  reference a missing `asset:hero`: each snippet carries its image (`hero`, plus
  `cutout` for `cutout-subject`) and expresses the treatment with the closest OPF v1
  structure: `image-bleed` layouts with `imageFill`, image slide backgrounds
  (`text-overlay` and `caption-overlay`, and with an opacity `duotone` and
  `background-blur`), image blocks in rows and columns, and `design.watermark` for
  `watermark`. The gallery labels each item: 7 `native` (`full-bleed`,
  `side-by-side`, `image-strip`, `collage-grid`, `cutout-subject`, `watermark`,
  `cinematic-crop`), 2 `composed` (`text-overlay`, `caption-overlay`) and 6 `gap`
  (`masked-shape`, `circular-crop`, `rounded-card`, `duotone`, `background-blur`,
  `device-frame`), because OPF v1 has no image masks, corner radii, filters or device
  frames; the gap items keep the nearest composition and say so in `opfGapNote`.
  Under the owner's definition a gap item is `works` when that nearest composition is
  native: `works` does not mean the mask, blur, duotone or device frame is applied. The
  gallery label and `opfGapNote` are the statement of that gap (they are kept in
  [`audit-a/results.json`](gallery-support/audit-a/results.json) under `gallery`).
- **Measured (audit A, 2026-09-30).** 15 of 15 `works`, with and without a supplied
  image (the snippets carry their own images): the preview draws the declared images,
  the export has the same number of native pictures or background blips with the same
  bytes (the watermark at `alphaModFix` 12000, `duotone` and `background-blur`
  backgrounds at 55000 and 35000), and re-import returns the images, the
  backgrounds with their opacity, the watermark and `imageFill`. Seven re-import a crop
  with the `unsupported-image-crop` diagnostic (`side-by-side`, `masked-shape`,
  `circular-crop`, `rounded-card`, `image-strip`, `collage-grid`, `cinematic-crop`): the
  image and `imageFill` come back, and the crop rectangle is not a block property. The 15
  snippets are 15 distinct OPF documents, and the editor route
  (`/editor?config=image-treatments:<slug>`, the per-item builder) equals the snippet for 15 of 15.
- **Export.** Pictures export natively (`p:pic`, `a:blipFill` backgrounds), and the
  watermark exports as one `OPF watermark` picture with `alphaModFix` opacity
  (opf-pptx#104, released as 0.11.1).
- **Parity (FF-38).** 15 of 15 perfect, with and without a supplied image, on the
  September 30 published set: the preview images, their frames and crops, the
  bytes and the z-order agree with the export. Perfect does not mean the effect is
  supported: masks, blur, duotone and frames are the documented gaps above.
- **Fixes.** FF-26, FF-33.

## Re-running

The presence audits are the regression check for the gaps fixed by FF-24 to
FF-39. The FF-38 parity audit is the progress scoreboard: the baseline is 0 of
900 perfect, against a presence baseline of 7 of 793 `works`. See
[gallery-support/README.md](gallery-support/README.md) for the commands for
both, and regenerate `support-status.json` after every run.
