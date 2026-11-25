# Experiments for one Keynote run (OPF 0.36.0, Keynote 16.0)

Written 2026-11-25 ~17:55 UTC. Nothing here has been opened in Keynote yet. `$W` = `/Users/michael/opf-work/keynote-036`.

- `MANIFEST.tsv`: one line per file: path, group, id, variant, source, what was changed, what to look at in Keynote (and on which
  slide), the control to compare against. A control row says whether Keynote already opened the same bytes in the main passes
  (and where its output is).
- `pptx-list.txt` (192 files): `<absolute path> TAB <group>__<id>__<variant>`, for `tools/kn-run --list`.
- `pptx-list-new.txt` (161 files): the same without the 31 controls whose bytes Keynote already opened (their output is in
  `$W/keynote/036/...` or `$W/keynote/0351/...`, named in MANIFEST.tsv). Use it if time is short; the full list keeps every
  comparison in one run.
- Suggested run: `tools/kn-run --list experiments/pptx-list.txt --out keynote/036/experiments --probe --pptx-back`
  (`--pptx-back` is needed for every round-trip question: RT-*, LY-05*, LY-06, and the back.pptx checks below).
- Every XML variant is made by its group's `make.py` (re-runnable; `python3 make.py` in the folder). They copy the source
  `.pptx` entry by entry with the same ZipInfo, change only the named parts (string edits), and check: the zip tests clean,
  every XML part parses, every part not edited is byte-identical to the source, `tools/pptx_inspect.py --summary` reads it.
  Shared code: `_lib/xv.py`. `build_manifest.py` rebuilds MANIFEST.tsv and both lists.

## Groups

