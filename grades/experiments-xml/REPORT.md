# XML-variant experiments in Keynote 16.0 (OPF 0.36.0 files, hand-edited)

Saved by the supervisor from the grader's hand-back. 92 variant/control rows looked at: slide pictures (P3 to sRGB), `probe.json`, `back.pptx`, warnings captures, line-edge measurements. Data: `results.json`. Variant files and their `make.py`: `experiments/<group>/` (MANIFEST.tsv). No variant was checked in PowerPoint.

## Verdict per group

- **one-series-highlight (MX-03 / RT-01): no tried form holds.** a (as exported): two series, legend "Wait Wait", half-width columns. c1: legend "Series2". c2 (empty name): "Wait" plus a nameless key; Keynote then names that series after the first category in `back.pptx`. d1/d2 (one series + `c:dPt`): highlight drawn, but the legend lists the categories and the first and last columns are cut in half; on the line chart d1 gives one "Visits" entry but the marker is gray; Keynote ignores the `legendEntry` deletes. e (dense caches with empty `c:v`): read as 0 ("0" labels); it imports. Seen: Keynote keeps neither `c:legendEntry` nor `c:overlap`; the March marker is gray in every form.
- **plot-area (MX-02): b (manual plot area, `layoutTarget inner`) fixes it** (names whole, plot where the preview has it). c (automatic): names whole, smaller plot.
- **flush-space (MX-01): b (no trailing space + 0.35.1 box) is flush everywhere**, numbers identical to 0.35.1. b2 and c identical to a. Keynote ignores the trailing space; only the box shift moves the line.
- **rtl-explicit (MX-06): no change.** `rtl="0"` is ignored; `back.pptx` writes `rtl="1"` again.
- **rtl-table (LG-02): b (left-to-right table in visual column order) and c1 (`rtl` kept, frame x mirrored) fix it.** Proved: Keynote places an `rtl="1"` table at `a:off x − cx`.
- **title-one-paragraph (LY-01): no change.** One paragraph wraps to three lines anyway; `normAutofit` does not shrink.
- **legend-frame (LY-03 / MX-07): only a bottom legend stays in the frame** (shortens the plot, changes the design). Manual legend boxes still overrun or get cut.
- **tick-skip (MX-04): `tickLblSkip 1` alone changes nothing.** A newline in the category cache makes Keynote draw all four names on two lines.
- **label-separator (MX-05): no change** in all four variants.
- **alt-text: Keynote's image Description is `p:cNvPr/@name`**; with a `title` it is title + "\n\n" + name; `descr` is never used, not even when `name` is empty (Description ""; written back as the media file name). Only name = alt with no title gives the alt; `back.pptx` drops line breaks from it.
- **pic-placeholders: `type="body"` and no type remove the "Unsupported media were removed" line** (panel read), but the layouts lose their picture placeholder (it becomes a body placeholder, or disappears on Cover and Hero). The control's `back.pptx` still has `pic` placeholders. b, d, e1: panel not read (captured too early). All slides pixel-identical to the controls.
- **graders:** fix: SW-01 c (columns +10%), SW-02 b (native note at the default file's y), MX-08 b (column 1 +10%), LY-02 b (one wrapped box). No change: SW-01 b (header Arial), LG-01 b (Kefa III), LG-04 b and c (`altLang`, `eaLnBrk 0`), LY-06 b and c (Keynote still makes 43 layouts with the "Section 0" copies).
- **roundtrip-xml:** RT-06 no change (whole sizes read exactly; 48.75 read as 48; written-back size about 96% whatever was written). RT-07 with a right-to-left mark: partly (`back.pptx` keeps `rtl="1"`, with U+200F in the text). RT-08 no change.

## #1416 on 0.36.0 in Keynote 16.0

1. Radar: fixed by `a:noFill`, same as 15.4.
2. Secondary axis: without `c:majorUnit`, 0-40% shows; the legend still overlaps. Same as 15.4.
3. 85% background: the exported picture has no alpha and matches the preview; window and Play pending.
4. Tile as `p:bg`: at 75% it tiles 2 by 2 at the preview size, in color. New: the 40% opacity is lost too (a gray PNG gives (81,81,81) against the preview's (185,185,185)).
5. Reference label: above the plot it is clear; below the plot it sits on the "30" tick label.
6. Line labels: both label forms are dropped; cumulative values in a standard line chart draw the stacked heights.
7. Link color: Keynote draws link text in the theme's `a:hlink`; neither 000000 nor accent1 matches the preview's white link on these grounds.
8. Not made (needs a route OPF computes).

## Deserve an issue (fix form confirmed in Keynote; PowerPoint unchecked)

LG-02 b (visual-order table; PowerPoint cost: the table is no longer marked right-to-left: opt-in route, #1298); SW-02 b (#1481); MX-04 c (line breaks in long category names); MX-08 / SW-01 (column slack; cost: wider columns); LY-02 b (one wrapped box); #1416 item 1 (`noFill`); #1416 item 5 (label above the plot).

Opt-in Keynote route only: alt text in `name` (Selection Pane cost), picture-placeholder spelling, LG-02 c1, the bottom legend.

## Keynote limits (for the export skill's Keynote table)

`rtl` on a paragraph is ignored; per-point `showCatName` and `c:separator` are ignored; `c:legendEntry` and `c:overlap` are ignored; manual legend width is ignored; a title wraps despite `wrap="none"` and `normAutofit` does not shrink; Korean wraps inside words; layout copies for slides with their own background; fractional sizes are truncated; table right alignment is not written back; line labels are dropped; `a:grayscl` and `alphaModFix` are dropped on a `p:bg` picture fill.

## Not decided

Warnings for pic-placeholders b, d, e1 (panel captured too early); #1416 item 3 in the window and in Play; no PowerPoint check for any variant; MX-04: whether line breaks alone, without `tickLblSkip`, are enough.

## Outputs

Sheets (each read once by the grader): `X-one-series-highlight`, `X-plot-area`, `X-flush-space`, `X-flush-space-rtl`, `X-rtl-table`, `X-rtl-explicit`, `X-title-one-paragraph`, `X-legend-frame`, `X-tick-skip`, `X-label-separator`, `X-pic-placeholders`, `X-graders`, `X-1416-1-radar`, `X-1416-2-axis`, `X-1416-4-tile`, `X-1416-5-reflabel`, `X-1416-6-linelabels`, `X-1416-7-link-color` (`evidence/sheets/*.jpg`). Drafts: `report/issues/keynote-highlight-series-legend.md`, `keynote-flush-lines-hang-space.md`, `keynote-bar-chart-outer-plot-area.md`; `report/1416-comment.md`.
