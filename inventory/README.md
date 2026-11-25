# Keynote feature inventory (desk part) for the OPF 0.36.0 Keynote round

Built 2026-11-25T16:51Z by the inventory desk agent. Sources: Keynote User Guide for Mac (support.apple.com/guide/keynote, read 2026-11-25) and $W/tools/keynote.sdef. Nothing here was checked in Keynote: every GUI path is as Apple documents it, and every row carries `gui_unverified: true` until the GUI walker confirms it in Keynote 16.0. Statements marked **saw** name the file; everything else is **inferred** from the OPF sources or from earlier rounds.

## Files

- `keynote-features.json`: 1173 Keynote features (`id`, `area`, `feature`, `detail`, `where_in_gui`, `gui_unverified`, `source`, `in_sdef`, `sdef`). 1098 rows come from the documentation (149 pages of the Keynote User Guide for Mac), 75 only from the scripting dictionary (transition effects, cell formats, 3D chart types, export options).
- `opf-map.json`: per row `opf` (yes/partial/no), `opf_ref` (schema key or doc), `scope` and `why` for "no" (format-candidate / app-only / out-of-scope), `pptx_export` (element written), `export_where` (file:function in `packages/pptx/src`), `export_flag`, `pptx_carrier` and `carrier_note`; plus `concepts`, the 159 concepts the rows were matched to (the real unit of analysis).
- `expectation.json`: per OPF yes/partial row `expected_in_keynote`, `evidence` (file:line), `test_deck` (deck and slide), `how_to_check` (probe.json field or inspector), and the recommendation (`fix`, `fix_costs_powerpoint`, `fix_confidence`). Six extra rows `OPF-*` cover OPF features Keynote has no control for (sketch and compound lines, glow/soft edge/inner shadow/blur, pattern fills, extended charts, chart number formats).
- `raw/`: the five documentation readers' raw rows (`A-…E-*.json`), their brief (`AGENT-BRIEF.md`) and `deck-index.json` (every deck slide on this Mac with the keys it uses, used to find test decks).
- `scripts/`: `index_decks.py` (deck index), `concepts.py` (the concept table: OPF key, export element, Keynote expectation, evidence, fix), `build.py` (writes the three JSON files), `readme.py` (this file). Rerun: `python3 scripts/index_decks.py && python3 scripts/build.py && python3 scripts/readme.py`.
- Probe decks: `$W/decks/inventory/probe-inventory.opf.json` (4 slides: Japanese vertical text KN-LNG-014, roman numbering KN-LST-007/008, sections as slide groups KN-SLD-013) built for 036 and main in `$W/build/{036,main}/inventory/probe-inventory/`; `$W/decks/inventory/probe-slide-links-main.opf.json` (links to a slide, KN-LNK-005/002; **main only**, 0.36.0 rejects `slide:<id>`) in `$W/build/main/inventory/probe-slide-links-main/`. Both validate with no findings. Everything else already has a slide in the qualification corpus, the examples or this round's decks, so no other probe was written.

## Counts

Rows: 1173. OPF: yes 278, partial 191, no 704 (app-only 395, format-candidate 241, out-of-scope 68). In the scripting dictionary: 311.

Expected in Keynote (the 469 Keynote rows where OPF has the feature): native 168, editable but changed 140, picture 0, dropped 2, unknown (needs test) 159. Plus the six OPF-only rows: OPF-fill-pattern unknown: needs test, OPF-stroke-compound editable but changed, OPF-stroke-sketch dropped, OPF-effects-other dropped, OPF-chart-extended picture, OPF-chart-number-format unknown: needs test.

Counted by concept rather than by row (rows are uneven: one Keynote feature can be ten rows): see the table under Recommendations.

| Area | Rows | OPF yes | partial | no | in sdef |
|---|---|---|---|---|---|
| charts | 118 | 65 | 9 | 44 | 16 |
| text-format | 99 | 22 | 14 | 63 | 18 |
| presenting | 92 | 0 | 0 | 92 | 20 |
| tables | 68 | 28 | 21 | 19 | 22 |
| export-import | 66 | 7 | 0 | 59 | 42 |
| transitions | 61 | 0 | 0 | 61 | 49 |
| app-ui | 53 | 5 | 2 | 46 | 3 |
| intelligence | 47 | 1 | 1 | 45 | 3 |
| images | 47 | 12 | 10 | 25 | 2 |
| slides | 47 | 28 | 8 | 11 | 25 |
| table-data | 47 | 0 | 29 | 18 | 19 |
| animation | 38 | 0 | 0 | 38 | 3 |
| object-style | 38 | 19 | 15 | 4 | 15 |
| arrange | 38 | 2 | 21 | 15 | 6 |
| media | 37 | 0 | 14 | 23 | 3 |
| collaboration | 35 | 0 | 0 | 35 | 1 |
| themes-layouts | 33 | 10 | 23 | 0 | 23 |
| shapes | 32 | 18 | 1 | 13 | 3 |
| text | 27 | 11 | 4 | 12 | 2 |
| file-management | 23 | 0 | 0 | 23 | 11 |
| text-language | 22 | 13 | 3 | 6 | 3 |
| writing-tools | 18 | 0 | 0 | 18 | 0 |
| lists | 16 | 14 | 1 | 1 | 0 |
| links | 14 | 0 | 10 | 4 | 0 |
| lines | 13 | 13 | 0 | 0 | 3 |
| formulas | 13 | 1 | 0 | 12 | 6 |
| accessibility | 12 | 7 | 2 | 3 | 3 |
| 3d | 11 | 0 | 0 | 11 | 5 |
| document | 5 | 2 | 3 | 0 | 5 |
| drawing | 3 | 0 | 0 | 3 | 0 |

`in_sdef` is a keyword match of the feature to the dictionary (for example "opacity" to `opacity`); the dictionary gives no text alignment, spacing, bullets, links, runs, chart data, builds or comments, so those can only be read with computer use.

## The ten most important gaps expected (OPF has it, Keynote will not get it natively)

Ranked by how many decks they touch. Evidence is in `expectation.json` for each concept; none of this was rechecked in Keynote 16.0 yet.