| group | files | question | how to read the answer |
|---|---|---|---|
| x-safe | 26 (13 decks: 13 default, 11 native where it differs from default, 2 static: layouts-ordinary, data-story-academy) | Do Arial-written, Arial-measured files (`--typefaces safe`) remove the Helvetica-for-Aptos breaks and overlaps (LG-01, SW-01, MX-07, MX-08, LY-01, LY-02)? | pictures against `build/036/x-safe/<deck>-safe/preview/` (see "Safe previews" below); missing-fonts banner (user interface) |
| x-smartart-shapes | 7 (3 layouts decks) | Does `--smart-art shapes` arrive as editable shapes instead of a picture? | probe.json item class on the SmartArt slides (ordinary 16, 19; little 16, 18, 19, 20) |
| x-keynote-profile | 4 (layouts-ordinary, layouts-lots, footers, data-story-academy) | The opf#1298 "Keynote profile": `--body-text native --typefaces safe --slide-numbers static` together | pictures against the safe preview; footer text "N / M"; probe.json default title/body items |
| x-min | 45 (31 ids: 31 default + 8 native with 0.36.0; 4 default + 2 native with 0.35.1 for MX-01, MX-03, SW-01, RT-01) | The graders' minimal decks (`grades/reopen-list.txt`, incl. RT-03..RT-09 added at 17:45) and two LY-05 separator controls | per id in MANIFEST.tsv; SW-02 shows only in native; LG-04's minimal deck exports identically in native and default (build.json sameAsDefault), so it may not reproduce the native-only wrap: graders/LG-04-* use the full lang-cjk native file; LY-05*, RT-01/02/04 need back.pptx |
| alt-text | 10 | Which `p:cNvPr` attribute Keynote shows as an image's Description (LY-04 base: picture + SmartArt; RT-03 base: coverage-images slide 1, which also has `title="Harbor"`) | probe.json `images[].description`; back.pptx `p:cNvPr` name/descr/title; Format > Image > Description (user interface) |
| pic-placeholders | 7 | What triggers "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside" | the Warnings panel (user interface: View > Show Warnings, or `import-notes.txt` when kn-run captured it); slide pictures unchanged |
| one-series-highlight | 7 | MX-03 / RT-01: a highlight form with one legend entry, full-width columns, the highlight color, and a back.pptx OPF can import | pictures of m-charts slides 1-3; back.pptx c:ser count, c:dPt, c:legendEntry, c:ptCount; `opf-036 convert back.pptx` imports? |
| plot-area | 3 | MX-02: does an inner (or no) manual plot area keep the bar names whole? | picture of m-negative-bars slide 8 |
| flush-space | 8 | MX-01: which line-box form ends flush in Keynote (no trailing space + 0.35.1 box; no space + 0.36.0 box; space as its own run)? | line-edge x in the slide pictures (measure as in grades/matrix-m/REPORT.md) |
| rtl-explicit | 3 | MX-06: does `rtl="0"` (or `"1"`) fix the word order of a Hebrew line with Latin words? | picture of m-text-flush-rtl slide 6; back.pptx `a:pPr rtl` |
| rtl-table | 4 | LG-02: how Keynote places a `rtl="1"` table (visual-order ltr table; x as right edge; mirrored x) | picture and probe.json table position of lang-rtl slides 1, 2 |
| title-one-paragraph | 4 | LY-01: does a one-paragraph title (wrap none or square) or normAutofit stop the third line overprinting? | pictures of layouts-lots slides 1-35 with two-line titles (13 first); probe.json title text/height |
| legend-frame | 6 | LY-03, MX-07: does a bottom legend or a manual legend layout stay in the frame? | pictures of lots 31, 36 and m-charts 5 |
| tick-skip | 3 | MX-04: does `c:tickLblSkip 1` (and line breaks) make Keynote draw all four long names? | picture of m-negative-bars slide 5 |
| label-separator | 5 | MX-05: does a per-point `showCatName` survive; does Keynote ever use `c:separator`? | pictures of m-charts 5 and 12; back.pptx |
| graders | 17 | the other experiments of `grades/experiments.md`: SW-01 (header Arial; grid 10% wider), SW-02 (native note at core's y), MX-08 (column 1 wider), LG-01 (Ethiopic theme font Kefa III), LG-04 (altLang; eaLnBrk 0), LY-02 (one wrapped box for the first column), LY-06 (slide bg removed; bg on the layout) | per row in MANIFEST.tsv (LY-06: back.pptx layout count) |
| roundtrip-xml | 9 | RT-06 (title sz 4800/4900; agenda title wrap square), RT-07 (leading RLM), RT-08 (plain numbers right-aligned) | probe.json sizes/cells; back.pptx sz, rtl, algn |
| 1416 | 24 | opf#1416 items 1-7 on the 0.36.0 corpus (see below) | per row |

### Safe previews (x-safe, x-keynote-profile)

`opf convert` refuses `--typefaces` for PNG, so `experiments/flags/make.py` draws the safe preview from a copy of the deck whose
`design.fontScheme` names the families the safe export wrote (major/minor/heading/body/accent from the safe file's theme, code
Courier New; copies in `flags/_safe-decks/`). It then exports that copy (same flags, no `--typefaces`) and compares its slide and
chart parts with the safe export: **identical in all 17 decks, default and native** (`build/036/<family>/<deck>/safe-preview.json`),
so `preview/` shows exactly the layout the safe file carries. The Aptos preview of the plain deck is kept in `preview-selected/`.
x-keynote-profile: only `default.pptx` exists (it carries all three flags); build-deck's native and static exports fail with
`duplicate-option` because build-deck adds `--body-text native` / `--slide-numbers static` again (build.json says so). That is
expected and not a fault of the files.

### opf#1416 items

| item | made | files |
|---|---|---|
| 1 radar fill | `a:noFill` series area fill on the standard (chart9) and marker (chart10) radar, coverage-charts slide 5 | 1416__1416-1__radar-nofill |
| 2 secondary axis | chart26 (slide 14) second c:valAx: no majorUnit / General / both | 1416__1416-2__axis-* |
| 3 85% background | no Mac-only look needed for a file: slide 5's background composited onto white (srgbClr 3B617B) as the #1298 route would write; seeing it in the window/Play needs the owner (Play) | 1416__1416-3__bg-alpha-on-white |
| 4 tiled background | tile as `p:bg` picture fill (alphaModFix and grayscl kept) at 100% and 75%; 75% with the PNG itself grayscale (Keynote dropped a:grayscl last round) | 1416__1416-4__tile-* |
| 5 reference label | coverage-charts 16: the "Target 30 min" text box moved above the plot top, and below the plot bottom | 1416__1416-5__reflabel-* |
| 6 direct line labels, stacked lines | charts 7, 8 (slide 4), 22 (slide 10): series-level name+value label with the other points deleted; the last-point label as fields instead of rich text; slide 4 as standard grouping with cumulative values | 1416__1416-6__* |
| 7 link color | theme `a:hlink` = text color 000000 and = accent1 2874A6, on m-links (link in a sentence: still blue in 0.36.0), layouts-ordinary (slide 6 link on the band) and coverage-furniture (0.36.0 links the footer shape since M65, so this may no longer show there) | 1416__1416-7__* |
| 8 elbow connector | not made: the next step in the issue is a different route computed by OPF (#1308 connection sites), not something an XML edit of today's file can test fairly; the 0.35.1 round showed Keynote reroutes on its own | - |

## Not made

- Keynote was not touched (another agent drives it). No picture, probe or back.pptx exists for any file here.
- 1416 item 8 (see above). LY-05's first half (patching Keynote's back.pptx and importing it) was already done locally by the
  round-trip grader; here only the Keynote side (x-min/LY-05, LY-05-dash, LY-05-space, RT-02).
- pic-placeholders (d): no other valid element exists for a picture placeholder (PowerPoint writes `p:sp` + `p:ph type="pic"`
  as OPF does); (d) is the same element written the way PowerPoint writes its own (name, `a:prstGeom`, prompt text).
- RT-04 needs no Keynote run (grader's note); its minimal deck is in x-min anyway.
