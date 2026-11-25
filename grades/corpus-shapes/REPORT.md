# Corpus: shape, diagram, picture and background decks (Keynote 16.0, OPF 0.36.0)

Saved by the supervisor from the grader's hand-back. 26 files, 193 slides graded: 3 same, 188 small, 2 wrong. Data: `grades.json`, `objects.json`, `features.json` (39 manifest entries), `min/QS-01..08.opf.json`. All 26 files opened with no alert; slide counts match. main: every graded `.pptx` part identical to 0.36.0. 0.35.1: "same in Keynote" where the slide XML is identical, else "pending the control run". No minimal deck opened in Keynote yet.

Every slide is "small" (Helvetica for Aptos) except: coverage-catalogs 1-3 "same" (Georgia installed); shape-overlays 4 "wrong" (elbow from Upper to Lower leaves Upper on the wrong side and crosses the gap; curved connector drawn straight: known rows); coverage-backgrounds 11 "wrong" (tiled background as one stretched tile: known row).

## Findings (all small)

- **QS-01, text in shapes and connector glue.** Every non-rectangle preset with text arrives as a group of the shape plus a text box (about 340 shapes, roundRect 189 of 191). 51 rectangle shape blocks do the same: exactly the shape blocks written by `packages/pptx/src/shape-blocks.js:172`, whose `a:bodyPr` carries `<a:prstTxWarp prst="textNoShape">` and `vertOverflow/horzOverflow="overflow"`; the 154 rectangles without them stay one shape (cause inferred, not proved). The file has 28 glued connectors: inside Keynote they stay connected (a move on coverage-overlays 4 moved both attached lines); in Keynote's `back.pptx` glue survives only where neither end is a text shape (shape-overlays 5: 11 of 11); the other 17 are written as unglued freeforms. Extends RT-05.
- **QS-02, presets lose their preset.** Of the 187 presets: 23 stay presets, 95 become one freeform without adjust handles, 63 become groups of freeform parts, 6 arrive as Keynote lines. All drawn correctly except QS-03 to QS-05.
- **QS-03:** pentagon and heptagon drawn too wide (Keynote drops `hf`/`vf`), coverage-shape-presets 1.
- **QS-04:** flowChartPunchedTape's wave is 40% of the height instead of 20% (slide 13).
- **QS-05:** the leftRightRibbon fold is drawn light gray (slide 11).
- **QS-06:** `path="rect"` and `path="shape"` gradients are drawn as a circle (coverage-shape-styles 1; slide XML identical in 0.35.1).
- **QS-07:** arrowhead `w`/`len` ignored; `arrow` written back as `triangle` (coverage-shape-styles 4).
- **QS-08:** the perspective (scaled) shadow becomes a plain drop shadow; the colored shadow is barely visible (shape-effects 1, coverage-shape-styles 7).
- **QS-09, stale manifest expectation (OPF's manifest, not Keynote):** the manifest lists smartart 7 and 11 as live SmartArt (SH-17) and grades their fallback (SH-16); 0.36.0 writes native shapes there (`pptx/smartart-unavailable`). Live SmartArt is on slides 1, 3, 5, 9 and 13-17.

Sheets `evidence/sheets/QS-01…QS-08-*.jpg`.

## Improvements

- Drop `prstTxWarp` from shape-block text bodies, if experiment QS-01 confirms it is the trigger: more shapes stay one shape and glue survives Keynote's export. PowerPoint cost unknown.
- Pentagon, heptagon, punched tape and leftRightRibbon as freeforms: costs PowerPoint the adjust handles; only in an opt-in Keynote route (#1298).
- Empty picture placeholders: leaving them out silences the "Unsupported media" line but costs PowerPoint the click-to-add-picture placeholder.
- Existing flags: `--smart-art shapes` (17 slides of editable shapes and text boxes) and `--diagrams picture` (7 pictures) both match the preview.

## Known rows

- Sketch outline drawn plain: still shows (shapes 4, coverage-shape-styles 5).
- Compound line as one line: still shows (shapes 4, coverage-shape-styles 3).
- Inner shadow, glow, soft edge, blur not drawn: still shows (shape-effects 2-3, coverage-shape-styles 7, coverage-overlays 5).
- Tiled picture background stretched: still shows (coverage-backgrounds 11).
- Semi-transparent background: as before; the exported picture over white matches the preview ((58,97,122) vs (59,98,123), coverage-backgrounds 5); the window was not judged.
- Curved connector drawn straight: still shows (shape-overlays 3, 4, 5).
- Elbow connector rerouted: still shows (coverage-overlays 4: leaves Review's top, enters Ship from below; shape-overlays 4 wrong; shape-overlays 5 has 2 rerouted). Whether the route differs from 15.4's: unknown.
- Vertical text rotated, not stacked: still shows (shapes 6, coverage-shape-styles 10, coverage-overlays 5).
- Rotated narrow text or callout wrapped mid-word: still shows (coverage-overlays 2 "Sta rt"/"En d", 3 "Recover y"; shape-overlays 2; shape-effects 4).
- Pattern fills: judged now, **not a difference** (shapes 3, coverage-shape-styles 1, coverage-backgrounds 8).
- Three-stop gradient: matches within 1/255 (coverage-backgrounds 6).
- Per-point bar color not drawn: still shows (coverage-images 16).
- Video link label in hyperlink blue: **gone** on coverage-images 14-15 (0.36.0 links only the shape).
- SmartArt drawn as a picture: still shows.

Presets not drawn right: pentagon, heptagon, flowChartPunchedTape, leftRightRibbon. chartX, chartStar, chartPlus: Keynote and the preview agree (slide 16).

## Connectors, SmartArt, pictures

- Connectors: arrowhead types and all dashes kept; sizes not (QS-07); curved written back as straight.
- SmartArt, default: all 13 frames (9 in smartart, 4 in coverage-diagrams) arrive as OPF's own fallback PNG (2304 or 1408 px wide, byte-identical in `back.pptx`, looks like the preview). Arabic and Japanese decks: native shapes by design, right-aligned, drawn correctly. SH-16 fallback check passes on slides 1, 3, 5, 9.
- Pictures: coverage-images has all 30 pictures; crops, fits, focus points, recolors, ellipse and rounded masks match. Descriptions: 0 of 64 pictures with alt text show it (RT-03). SVG pictures: a PNG with an `asvg:svgBlip` extension; Keynote shows and writes back the PNG byte for byte and drops the SVG; pictures are sharp. "SVG images were converted to PNG" appears only for coverage-catalogs and image-callouts although other decks carry the same structure (cause unknown; the list may have been cut). header-footer-logo-set: logos and watermark present.
- "Unsupported media were removed": nothing visible missing in any deck; image-callouts uses a picture placeholder and its picture is present.
- "Cover 0", "Cover 1", "Cover 2" in that line: Keynote's per-slide copies of the file's single Cover layout, each inheriting its empty `<p:ph type="pic" idx="500"/>`. Proved on coverage-backgrounds: "Cover 0" is slides 13-16 (dark color-map override), "Cover 1" slide 19 (light). Keynote makes the same kind of copy for Title Only and Section (this is LY-06's cause: a slide color-map override).

## Per feature

All open with the preview's slide count. `noOverflow`/`noShrink` not run. Round trip: every deck imports back with the same slide count; OPF structure is lost (RT-04).

| Feature | visual | shapes / connectors | smartArt / noSmartArt / fallback |
|---|---|---|---|
| SH-02 / SH-05 (shapes) | known rows | QS-01 | |
| SH-03 (shape-effects) | known rows + QS-08 | QS-01 | |
| SH-04 (shape-overlays) | known rows; slide 4 wrong | QS-01; glue lost in back.pptx on slides 3-4 | |
| SH-04-rtl | passed | QS-01 | |
| SH-07, -families, -md, LH-185 | passed | QS-01 (groups) | |
| SH-07-connectors | passed | connectors not run (UI) | |
| SH-07-picture; SH-12; SH-13 | passed | QS-01 | |
| SH-09, SH-17, SH-18, SH-19 | passed | | smartArt: known, drawn as a picture (SH-17 slides 7, 11: QS-09) |
| SH-16 | | | fallback passed on 1, 3, 5, 9 |
| SH-19-native, SH-smartart-shapes, -rtl, -cjk | passed | QS-01 | noSmartArt passed |
| SH-21, SH-24, LH-34, RR-102-logos | passed | | |
| COV-images | passed | | |
| COV-backgrounds | known: tile (11 wrong); alpha matches in the picture | | |
| COV-shape-presets | QS-03, QS-04, QS-05 | QS-02 | |
| COV-shape-styles | QS-06, QS-07, QS-08 + known | QS-01 | |
| COV-overlays | known rows | connectors passed (glued in Keynote) | |
| COV-diagrams, COV-catalogs, COV-catalogs-off | passed | | |

## Not run

Adjust handles; the connector move test on shape-overlays and diagram-connectors; the Keynote window view of coverage-backgrounds 5 (`grades/ui-checks.md`).