1. **Body text in the default export** (text-box, lists-bullets, lists-numbers, h-align, indents, line-spacing). Measured mode writes one text box per wrapped line (`$W/bin/README.md`); the probe's numbered list carries a separate `a:buAutoNum ... startAt="2"` per line box (**saw**: `$W/build/036/inventory/probe-inventory/default.pptx`, `ppt/slides/slide2.xml`). In Keynote a paragraph is several boxes and a list is several one-item lists: editable but changed on almost every slide. `--body-text native` writes paragraphs and placeholders.
2. **Slide number beside footer text**: "Page 1 of 4" shows "1" (SKILL.md table, #1298). `--slide-numbers static` fixes it at a PowerPoint cost.
3. **Extended charts** (histogram, Pareto, waterfall, box and whisker, funnel, treemap): a picture of the preview, not a chart.
4. **Right-to-left tables**: only the first column drawn (dropped).
5. **Effects with no Keynote control**: glow, soft edge, inner shadow, blur dropped; sketch outlines plain; compound lines single.
6. **Connectors**: curved drawn straight, elbow rerouted by Keynote; whether they stay Keynote connection lines (glued) is unknown.
7. **Chart details**: per-point (highlight) colors and direct line labels dropped, stacked lines unstacked, line radar filled, secondary axis labels thinned, reference-line labels missing, area gaps bridged, chart titles centered.
8. **Video**: a placeholder of three shapes and a caption with a link, never a Keynote Movie (OPF does not embed video).
9. **Picture backgrounds**: written as a full-slide picture object, not Keynote's Background > Image Fill; tiles stretched to one tile; a translucent background composited over black in the window and Play.
10. **Links and captions**: link text takes the theme hyperlink color (the color extension is ignored); captions are separate text boxes, not Keynote captions; table numbers arrive as text, not cell formats; CJK vertical text is written `vert="vert"` (**saw**, probe slide 1), likely a rotated box rather than Keynote's vertical text.

## What the GUI walker must do

The walker dumps every menu and every Format/Animate/Document inspector tab of Keynote 16.0 with computer use (no Save, no Play unless agreed), and:

1. **Confirms or corrects `where_in_gui`** for every row of `keynote-features.json` (set `gui_unverified: false` and write the actual path), and adds a row for every control it finds that is not in the file (`source: "Keynote 16.0 GUI walk"`).
2. **Looks specifically for features the documentation pages did not name** (likely present in Keynote but unsourced here, so not rows yet):
   - Format > Text > Layout pane: Text Inset, Columns options, Indents (first/left/right), Shrink text to fit / Autosize; More pane: Hyphenation, Keep lines together, Keep with next, Ligatures pop-up, text direction.
   - Format > Text > Font > Advanced Options (gear): the full list (Baseline, Character Spacing, Capitalization, Ligatures, Outline, Shadow, Text Background, Underline/strikethrough color).
   - Every build-in, build-out and action effect name (the pages name only Move, Opacity, Rotate, Scale, Bounce, Flip, Character Blur, Line Draw) and the full transition list in 16.0 (the dictionary lists 47; Shift is in the docs but not in the dictionary enumeration).
   - Chart inspector Axis tab: Scale (linear/log/percentage), minimum/maximum, steps, label angle; Series tab: trendline types, error bar methods (fixed, percentage, standard deviation, standard error, custom), data-point fills; Chart tab: rounded corners, 3D options. Interactive chart types and the 3D chart thumbnails.
   - Table: Conditional Highlighting rule types (number/text/date/duration/blank), every cell Data Format (Checkbox, Star Rating, Slider, Stepper, Pop-Up Menu come only from the dictionary here), Table > Reverse Table Direction, Cell > Fill types.
   - Link editor (Format > Add Link): Slide targets (next/previous/first/last/slide number), Webpage, Email, Phone, Exit Slideshow.
   - Document inspector: Presentation type, Soundtrack, slide size presets, Require password, Language & Region; Slide inspector: Appearance (Title, Body, Slide Number), Background types, Layout.
   - Arrange inspector and menu: Align, Distribute, Flip, Lock, Group, Make Editable, Unite/Intersect/Subtract/Exclude, Connection Line types, Constrain proportions.
   - Image inspector: Edit Mask, Remove Background (Instant Alpha in older versions), Adjustments, Description; Movie/Audio inspector options.
   - Insert menu: Equation, Formula, Comment, Column Break, Line Break, Slide Number, Date and Time (if present), Text Box, Shape, Line, Table, Chart, Gallery, 3D object, Live Video, Web Video.
3. **Grades the "unknown: needs test" concepts** (36 concepts) on the named test decks with `how_to_check`: slide size, layouts and placeholders, theme colors and fonts, sections as slide groups, presenter notes, date field, alt text (`description`), crop vs mask, recolor, SVG pictures, shape adjust handles, rotation and flip, groups, object names in the object list, auto-shrink, underline/strike/superscript/caps, numbering, indents, line spacing, vertical alignment, picture bullets, table header rows/merged cells/borders, chart gridlines/axis titles/number formats, pattern fills, and links to a slide (main-only probe).
4. **Records each finding per concept** in the grade words of the brief (native / editable but changed (how) / picture / dropped), so `expectation.json` can be updated from "expected" to "observed".

## What could not be sourced

- Build effect names, the full transition list as shown in 16.0, conditional-highlighting rule types, axis scale options (type, min/max), trendline types, error bar methods beyond fixed value and percentage, GIF/Movie option values, PDF image quality values in the GUI: the pages name them without listing values (a few values come from the dictionary instead).
- Checkbox, Star Rating, Slider, Stepper and Pop-Up Menu cell formats and the 3D chart types are only in the scripting dictionary (rows sourced `sdef:`).
- Text Inset, hyphenation, keep-lines-together, paragraph spacing details beyond Before/After, and the Advanced Options list of the Font pane: not on any page read.
- Whether Keynote reads OMML equations, PPTX comments, a:spLocks locks, p:transition/p:timing (OPF writes none of these, so only relevant for format candidates).
- The pptx exporter's exact function for every element: where the code is spread over `index.js` post-processing and the vendored PptxGenJS, `export_where` names the file and the nearest function, or "vendor".


## Draft of recommendations.md

One entry per concept where OPF has the feature and Keynote is not expected to get it natively (or it is not known yet). The default export stays PowerPoint-native: anything that costs PowerPoint is marked **Keynote route** and belongs in the opt-in route of opf#1298. "Sure" is how sure the desk is that the fix works in Keynote, before any test.

### Expected: dropped

- **effects-other** (OPF-effects-other). OPF: `innerShadow, glow, softEdge, blur`. Export: a:innerShdw, a:glow, a:softEdge, a:blur (packages/pptx/src/effects.js:effectsXml).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:148.
  Fix: Keynote route: rasterize shapes that carry glow/soft edge/inner shadow/blur into a picture (keeps the look, loses editability); or drop the effect and warn. Costs PowerPoint: PowerPoint keeps live effects by default; opt-in only. Sure: high.
- **stroke-sketch** (OPF-stroke-sketch). OPF: `stroke.sketch (curved, freehand, scribble)`. Export: a:ln plus the 2018 sketchyshapes extension (lineSketchCurved/Freehand/Scribble) holding the sketched custGeom (packages/pptx/src/shape-blocks.js:lineXml).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:131.
  Fix: Keynote route: write the sketched outline that the export already stores in the sketch extension (shape-blocks.js: the extension's a:custGeom is the sketched outline) as the shape's main geometry, so Keynote draws the hand-drawn outline as an editable path. Costs PowerPoint: PowerPoint loses the toggleable sketch style; opt-in. Sure: medium.
- **table-rtl** (KN-TBL-064, KN-TBL-065). OPF: `right-to-left language -> rtl table`. Export: a:tblPr rtl="1" (packages/pptx/src/index.js:addTablePayload).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:128; $W/issues/1298.md:6.
  Fix: Opt-in Keynote route (#1298): write grid and cells in visual (reversed) order without rtl="1"; tag it so import reverses back. Costs PowerPoint: PowerPoint table is then not right-to-left (Tab order, insert left/right). Sure: high.
### Expected: picture

- **chart-extended** (OPF-chart-extended). OPF: `chart.type histogram, pareto, waterfall, box-and-whisker, funnel, treemap`. Export: cx:chart (chartex) with mc:AlternateContent picture fallback (packages/pptx/src/chartex.js:attachChartexFallbacks; flag --charts picture).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:129.
  Fix: Keynote route: write waterfall/histogram/Pareto/funnel as standard c:barChart constructions (stacked column with no-fill base; pre-binned columns; column+line on a secondary axis) so Keynote gets editable charts. Costs PowerPoint: PowerPoint would lose the live chartex type; opt-in only. Sure: medium.
### Expected: editable but changed

- **background-image** (KN-SLD-025, KN-SLD-026, KN-SLD-028, KN-SLD-029, KN-SLD-031, KN-SLD-032). OPF: `ImageBackground (src, fit cover|contain|stretch|tile, focus, opacity, recolor, overlay)`. Export: p:pic full-slide picture (a:blipFill/a:stretch, a:srcRect crop) on the slide; scrim overlays as shapes (packages/pptx/src/index.js:addBackgroundImage; background.js:nativeImageBackgroundFill (layout/master)).
  Evidence: $W/prior/mac-0351/README.md:39.
  Fix: Write slide-level picture backgrounds as p:bg a:blipFill (like the tile experiment) so Keynote shows Background > Image Fill (Scale to Fill/Fit); keep p:pic only where a crop or recolor needs it. Costs PowerPoint: PowerPoint draws p:bg blipFill natively; small risk with crop focus (a:srcRect on bg) - test both. Sure: medium.
- **background-tile** (KN-SLD-030, KN-STY-016, KN-FMT-022). OPF: `ImageBackground.fit = "tile"`. Export: full-slide p:pic with a:tile (packages/pptx/src/background.js:nativeTileScale; packages/pptx/src/index.js:addBackgroundImage).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:134; $W/prior/mac-0351/README.md:67.
  Fix: Keynote route: tile as p:bg picture fill with sx/sy 75% (2x2 at preview size, measured in #1416 experiment 4); keep the grayscale recolor by baking it into the PNG. Costs PowerPoint: p:bg fill draws the same in PowerPoint; baking the recolor loses the editable recolor there - opt-in. Sure: high.
- **caption** (KN-STY-024, KN-STY-025, KN-STY-026, KN-STY-027). OPF: `caption on image/chart/table/video/diagram (Caption text, position, align)`. Export: separate p:sp text box below the media (packages/pptx/src/index.js:addMeasuredPayloadText (caption)).
  Evidence: none.
  Fix: None in the file (no carrier). Optionally group picture+caption (p:grpSp) so they move together. Costs PowerPoint: grouping changes PowerPoint selection behavior; small. Sure: medium.
- **cell-formats** (KN-TDA-016, KN-TDA-017, KN-TDA-018, KN-TDA-019, KN-TDA-020, KN-TDA-021 and 15 more). OPF: `DataColumn.format / StyledTableCell.format (number pattern); dates/durations as text`. Export: formatted text in a:t (PPTX tables have no number formats) (packages/pptx/src/index.js:addTablePayload (tableNumberLanguage)).
  Evidence: none.
  Fix: None in the file: no carrier. Document that numbers arrive as text. Costs PowerPoint: none. Sure: high.
- **chart-area** (KN-CHT-007, KN-CHT-019). OPF: `chart.type area, stacked-area, 100pct-stacked-area`. Export: c:areaChart (packages/pptx/src/chart-types.js).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:136.
  Fix: Gaps: write c:dispBlanksAs val="gap" explicitly (if not already) - Keynote still bridges; nothing else measured. Costs PowerPoint: none. Sure: low.
- **chart-colors** (KN-CHT-039, KN-CHT-040, KN-CHT-041). OPF: `chart.colors (ColorRef per series), chart.highlight`. Export: c:ser c:spPr a:solidFill (schemeClr), c:dPt per point (packages/pptx/src/chart-scheme-colors.js; chart-highlight.js:applyChartHighlight).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:147; $W/prior/mac-034/grades/charts-examples.md:10.
  Fix: Per-point colors (c:dPt) are dropped by Keynote: Keynote route splits the highlighted category into its own series (stacked/overlap 100) so it keeps its color. Costs PowerPoint: PowerPoint Edit Data shows two series; opt-in. Sure: medium.
- **chart-labels** (KN-CHT-002, KN-CHT-086, KN-CHT-089, KN-CHT-090, KN-CHT-091, KN-CHT-092 and 6 more). OPF: `chart.dataLabels (content, position, separator); DataColumn.format`. Export: c:dLbls (showVal/showCatName/showPercent, c:dLblPos, c:numFmt) (packages/pptx/src/chart-options.js:applyDataLabels).
  Evidence: $W/prior/mac-034/grades/charts-examples.md:21; $W/src-036/skills/opf-export/SKILL.md:139. Direct line end labels (chart-direct-labels.js) dropped.
  Fix: Direct labels: Keynote route writes them as plain text boxes beside the chart (lose binding). Costs PowerPoint: PowerPoint loses labels attached to points; opt-in. Sure: medium.
- **chart-mixed** (KN-CHT-017, KN-CHT-018). OPF: `chart.type combo (line, secondaryAxis)`. Export: c:barChart + c:lineChart, secondary c:valAx (packages/pptx/src/index.js:comboChart).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:137; $W/prior/mac-0351/README.md:37.
  Fix: Omit c:majorUnit on the secondary value axis (#1416 experiment 2: all five labels show); legend overlap remains. Costs PowerPoint: PowerPoint chooses its own major unit (same steps in the test). Sure: high.
- **chart-radar** (KN-CHT-010, KN-CHT-055, KN-CHT-056, KN-CHT-063, KN-CHT-064). OPF: `chart.type radar, radar-with-markers, filled-radar`. Export: c:radarChart (packages/pptx/src/chart-types.js).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:135; $W/prior/mac-0351/README.md:36.
  Fix: Write the line radar series area fill as a:noFill (#1416 experiment 1: Keynote then draws lines only). Costs PowerPoint: none for PowerPoint (same look). Sure: high.
- **chart-reference-lines** (KN-CHT-065, KN-CHT-066, KN-CHT-067, KN-CHT-068, KN-CHT-069, KN-CHT-070 and 1 more). OPF: `chart.referenceLines (value, label, axis, stroke)`. Export: helper line series (c:lineChart) + label overlay (packages/pptx/src/chart-references.js:applyReferenceSeries).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:138.
  Fix: Name the line in the legend (done); label as a text box in the Keynote route. Costs PowerPoint: none. Sure: medium.
- **chart-title** (KN-CHT-084, KN-CHT-085). OPF: `Chart title comes from the slide/caption heading; c:title only where the engine places one`. Export: c:title (packages/pptx/src/chart-options.js).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:145.
  Fix: None measured (Keynote centers chart titles); keep. Costs PowerPoint: none. Sure: high.
- **conditional** (KN-TDA-030, KN-TDA-031, KN-TDA-032, KN-TDA-033, KN-TDA-034, KN-TDA-035 and 2 more). OPF: `table.highlight (static row tint chosen by the engine)`. Export: static cell fills (packages/pptx/src/index.js:addTablePayload).
  Evidence: none.
  Fix: None (no carrier). Costs PowerPoint: none. Sure: high.
- **connector-straight** (KN-LIN-012, KN-LIN-013, KN-APP-030). OPF: `OverlayShape.connector {from,to,route straight|elbow|curved,fromSite,toSite}`. Export: p:cxnSp prstGeom straightConnector1/bentConnector3/curvedConnector3 with a:stCxn/a:endCxn (packages/pptx/src/connectors.js:connectorXml).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:141; $W/src-036/skills/opf-export/SKILL.md:142; $W/prior/mac-034/grades/shapes-diagrams.md:7.
  Fix: Curved: Keynote drops curvedConnector geometry; write curved connectors as a custGeom cubic path (loses glue) or accept straight. Elbow: Keynote reroutes bentConnector; write the elbow as an explicit custGeom polyline in the Keynote route. Costs PowerPoint: PowerPoint loses connector glue (lines stop following the boxes); opt-in. Sure: medium.
- **curve-corner** (KN-LIN-011). OPF: `connector.route curved|elbow`. Export: curvedConnector3 / bentConnector3 (packages/pptx/src/connectors.js:connectorXml).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:142.
  Fix: none proposed until the test says what Keynote does. Check: Arrange > Connection: Curved / Corner.
- **lists-bullets** (KN-LST-002, KN-LST-004, KN-LST-005, KN-LST-009, KN-LST-011, KN-LST-012 and 4 more). OPF: `items / bullets (ListItem.level, icon); design.listBullet character|image|none; design.listStyle`. Export: a:buChar / a:buNone per paragraph (native mode); measured mode draws bullets per line box (packages/pptx/src/index.js:addListPayload/addMeasuredList; native-body.js; flag --body-text native).
  Evidence: $W/bin/README.md:34. Default export writes measured text: one text box per wrapped line (bin/README.md). In Keynote a paragraph then arrives as several text boxes, so paragraph-level settings are per line. `--body-text native` writes whole paragraphs and placeholders.
  Fix: Native-mode lists should arrive as Keynote Text Bullets; consider making native body text the Keynote route default. Costs PowerPoint: none for the route; the default stays measured for PowerPoint line fidelity. Sure: medium.
- **shadow-contact** (KN-STY-030, KN-STY-031). OPF: `shadow with perspective (a:prstShdw / outerShdw with skew) via shadow presets`. Export: a:outerShdw with sx/sy/kx (perspective) (packages/pptx/src/effects.js:SHADOW_PRESETS).
  Evidence: $W/prior/mac-034/grades/shapes-diagrams.md:12.
  Fix: none proposed until the test says what Keynote does. Check: Format > Style > Shadow type (Contact? Drop?).
- **shadow-drop** (KN-STY-005, KN-LIN-008, KN-STY-029, KN-STY-032, KN-CHT-043). OPF: `shadow (color, opacity, blur, distance, angle, size) ; style presets`. Export: a:effectLst a:outerShdw (packages/pptx/src/effects.js:effectsXml).
  Evidence: $W/prior/mac-034/grades/shapes-diagrams.md:12.
  Fix: Compare outerShdw blurRad/dist to Keynote's Blur/Offset: Keynote likely reads EMU as points at another scale; a measured conversion table in the Keynote route. Costs PowerPoint: none if only the route changes. Sure: low.
- **slide-number** (KN-SLD-041, KN-SLD-042, KN-SLD-043, KN-EXP-061). OPF: `design.footer/header zone text "{{slide.number}}", "{{deck.slideCount}}" (docs/format-card.md)`. Export: p:sp placeholder type=sldNum with a:fld type=slidenum (live, default); plain text with --slide-numbers static (packages/pptx/src/furniture-fields.js:attachFurnitureFields; native-furniture.js; flag --slide-numbers static|live).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:127; $W/issues/1298.md:5.
  Fix: Opt-in Keynote route (opf#1298): static numbers when the footer mixes text and the number; or write the number field alone in its own sldNum placeholder and the words in the ftr placeholder (Keynote then shows "1" in its own slide-number box and the text beside it). Costs PowerPoint: static numbers stop renumbering in PowerPoint when slides move; the split costs the Header & Footer toggle grouping (tested and rejected as default in #1298). Sure: high.
- **stroke-compound** (OPF-stroke-compound). OPF: `stroke.compound (double, thickThin, thinThick, triple)`. Export: a:ln cmpd (packages/pptx/src/shape-blocks.js:lineXml).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:132; $W/prior/mac-034/grades/shapes-diagrams.md:16.
  Fix: Keynote route: draw a compound line as two/three nested outlines (an inset copy of the shape with no fill). Costs PowerPoint: more objects in PowerPoint; opt-in. Sure: medium.
- **table-text** (KN-TBL-041, KN-TBL-042). OPF: `cell runs (TextRun) and style (color, bold, align)`. Export: a:tc a:txBody runs (packages/pptx/src/index.js:addTablePayload).
  Evidence: $W/prior/mac-034/grades/layouts-smartart.md:8. Header wrapped mid-word in 0.34 (font width).
  Fix: none proposed until the test says what Keynote does. Check: probe.json cell `font name`, `font size`, `text wrap`.
- **text-box** (KN-TXT-009, KN-TXT-010, KN-TXT-011, KN-TXT-013, KN-TXT-014). OPF: `text payload (engine-placed)`. Export: p:sp txBox (packages/pptx/src/index.js:addTextPayload/addMeasuredPayloadText).
  Evidence: $W/bin/README.md:34. Default export writes measured text: one text box per wrapped line (bin/README.md). In Keynote a paragraph then arrives as several text boxes, so paragraph-level settings are per line. `--body-text native` writes whole paragraphs and placeholders.
  Fix: Keynote route: native body text (whole paragraphs); keep measured as PowerPoint default. Costs PowerPoint: none for PowerPoint (opt-in). Sure: high.
- **text-columns** (KN-FMT-080, KN-FMT-081). OPF: `ContentPayload.columns (auto|1-3, lists)`. Export: separate text boxes per column (shape-blocks.js writes numCol="1" always) (packages/pptx/src/index.js:addListPayload; shape-blocks.js:writeShapeBlocks (numCol="1")).
  Evidence: $W/prior/mac-034/grades/charts-examples.md:31.
  Fix: Write list columns as one text box with a:bodyPr numCol in native mode so Keynote shows Columns = n. Costs PowerPoint: PowerPoint supports numCol natively; column breaks are balanced by PowerPoint, not OPF - check fit. Sure: low.
- **text-in-shape** (KN-TXT-005, KN-TXT-006, KN-TXT-015, KN-TXT-016). OPF: `OverlayShape.text / shape block text, padding, anchor`. Export: p:sp p:txBody inside the shape (packages/pptx/src/shape-blocks.js:writeShapeBlocks).
  Evidence: $W/prior/mac-034/grades/shapes-diagrams.md:15. Native, but wraps differ where the Mac lacks the font (wider fallback).
  Fix: Install fonts / --typefaces safe; nothing to change in XML. Costs PowerPoint: none. Sure: high.
- **text-link** (KN-LNK-001, KN-LNK-003, KN-LNK-004, KN-LNK-006, KN-LNK-007, KN-LNK-008 and 2 more). OPF: `TextRun.link and OverlayShape.link / ContentPayload.link: http(s), mailto:, tel: (0.36.0). Links to a slide ("slide:<id>") only on main (FR-03), not 0.36.0; no "exit slideshow" link`. Export: a:hlinkClick r:id (external); hyperlink color from the theme hlink slot (packages/pptx/src/index.js:writeLinkSentinels; shape-blocks.js:linkShapeBlocks).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:144.
  Fix: Keynote ignores the hyperlink color extension and draws links in the theme hyperlink color: in the Keynote route set the theme hlink slot to the color OPF wants for the link (or write the run color and suppress the theme link color); link targets themselves are expected native. Costs PowerPoint: Changing the theme hlink slot also changes PowerPoint's new links; opt-in. Sure: medium.
- **vertical-text** (KN-LNG-014, KN-LNG-015, KN-LNG-016, KN-LNG-017, KN-LNG-018). OPF: `textDirection (horizontal|vertical|vertical270|stacked)`. Export: a:bodyPr vert="vert|vert270|wordArtVert" (packages/pptx/src/shape-blocks.js (vert=)).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:146; $W/prior/mac-034/grades/shapes-diagrams.md:18. Saw: the export writes vert="vert" for the Japanese probe text ($W/build/036/inventory/probe-inventory/default.pptx, ppt/slides/slide1.xml), not eaVert.
  Fix: For CJK text write vert="eaVert" (what Keynote maps to its vertical text) in place of wordArtVert; Latin "stacked" has no Keynote equivalent (keep, document). Costs PowerPoint: PowerPoint draws eaVert natively for CJK; same look. Sure: low.
- **video** (KN-MED-003, KN-MED-005, KN-MED-009, KN-MED-012, KN-MED-017, KN-MED-018 and 6 more). OPF: `video payload (Asset src/title): drawn as a placeholder, no playback (schema says native playback is out of scope)`. Export: native shapes (frame rect, play badge, caption) with a:hlinkClick to the http(s) source; no p:video (packages/pptx/src/index.js:addMediaPayload).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:168.
  Fix: Format candidate rather than export fix: embed local video files as p:video/p14:media with a poster frame (PptxGenJS supports addMedia); web links stay linked shapes. Costs PowerPoint: Larger files; PowerPoint plays embedded mp4 natively. Sure: medium.
- **web-video** (KN-MED-007, KN-MED-008). OPF: `video payload with an https URL (linked placeholder)`. Export: shapes with a:hlinkClick (packages/pptx/src/index.js:addMediaPayload).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:168.
  Fix: None in the file; keep the linked placeholder. Costs PowerPoint: none. Sure: medium.
### Expected: unknown: needs test

- **auto-shrink** (KN-TXT-004, KN-FMT-005). OPF: `Engine fit (composition min/maxFontSize); native mode writes autofit`. Export: a:bodyPr a:normAutofit fontScale (native mode); fixed sizes in measured mode (packages/pptx/src/native-autofit.js:nativeAutofit; flag --body-text native).
  Evidence: none.
  Fix: If Keynote ignores normAutofit fontScale, write the already-scaled size (as measured mode does) in the Keynote route. Costs PowerPoint: PowerPoint loses live shrink on edit - opt-in only. Sure: low.
- **caps** (KN-FMT-027). OPF: `No authoring key; eyebrow/tag labels are written all caps by the engine`. Export: a:rPr cap="all" (packages/pptx/src/index.js:eyebrowOptions (caps)).
  Evidence: none.
  Fix: If Keynote shows the label in lower case, write the upper-cased text in the Keynote route. Costs PowerPoint: PowerPoint loses the toggle; opt-in. Sure: low.
- **chart-axis-title** (KN-CHT-099, KN-CHT-100). OPF: `chart.axisTitles (category, value, secondary)`. Export: c:catAx/c:valAx c:title (packages/pptx/src/chart-options.js).
  Evidence: $W/prior/mac-034/grades/layouts-smartart.md:7.
  Fix: none proposed until the test says what Keynote does. Check: Chart > Axis: Axis Name checkbox and text.
- **chart-gridlines** (KN-CHT-058, KN-CHT-059, KN-CHT-060, KN-CHT-061, KN-CHT-062). OPF: `Engine-chosen gridlines/ticks (no key)`. Export: c:majorGridlines, c:majorTickMark, c:majorUnit (vendor/pptxgenjs/pptxgen.es.js (axes)).
  Evidence: none. Axis min/max/step not authorable in OPF.
  Fix: none proposed until the test says what Keynote does. Check: Chart > Axis: Major Gridlines, Tick Marks.
- **chart-number-format** (OPF-chart-number-format). OPF: `DataColumn.format (prefix, #,##0.0, %, suffix)`. Export: c:numFmt formatCode sourceLinked=0 (packages/pptx/src/chart-data.js).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Chart > Axis/Series: Value Data Format.
- **date-field** (KN-EXP-062). OPF: `HeaderFooterItem.date, dateFormat`. Export: placeholder type=dt with a:fld datetime* (packages/pptx/src/furniture-fields.js:nativeDateField).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Slide: date text in footer; select it: live date field or text.
- **fill-pattern** (OPF-fill-pattern). OPF: `fill.pattern (preset, fore/background); PatternBackground`. Export: a:pattFill prst (packages/pptx/src/shape-blocks.js:fillXml; background.js:presetPatterns).
  Evidence: $W/src-036/skills/opf-export/SKILL.md:152.
  Fix: If Keynote flattens to a color: Keynote route writes the pattern as a small tiled PNG (a:blipFill a:tile). Costs PowerPoint: PowerPoint loses the editable pattern; opt-in. Sure: low.
- **flip** (KN-ARR-029). OPF: `flip (horizontal|vertical|both)`. Export: a:xfrm flipH/flipV (packages/pptx/src/shape-blocks.js).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Arrange > Flip buttons state; visual.
- **group** (KN-ARR-024, KN-ARR-032). OPF: `Block groups (type group) arrange content but are not exported as groups; diagrams/SmartArt fallback shapes are grouped`. Export: p:grpSp only for diagram shapes and template placeholders (packages/pptx/src/diagram-shapes.js:writeDiagramGroups).
  Evidence: none.
  Fix: Consider grouping an OPF group's shapes (p:grpSp) so Keynote/PowerPoint move it as one. Costs PowerPoint: may change PowerPoint text editing paths; small. Sure: low.
- **image-adjust** (KN-IMG-039, KN-IMG-040, KN-IMG-041, KN-IMG-042, KN-IMG-043, KN-IMG-044). OPF: `image recolor (dark/light duotone), background recolor; no exposure/saturation`. Export: a:duotone / a:grayscl / a:lum in a:blip (packages/pptx/src/index.js:imageEffects; background.js).
  Evidence: $W/prior/mac-0351/README.md:67. Background tile test: Keynote lost a:grayscl (mac-0351 README §4 item 4).
  Fix: Keynote route: bake recolor (duotone/grayscale) into the exported picture pixels. Costs PowerPoint: PowerPoint loses the editable recolor; opt-in. Sure: medium.
- **image-crop** (KN-IMG-006, KN-IMG-013, KN-IMG-035, KN-IMG-037, KN-INT-044, KN-IMG-047). OPF: `image fit cover + focus (crop), aspectRatio`. Export: a:blipFill a:srcRect (packages/pptx/src/image-geometry.js:framePicture).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Double-click the picture: Edit Mask shows the hidden part (native mask) or the picture is pre-cropped.
- **image-description** (KN-ACC-001, KN-ACC-002, KN-ACC-003, KN-ACC-004, KN-ACC-005, KN-EXP-032). OPF: `alt / decorative on images, charts, tables, diagrams, shapes`. Export: p:cNvPr descr (and decorative extension) (packages/pptx/src/frame-alt.js:writeFrameAlt; packages/pptx/src/index.js:assetAlt).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: probe.json image item `description` (sdef image.description).
- **indents** (KN-FMT-077, KN-FMT-078, KN-FMT-079, KN-LST-010). OPF: `List item level (ListItem.level); no authoring key for indents`. Export: a:pPr marL/indent per level (packages/pptx/src/native-body.js; packages/pptx/src/index.js:addMeasuredList; flag --body-text native).
  Evidence: none. Default export writes measured text: one text box per wrapped line (bin/README.md). In Keynote a paragraph then arrives as several text boxes, so paragraph-level settings are per line. `--body-text native` writes whole paragraphs and placeholders.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Bullets & Lists: indent values per level.
- **language** (KN-LNG-002, KN-LNG-003, KN-LNG-004, KN-LNG-006, KN-LNG-007, KN-LNG-008). OPF: `Presentation.language, Slide.language, TextRun.language (BCP-47)`. Export: a:rPr lang/altLang (packages/pptx/src/script-fonts.js:runLanguageTag).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: File > Advanced > Language & Region shows what after opening; spelling language of a run.
- **line-spacing** (KN-FMT-082, KN-FMT-083, KN-FMT-084, KN-FMT-085, KN-FMT-086, KN-FMT-087). OPF: `No authoring key; the engine sets line pitch and paragraph gaps (composition)`. Export: a:lnSpc/a:spcBef/a:spcAft (native mode, shapes); exact line boxes in measured mode (packages/pptx/src/native-body.js:nativeBodyDefaults; native-text-fragments.js; flag --body-text native).
  Evidence: none. Default export writes measured text: one text box per wrapped line (bin/README.md). In Keynote a paragraph then arrives as several text boxes, so paragraph-level settings are per line. `--body-text native` writes whole paragraphs and placeholders.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Spacing pop-up value on a native-mode body.
- **lists-image-bullets** (KN-LST-006). OPF: `design.listBullet = "image"; ListItem.icon`. Export: a:buBlip (native) or icon pictures (packages/pptx/src/index.js:addListPayload).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Bullets & Lists: Image Bullets?.
- **lists-numbers** (KN-LST-001, KN-LST-007, KN-LST-008). OPF: `Slide.numbering / ContentPayload.numbering (arabic, roman, alpha; start, suffix); docs/numbered-lists.md`. Export: a:buAutoNum type startAt (packages/pptx/src/numbered-list.js:autoNumScheme; native-body.js; flag --body-text native).
  Evidence: none. Saw: measured (default) export numbers each line box on its own a:buAutoNum with startAt (probe slide2.xml), so Keynote gets one-item lists; native mode the same markup on whole paragraphs.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Bullets & Lists: Numbers and its style; tiered numbering off.
- **media-placeholder** (KN-THM-014, KN-THM-015, KN-THM-016, KN-THM-017, KN-IMG-019, KN-IMG-023 and 2 more). OPF: `image payload without src in a template (template: true, variables type image) -> image placeholder`. Export: p:pic / p:sp with p:ph type=pic in the layout (template-layouts) and grouped placeholder shapes (packages/pptx/src/index.js:addImagePlaceholder; template-layouts.js:layoutPlaceholders).
  Evidence: none.
  Fix: If Keynote shows a picture instead: write the empty picture as a layout p:ph type=pic only (no fallback picture on the slide). Costs PowerPoint: PowerPoint shows the "click to add picture" prompt; already the case. Sure: low.
- **object-list** (KN-APP-008, KN-ARR-030, KN-ARR-033, KN-ARR-034, KN-ARR-035, KN-APP-038 and 2 more). OPF: `Payload id → shape names (cNvPr name "OPF …")`. Export: p:cNvPr name (packages/pptx/src/index.js (objectName on every item)).
  Evidence: none. Object names are app-visible metadata; names like "OPF media … frame" may confuse users.
  Fix: none proposed until the test says what Keynote does. Check: View > Show Object List: names shown for OPF shapes.
- **object-styles** (KN-STY-002, KN-STY-033, KN-STY-034, KN-STY-035, KN-STY-036, KN-STY-037 and 1 more). OPF: `ContentPayload.style (none|subtle|moderate|intense) = PowerPoint shape styles (p:style)`. Export: p:style a:lnRef/a:fillRef/a:effectRef/a:fontRef (packages/pptx/src/shape-blocks.js:styleXml).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Style: does a style thumbnail appear selected, or plain overrides?.
- **presenter-notes** (KN-SLD-009, KN-SLD-010, KN-SLD-011, KN-FMT-001, KN-SLD-012, KN-EXP-018 and 1 more). OPF: `Slide.notes`. Export: p:notes (notesSlide part) (packages/pptx/src/index.js:preserveGeneratedNotes; vendor notesSlide).
  Evidence: none.
  Fix: Expected native; if text is lost or styled oddly, compare the notes master (master-themes.js:giveNotesMastersOwnThemes). Costs PowerPoint: none. Sure: medium.
- **rotate** (KN-ARR-028). OPF: `rotate (shapes, images)`. Export: a:xfrm rot (packages/pptx/src/shape-blocks.js).
  Evidence: $W/prior/mac-034/grades/shapes-diagrams.md:13.
  Fix: none proposed until the test says what Keynote does. Check: probe.json item `rotation`.
- **shape-adjust** (KN-SHP-013, KN-SHP-014, KN-SHP-015, KN-SHP-016, KN-SHP-017). OPF: `OverlayShape.adjust (DrawingML guide values)`. Export: a:prstGeom a:avLst a:gd (packages/pptx/src/shape-blocks.js:geometryXml).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Select the shape: green handles present and at the adjusted position (Keynote converts some presets to editable paths).
- **slide-groups** (KN-SLD-013, KN-SLD-014, KN-SLD-015, KN-SLD-016, KN-SLD-044). OPF: `Slide.section (PowerPoint sections)`. Export: p14:sectionLst in presentation.xml extLst (packages/pptx/src/sections.js:writeSectionList).
  Evidence: none.
  Fix: If dropped: nothing in the file can make Keynote nest slides (no carrier); document it. If Keynote maps sections to groups, keep. Costs PowerPoint: none. Sure: low.
- **slide-layouts** (KN-THM-004, KN-SLD-001, KN-SLD-002, KN-SLD-003, KN-SLD-004, KN-THM-008 and 12 more). OPF: `Slide.layout (catalog layout records, docs/layout-templates.md)`. Export: p:sldLayout parts named for OPF layouts, placeholders per region (packages/pptx/src/template-layouts.js:writeTemplateLayouts).
  Evidence: none.
  Fix: If Keynote lists every layout as a master with OPF names and placeholders, native. Otherwise reduce to one layout per used OPF layout. Costs PowerPoint: none. Sure: low.
- **slide-link** (KN-LNK-002, KN-LNK-005). OPF: `slide:<id> on TextRun.link / shape link: on main only (FR-03, docs/rich-text.md); 0.36.0 rejects it (validate error)`. Export: a:hlinkClick action="ppaction://hlinksldjump" with a relationship to the slide part (main) (src-main packages/pptx (FR-03); not in 0.36.0).
  Evidence: none.
  Fix: Expected native (PowerPoint slide jump is Keynote's Link to Slide on import); verify, including a jump to a skipped slide. Costs PowerPoint: none. Sure: medium.
- **slide-size** (KN-DOC-004, KN-DOC-005). OPF: `design.dimensions (preset, widthInches, heightInches); docs/slide-sizes.md`. Export: p:sldSz cx/cy (packages/pptx/src/index.js:configurePresentation).
  Evidence: none.
  Fix: None expected; confirm the nine size presets (coverage-size-* decks) arrive at the exact size. Costs PowerPoint: none. Sure: high.
- **strikethrough** (KN-FMT-011). OPF: `TextRun.strikethrough`. Export: a:rPr strike="sngStrike" (packages/pptx/src/index.js:textRuns).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Font: strikethrough button.
- **superscript** (KN-FMT-057, KN-FMT-058, KN-FMT-059, KN-FMT-061, KN-APP-040). OPF: `TextRun.superscript, subscript; footnote/cite markers`. Export: a:rPr baseline="30000"/"-25000" (vendor/pptxgenjs/pptxgen.es.js (baseline); annotation-provenance.js).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Font > Advanced Options: Baseline.
- **svg-break-apart** (KN-IMG-009, KN-IMG-027, KN-SHP-020). OPF: `image src .svg (svg-image.js) ; icons`. Export: p:pic with asvg:svgBlip + PNG fallback (packages/pptx/src/svg-image.js:attachSvgPictures).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Select the picture: Format > Arrange > Break Apart enabled (an SVG) or a PNG?.
- **table-borders** (KN-TBL-046, KN-TBL-047, KN-TBL-050, KN-TBL-051, KN-TBL-067). OPF: `TableCellStyle.borders (top/right/bottom/left: color, width, dash)`. Export: a:tcPr a:lnL/a:lnR/a:lnT/a:lnB (packages/pptx/src/index.js:addTablePayload).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Select cells: Format > Cell > Border style/color/width.
- **table-header-rows** (KN-TBL-021, KN-TBL-048). OPF: `table.columns (header labels) -> one header row`. Export: a:tblPr firstRow="1" and header row cells (packages/pptx/src/index.js:normalizePptxZip (firstRow flag)).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: probe.json table `header row count` (sdef table.header row count).
- **table-merge** (KN-TBL-035, KN-TBL-036, KN-TBL-037, KN-FML-001, KN-TBL-066). OPF: `StyledTableCell.colSpan/rowSpan`. Export: a:tc gridSpan/rowSpan/hMerge/vMerge (packages/pptx/src/index.js:addTablePayload (rowSpan)).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Select the merged cell: Table > Unmerge Cells enabled.
- **theme** (KN-THM-001, KN-THM-002, KN-THM-003, KN-THM-005, KN-DOC-001, KN-DOC-002 and 15 more). OPF: `design.theme / colorScheme / fontScheme (catalog records)`. Export: ppt/theme/theme1.xml (a:clrScheme, a:fontScheme) + slide masters (packages/pptx/src/index.js:exportTheme; master-themes.js).
  Evidence: none.
  Fix: Only "the deck's colors and fonts arrive as the Keynote theme" is in reach; theme chooser/My Themes are app-only. Costs PowerPoint: none. Sure: low.
- **underline** (KN-FMT-010). OPF: `TextRun.underline`. Export: a:rPr u="sng" (packages/pptx/src/index.js:textRuns).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: Format > Text > Font: U button.
- **v-align** (KN-FMT-076). OPF: `OverlayShape/ContentPayload.anchor (top|middle|bottom); TableCellStyle.verticalAlign`. Export: a:bodyPr anchor; a:tcPr anchor (packages/pptx/src/shape-blocks.js:writeShapeBlocks; packages/pptx/src/index.js:addTablePayload).
  Evidence: none.
  Fix: none proposed until the test says what Keynote does. Check: probe.json table cell `vertical alignment`; Format > Text > Alignment vertical buttons.

## Keynote features OPF has no equivalent for that a deck format plausibly should carry

Format candidates, separate from app-only features. Each names whether a .pptx can carry it (so PowerPoint and Keynote would both get it).

- **transitions** (61 rows, e.g. KN-TRN-001, KN-TRN-002, KN-EXP-004): Slide transition (fade/push/wipe + duration) per slide -> p:transition; a small, portable set is valuable. PPTX carrier: yes (p:transition carries PowerPoint transitions; Keynote maps some (Magic Move ~ Morph is not carried)).
- **builds** (36 rows, e.g. KN-ANI-001, KN-ANI-004, KN-ANI-005): Simple builds (appear/fade by paragraph or block, on click) -> p:timing; Keynote and PowerPoint both build. PPTX carrier: yes (p:timing carries entrance/exit/emphasis/motion; Keynote imports a subset).
- **3d** (7 rows, e.g. KN-3DO-001, KN-3DO-002, KN-3DO-003): 3D model payload: niche; PowerPoint and Keynote both support glTF/USDZ differently. PPTX carrier: partial (PowerPoint 3D models (am3d) exist; Keynote exports them flat).
- **chart-border-bg** (3 rows, e.g. KN-CHT-001, KN-CHT-102, KN-CHT-103): Engine draws chart cards; no chart background/border key. PPTX carrier: yes.
- **self-playing** (14 rows, e.g. KN-PRS-005, KN-PRS-006, KN-PRS-007): Show settings (auto-advance seconds per slide, loop, kiosk) -> p:transition advTm, p:showPr; plausible for signage decks. PPTX carrier: yes (p:transition advTm and presProps p:showPr (loop, kiosk) carry them).
- **comments** (13 rows, e.g. KN-EXP-013, KN-COL-006, KN-COL-007): Review comments anchored to a slide/block id -> PPTX comments; listed in the cloud-editor program. PPTX carrier: yes (PPTX p:cmLst / modern comments; Keynote imports PPTX comments (unknown)).
- **lock** (5 rows, e.g. KN-ARR-005, KN-ARR-025, KN-TBL-062): Lock on overlay shapes/blocks (template protection) -> a:spLocks; PowerPoint honors it, Keynote unknown. PPTX carrier: yes (a:spLocks noMove/noResize/noSelect carry locks; Keynote lock import unknown).
- **image-gallery** (9 rows, e.g. KN-IMG-028, KN-IMG-029, KN-IMG-030): Image gallery: no PowerPoint carrier (would be one picture per slide or a set of hidden builds). PPTX carrier: no.
- **audio** (7 rows, e.g. KN-MED-004, KN-MED-010, KN-MED-011): Audio payload (narration/soundtrack per slide): carried by p:audioFile/p14:media; Keynote imports PPTX audio. PPTX carrier: yes.
- **phonetic** (3 rows, e.g. KN-LNG-009, KN-LNG-010, KN-LNG-011): Ruby (phonetic guide) runs for Japanese/Chinese: no PowerPoint carrier; would export as plain text. PPTX carrier: no.
- **text-fill** (5 rows, e.g. KN-FMT-015, KN-FMT-016, KN-FMT-017): Gradient text fill (a:rPr a:gradFill) for display headlines. PPTX carrier: yes.
- **text-fill-scaling** (4 rows, e.g. KN-FMT-020, KN-FMT-021, KN-FMT-023): Picture-filled text scaling; follows text-fill. PPTX carrier: partial.
- **capitalization-other** (6 rows, e.g. KN-FMT-025, KN-FMT-026, KN-FMT-028): TextRun caps (all|small) - carried by a:rPr cap; useful for labels. PPTX carrier: partial.
- **text-outline-shadow** (3 rows, e.g. KN-FMT-032, KN-FMT-033, KN-FMT-034): Text outline and text shadow on runs (a:rPr a:ln, a:effectLst): carried by PowerPoint; design-system decks rarely need it. PPTX carrier: yes.
- **drop-cap** (8 rows, e.g. KN-FMT-049, KN-FMT-050, KN-FMT-051): Drop cap on a paragraph: no PowerPoint carrier (picture or larger first run only). PPTX carrier: no.
- **baseline-shift** (1 rows, e.g. KN-FMT-060): Arbitrary baseline shift is carried by a:rPr baseline; little authoring need beyond super/subscript. PPTX carrier: yes.
- **emphasis-marks** (2 rows, e.g. KN-LNG-020, KN-LNG-021): CJK emphasis marks: no PowerPoint carrier, so preview-only; low priority. PPTX carrier: no.
- **tabs** (3 rows, e.g. KN-FMT-072, KN-FMT-073, KN-FMT-074): Tab stops are low value for an engine-laid-out format (tables cover aligned columns). PPTX carrier: yes.
- **text-highlight** (3 rows, e.g. KN-FMT-089, KN-FMT-090, KN-COL-008): TextRun.highlight (background color behind characters) -> a:highlight. PPTX carrier: yes.
- **equation** (5 rows, e.g. KN-TXT-020, KN-TXT-021, KN-TXT-022): Equation payload (LaTeX/MathML source) exported as OMML in PPTX; Keynote and PowerPoint both have native equations. PPTX carrier: yes (PPTX carries OMML (a14:m); Keynote imports/exports equations via MathML/LaTeX - whether it reads OMML is unknown).
- **exit-link** (1 rows, e.g. KN-LNK-009): Show-action links (end show, next/previous/first/last slide) -> ppaction hlinkshowjump; small addition beside slide:<id>. PPTX carrier: yes (ppaction://hlinkshowjump?jump=endshow (and first/last/next/previous slide jumps)).
- **table-banding** (1 rows, e.g. KN-TBL-004): Banded rows (a:tblPr bandRow) as a table option. PPTX carrier: yes.
- **table-header-cols** (1 rows, e.g. KN-TBL-022): Table header column flag (a:tblPr firstCol) for row-label tables; PowerPoint and Keynote both have it. PPTX carrier: yes.
- **table-footer** (2 rows, e.g. KN-TBL-023, KN-TBL-049): Table total/footer row (a:tblPr lastRow): carried by PowerPoint; Keynote footer rows. PPTX carrier: yes.
- **table-title** (3 rows, e.g. KN-TBL-043, KN-TBL-044, KN-TBL-045): None needed: caption covers it. PPTX carrier: no.
- **formulas** (11 rows, e.g. KN-FML-002, KN-FML-003, KN-FML-004): Computed cells (sum/average of a column) evaluated by the engine and exported as values; no live formula in PPTX. PPTX carrier: no (PowerPoint tables cannot hold formulas).
- **chart-bubble** (4 rows, e.g. KN-CHT-012, KN-CHT-031, KN-CHT-032): Bubble chart type (c:bubbleChart): native in PowerPoint and Keynote. PPTX carrier: yes.
- **chart-pie-rotation** (3 rows, e.g. KN-CHT-036, KN-CHT-037, KN-CHT-038): Pie first-slice angle (c:firstSliceAng). PPTX carrier: yes.
- **chart-gaps-corners** (2 rows, e.g. KN-CHT-045, KN-CHT-046): Gap width as a chart option (c:gapWidth); rounded corners have no PowerPoint carrier. PPTX carrier: partial.
- **chart-error-bars** (6 rows, e.g. KN-CHT-072, KN-CHT-073, KN-CHT-074): Error bars (fixed/percent/custom) -> c:errBars; native in both. PPTX carrier: yes.
- **chart-trendline** (5 rows, e.g. KN-CHT-078, KN-CHT-079, KN-CHT-080): Trendline on a series (linear/exp/moving average) -> c:trendline; native in both. PPTX carrier: yes.

Out of scope for a deck format (Keynote-only looks or editing state with no carrier): background-dynamic, chart-3d, chart-interactive, chart-styles, drawing, inline-objects, ligatures, paragraph-borders, paragraph-styles, picture-frame, table-styles.

App-only (395 rows): presenting and rehearsal, remotes, Keynote Live and multi-presenter, collaboration and iCloud, writing tools and spelling, intelligence and Apple Creator Studio, file management, Keynote's own export/print options, the editor UI (views, rulers, guides, object list tools, toolbar), live video, media optimization, image editing tools.

