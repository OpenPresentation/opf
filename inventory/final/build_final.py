"""Build the final Keynote feature inventory (inventory.json, gaps.md, summary-for-issue.md).

Inputs (all under W = /Users/michael/opf-work/keynote-036):
  inventory/keynote-features.json   desk rows (1,173)
  inventory/opf-map.json            desk: does OPF relate (yes/partial/no), schema keys, concept
  inventory/expectation.json        desk: expected result in Keynote, desk fix
  inventory/gui-walk/match.json     walk of Keynote 16.0: seen / not found / not walked, gui_path, curated misses
Measured results come from the round's reports; every measured value below names its evidence
(finding ids from report/tracking-body.md section 6, or a report file and section). Paths in
`evidence` are relative to W. Anything without measured evidence is "not tested" with the desk's
expectation written as "expected <x> (not tested)".

Run: python3 inventory/final/build_final.py   (from W, or anywhere)
"""
import json, collections, os

W = '/Users/michael/opf-work/keynote-036'
INV = W + '/inventory'
OUT = INV + '/final'

feat = json.load(open(INV + '/keynote-features.json'))['rows']
omap = {r['id']: r for r in json.load(open(INV + '/opf-map.json'))['rows']}
expd = {r['id']: r for r in json.load(open(INV + '/expectation.json'))['rows']}
match = json.load(open(INV + '/gui-walk/match.json'))

N, C, P, D, T = 'native', 'editable but changed', 'picture', 'dropped', 'not tested'
TB = 'report/tracking-body.md'
RT = 'grades/roundtrip/REPORT.md'
RTO = 'grades/roundtrip/objects.md'
SHO = 'grades/corpus-shapes/objects.json'
CHO = 'grades/corpus-charts/objects.json'
LIMIT = 'Keynote limit: no file form helps (tested)'

# ---------------------------------------------------------------------------
# Measured result per desk concept (applies to every OPF has/partly row of that concept).
# r = keynote_result (default export mode), ev = evidence, f = finding ids that change the look
# even where the object kind is native, fix = what OPF's export could change, nm = native-mode note.
# ---------------------------------------------------------------------------
K = {
 'align-distribute': dict(r=N, ev='grades/matrix-sweep/REPORT.md (M21, M23, M36 passed); %s §1 shapes 325/6/0/0' % RT,
     note='Positions are static in the file; Keynote\'s Align/Distribute act on native objects.'),
 'arrowheads': dict(r=C, ev='QS-07 (grades/corpus-shapes/REPORT.md)', f=['QS-07'],
     fix='none proposed: Keynote ignores a:headEnd/a:tailEnd w and len (QS-07); no file form tried'),
 'auto-shrink': dict(r=C, ev='ui/REPORT-2.md C2 (titles shrink to fit in both modes); experiments-xml LY-01 (normAutofit does not shrink); RT-06',
     f=['LY-01', 'RT-06'],
     fix='--typefaces safe in the opt-in Keynote route (#1298; tested: LY-01 gone); normAutofit and one-paragraph titles: ' + LIMIT + ' (LY-01)',
     note='Keynote applies its own shrink-to-fit to the title placeholder; OPF\'s engine fit is written as fixed sizes.'),
 'background-gradient': dict(r=N, ev='grades/corpus-shapes/REPORT.md Known rows (three-stop gradient within 1/255, coverage-backgrounds 6)',
     note='Look matched; whether the Background pane shows Gradient Fill was not read.'),
 'background-image': dict(r=C, ev='EX-02; %s picture (coverage-backgrounds: full-slide background pictures)' % SHO, f=['EX-02'],
     fix='untested idea: pre-blend the picture at its opacity over the slide base color and write no alphaModFix (EX-02, %s §7 (d)); '
         'writing it as p:bg a:blipFill gives Background > Image Fill but drops alphaModFix and a:grayscl (tested, #1416 item 4)' % TB,
     note='Written as a full-slide picture object, not Keynote\'s Background > Image Fill; a background picture with opacity is drawn at full strength (135 example slides with EX-03).'),
 'background-solid': dict(r=N, ev='%s §8 85%% background row; ui/REPORT-2.md A8' % TB,
     note='Opaque colors as the preview; a translucent color is composited over black in the window (#1418).'),
 'background-tile': dict(r=C, ev='%s §8 Tiled background (coverage-backgrounds 11)' % TB,
     fix='p:bg tile at sx/sy 75% tiles 2 by 2 but loses the 40% opacity (tested, #1416 item 4); untested idea: bake opacity and recolor into the tile PNG, then p:bg tile (opt-in Keynote route, #1298)'),
 'bidi': dict(r=C, ev='MX-06, RT-07; ui/REPORT.md A4 (no paragraph-direction control)', f=['MX-06', 'RT-07'],
     fix=LIMIT + ': explicit rtl="0"/"1" changes nothing (MX-06); a right-to-left mark keeps rtl only in back.pptx (RT-07)',
     note='Keynote sets the direction per line from its first strong character; pure right-to-left text draws right (91 tags, %s §9).' % TB),
 'bold-italic': dict(r=N, ev='%s §4 Body text 1229/0/0/0; ui/REPORT-2.md (header cells Helvetica-Bold)' % TB, f=['EX-05', 'EX-12'],
     fix='native mode: bullets inherit the layout\'s b="1" (EX-05, #1552); a named weight face such as Roboto SemiBold is drawn regular (EX-12; untested idea: b="1" for weights 600 and up)'),
 'caps': dict(r=T),
 'caption': dict(r=C, ev='%s other text (captions are ordinary text boxes); ui/REPORT-2.md C3' % RTO,
     fix='--body-text native: the caption becomes a body placeholder and a grown table no longer covers it (tested, ui/REPORT-2.md C3); untested idea: group picture and caption (p:grpSp). Keynote\'s own Caption/Title has no PPTX carrier',
     nm='native mode: caption is a body placeholder (C3)'),
 'cell-formats': dict(r=C, ev='ui/REPORT-2.md (sweep-tables 4, coverage-tables 1: numbers stored as text, format Automatic); RT-08',
     f=['RT-08'], fix=LIMIT + ': plain numbers tried (RT-08); PPTX tables carry no cell number format'),
 'char-spacing': dict(r=N, ev='%s §8 Letter spacing row (coverage-regions 19); grades/corpus-text/REPORT.md' % TB),
 'chart-area': dict(r=C, ev='%s §8 Area gap; EX-10; QC-05; QC-10' % TB, f=['EX-10', 'QC-05', 'QC-10'],
     fix='gap bridging: ' + LIMIT + ' (§8); EX-10 untested idea: reference series in the data series\' c:lineChart group (areas: no file form known); QC-05 untested idea: avoid per-point c:dLbl delete'),
 'chart-axis-title': dict(r=N, ev='grades/matrix-m/negative-bars-legend-keynote.md (m-negative-bars 7: both axis titles drawn)'),
 'chart-colors': dict(r=C, ev='%s §8 Per-point bar colors; %s §7 (c:dPt dropped on 31 series); MX-03' % (TB, RT), f=['MX-03'],
     fix='none that holds: second-series and c:dPt forms tried for the highlight (MX-03, #1494) each break the legend or the columns (tested)',
     note='Series colors are kept; per-point colors (highlight) are not drawn.'),
 'chart-column-bar': dict(r=N, ev='%s §4 Chart 70/2/0/0; ui/REPORT-3.md C4' % TB, f=['MX-02', 'MX-04', 'EX-07', 'QC-08'],
     fix='c:layoutTarget inner for every manual plot area (tested, MX-02, #1492 closed; combos EX-07 still outer in 0.37.0); line breaks in long category names with c:tickLblSkip 1 (tested, MX-04); untested: always write the axis scaling (QC-08)'),
 'chart-gridlines': dict(r=C, ev='QC-02, QC-08 (grades/corpus-charts/REPORT.md)', f=['QC-02', 'QC-08'],
     fix='omit c:majorUnit (tested on the secondary axis, #1416 item 2); untested: a maximum that is a whole number of steps (QC-02); write explicit scaling on every axis (QC-08)'),
 'chart-insert': dict(r=N, ev='ui/REPORT-3.md C4 (Edit Chart Data, value doubled, chart redraws); %s §4 Chart 70/2/0/0' % TB,
     f=['MX-03', 'RT-01'], fix='importer: degrade one chart, never the deck, on Keynote\'s caches (RT-01/QC-01 #1477 closed, RT-02 #1478)'),
 'chart-labels': dict(r=C, ev='MX-05; QC-05; QC-07; QC-09; %s §8 Direct line labels' % TB, f=['MX-05', 'QC-05', 'QC-07', 'QC-09'],
     fix='per-point showCatName and c:separator: ' + LIMIT + ' (MX-05); untested: explicit number format instead of General (QC-07)'),
 'chart-legend': dict(r=N, ev='%s §4 Chart; LY-03; MX-07; QC-10' % TB, f=['LY-03', 'MX-07', 'QC-10', 'MX-03'],
     fix='bottom legend is the only form that stays in the frame (tested, LY-03; opt-in Keynote route); manual legend box: ' + LIMIT),
 'chart-line': dict(r=N, ev='%s §4 Chart (stacked line becomes line); §8 Direct line labels' % TB, f=['MX-03'],
     fix='stacked lines: cumulative values in a standard line chart draw the stacked heights (tested, #1416 item 6; labels still dropped)'),
 'chart-mixed': dict(r=C, ev='EX-07; QC-02; %s §8 Secondary value axis' % TB, f=['EX-07', 'QC-02'],
     fix='omit c:majorUnit (tested, #1416 item 2: 0-40% shows); untested: c:layoutTarget inner on combos (EX-07, comment on #1492)'),
 'chart-pie': dict(r=N, ev='grades/matrix-m/objects.json (m-charts: pie, doughnut kept); EX-01; MX-05', f=['EX-01', 'MX-05', 'MX-07'],
     fix='two-series doughnut: untested idea: one single-series doughnut per ring or a picture for Keynote (EX-01, comment on #1477)'),
 'chart-radar': dict(r=C, ev='%s §8 Radar row (coverage-charts 5); QC-10' % TB, f=['QC-10'],
     fix='a:noFill on line-radar series (tested, #1416 item 1)'),
 'chart-reference-lines': dict(r=C, ev='%s §8 Reference line label (#1416-5)' % TB,
     fix='reference label above the plot is clear (tested, #1416 item 5)'),
 'chart-scatter': dict(r=N, ev='grades/corpus-charts/REPORT.md (scatter native, chart-type-sampler)', f=['QC-09', 'QC-08', 'QC-02'],
     fix='untested: write explicit axis scaling (QC-08); left/right label position is redrawn above: none proposed (QC-09)'),
 'chart-title': dict(r=C, ev='%s §8 Chart title still centered' % TB, fix='none proposed (no file form tried)'),
 'conditional': dict(r=C, ev='grades/corpus-charts/REPORT.md Tables (cell fills drawn); %s §7 (fills move into a table style)' % RT,
     fix='none proposed: OPF\'s highlight arrives as fixed fills; PPTX has no conditional-highlight rule (not tested)'),
 'connector-straight': dict(r=N, ev='ui/REPORT.md A6 (moving "Build" moved its three lines); %s line/connector' % SHO, f=['QS-01'],
     fix='glue is lost only in Keynote\'s own PowerPoint export when an end is a text shape that became a group (QS-01); untested idea: drop prstTxWarp from shape-block text'),
 'curve-corner': dict(r=C, ev='%s §8 Elbow; curved connector row' % TB,
     fix='untested idea: curved connector as a custGeom cubic path, elbow as an explicit polyline (loses glue; opt-in Keynote route); #1416 item 8 needs a route OPF computes'),
 'date-field': dict(r=T),
 'fill-color': dict(r=N, ev='%s §4 Shape 325/6/0/0; grades/corpus-charts/REPORT.md Tables (cell fills drawn)' % TB),
 'fill-gradient': dict(r=N, ev='grades/corpus-shapes/REPORT.md (three-stop gradient matches); QS-06', f=['QS-06'],
     fix='path="rect"/"shape" gradients drawn as a circle (QS-06): untested idea: write them as a linear mirror or radial approximation in the opt-in route'),
 'fill-image': dict(r=C, ev='%s picture (mask roundRect/ellipse -> custGeom, 57)' % RTO,
     fix='none proposed: OPF writes a masked picture, not a shape image fill; it looks as the preview'),
 'flip': dict(r=T),
 'font': dict(r=N, ev='%s §3 Fonts (names kept, drawn in Helvetica where missing); %s §1 Fonts reported missing' % (RT, TB),
     f=['LY-01', 'LY-02', 'LG-01', 'SW-01', 'MX-08', 'EX-08', 'EX-09', 'EX-12'],
     fix='--typefaces safe in the opt-in Keynote route (#1298; tested: layouts-lots wrong 12 -> 2, EX-08 fixed)',
     note='The font name is carried; Keynote substitutes Helvetica when Aptos or another face is not on the Mac.'),
 'font-size': dict(r=N, ev='%s §3 Sizes (whole sizes kept, 3478 paragraphs); RT-06' % RT, f=['RT-06'],
     fix='write whole-point sizes: Keynote reads them exactly and truncates fractions (tested, experiments-xml roundtrip-xml)'),
 'group': dict(r=N, ev='%s group (diagram groups kept, nested); %s group' % (SHO, RTO),
     note='OPF block groups are not exported as groups; diagram groups stay groups. Keynote adds 116 groups of its own (RT-05).'),
 'h-align': dict(r=N, ev='%s §3 Alignment (0 changes in about 5800 paragraphs)' % RT, f=['MX-01', 'EX-06'],
     fix='flush lines: no trailing space and the unshifted box (tested, MX-01, #1493 closed); native mode list written algn="ctr" (EX-06, #1551)'),
 'hidden-slide': dict(r=N, ev='%s §4 Hidden slide; %s hidden slide' % (TB, RTO), f=['QC-04'],
     fix='live slide numbers skip a hidden slide in Keynote (QC-04): --slide-numbers static'),
 'image': dict(r=N, ev='%s §4 Picture 97/117/0/0 (changes are crops and masks); %s picture' % (TB, SHO)),
 'image-adjust': dict(r=T, note='Recolored pictures look as the preview and Keynote re-encodes two of them as TIFF (%s picture); whether Adjust Image shows any value was not read; a:grayscl on a p:bg fill is dropped (experiments-xml limits).' % SHO),
 'image-crop': dict(r=N, ev='%s §4 Pictures (crops survive within 1/100000)' % RT,
     note='Letterbox (contain) crops become a frame sized to the image (%s picture, 55).' % RTO),
 'image-description': dict(r=D, ev='RT-03, LY-04; ui/REPORT.md A3 (Description reads "OPF image 1")', f=['RT-03', 'LY-04'],
     fix='opt-in Keynote route: alt text in the shape name, no title (tested, RT-03: only form whose Description is the alt); importer: treat a descr equal to the name as no alt (#1479)'),
 'image-mask-shape': dict(r=C, ev='%s picture (mask roundRect -> custGeom 42, ellipse -> custGeom 15)' % RTO,
     fix='none proposed: drawn as the preview with a custom outline mask instead of the preset shape'),
 'indents': dict(r=N, ev='ui/REPORT-2.md (coverage-lists 13: indent 0 / 46 pt); EX-04', f=['EX-04'],
     note='Default mode: each line is its own box, so a first-line or hanging indent applies per line.'),
 'language': dict(r=T, note='Keynote\'s PowerPoint export writes no lang on any run (grades/languages/fonts.md); whether Keynote keeps the language internally was not read.'),
 'layer': dict(r=N, ev='%s §1 (probe order matches back.pptx); QC-03' % RT, f=['QC-03'],
     fix='untested idea: footer as a plain text box, or the placeholder after full-bleed pictures (QC-03; Header & Footer loses control in PowerPoint)'),
 'line-break': dict(r=N, ev='%s Notes on the method (every text box kept its exact text)' % RTO),
 'line-shape': dict(r=N, ev='%s §4 Line / connector 95/0/0/1' % TB),
 'line-spacing': dict(r=C, ev='ui/REPORT-2.md C1 (default: added lines closer than the bullet boxes above); ui/REPORT-2.md (sweep-growth native 4: spacing 51 pt)',
     fix='--body-text native (tested, C1: one box, Keynote spacing); opt-in Keynote route (#1298)', nm='native mode: paragraph spacing in one box (C1)'),
 'lists-bullets': dict(r=C, ev='%s §4 List items; ui/REPORT-2.md C1' % TB, f=['QT-01', 'EX-05', 'EX-06'],
     fix='--body-text native (tested, C1: eight bullets in one box, no overflow); fix its native-mode defects first: EX-05 #1552, EX-06 #1551, SW-02 #1481 (closed)',
     nm='native mode: real list in the body placeholder (C1)'),
 'lists-image-bullets': dict(r=C, ev='EX-04 (39 slides in 39 decks)', f=['EX-04'],
     fix='untested idea: letterbox the logo into a transparent square bullet image, or the character bullet when no icon is given (EX-04, %s §7 (d))' % TB),
 'lists-numbers': dict(r=C, ev='%s §3 Bullets and numbering (buAutoNum and startAt kept per line box); grades/corpus-text/REPORT.md (roman, restarts as preview)' % RT,
     fix='--body-text native: one numbered list per block (tested for bullets, C1)', nm='native mode: one list, Keynote numbering'),
 'media-placeholder': dict(r=T, note='Keynote warns "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside" for the empty picture placeholders (proved, %s §4); back.pptx still has the pic placeholders; a filled placeholder keeps its picture (%s image-callouts). The placeholder in Keynote\'s layout editor was not read.' % (TB, SHO),
     fix='picture-placeholder spelling type="body" removes the warning but loses the picture placeholder (tested, experiments-xml pic-placeholders; opt-in only)'),
 'object-list': dict(r=N, ev='%s §1 (Keynote keeps every OPF shape name)' % RT,
     note='Names read "OPF image 1", "OPF heading ..." in Keynote\'s object list.'),
 'object-styles': dict(r=T),
 'opacity': dict(r=T),
 'placeholder-title-body': dict(r=N, ev='%s §2 (title is the layout title item on all 784 slides; body placeholder on the 152 native slides)' % RT),
 'position-size': dict(r=N, ev='%s §4 (shapes, pictures, charts native; positions as the preview)' % TB),
 'presenter-notes': dict(r=N, ev='%s §4 Presenter notes (verbatim on 700 slides)' % TB),
 'reflection': dict(r=T),
 'rotate': dict(r=N, ev='%s §8 Rotated narrow text row' % TB, f=['font'], note='Rotation is drawn; rotated narrow text wraps mid-word (font substitution).'),
 'shadow-contact': dict(r=C, ev='QS-08', f=['QS-08'], fix='none proposed: perspective shadow becomes a plain drop shadow (QS-08); no form tried'),
 'shadow-drop': dict(r=C, ev='QS-08 (colored shadow barely visible)', f=['QS-08'],
     fix='untested idea: measured conversion of outerShdw blur/offset to Keynote\'s scale (desk)'),
 'shape-adjust': dict(r=C, ev='QS-02; ui/REPORT-2.md (chevron, rightArrow keep the edit handle, triangle none)', f=['QS-02'],
     fix='none proposed: Keynote turns 95 of 187 presets into freeforms without handles (QS-02)'),
 'shape-library': dict(r=C, ev='QS-02 (of 187 presets 23 stay presets, 95 freeforms, 63 groups, 6 lines); QS-03 to QS-05', f=['QS-02', 'QS-03', 'QS-04', 'QS-05'],
     fix='untested idea: pentagon, heptagon, punched tape, leftRightRibbon as freeforms in the opt-in route (#1298; costs PowerPoint the handles)',
     note='All drawn as the preview except QS-03 to QS-05; editable, but most are no longer Keynote\'s parametric shapes.'),
 'shape-path': dict(r=N, ev='%s shape (freeforms editable); %s §4 Shape' % (SHO, TB)),
 'slide-border': dict(r=N, ev='%s §4 Shape 325/6/0/0 (a rectangle shape)' % TB),
 'slide-groups': dict(r=T, note='Keynote\'s back.pptx of the inventory probe has no p14:section (read for this inventory: keynote/036/inventory/probe-inventory~default/back.pptx); the navigator was not looked at.'),
 'slide-layouts': dict(r=N, ev='%s §2 (OPF layout names on 732 of 784 slides); LY-06' % RT, f=['LY-06'],
     fix='LY-06: Keynote copies a layout per slide with its own background ("Section 0"): ' + LIMIT + ' (no slide background tried)'),
 'slide-link': dict(r=N, ev='ui/REPORT-3.md (Edit Link: "Link to: Slide", slide 3); grades/roundtrip/slide-links.md (8 of 8 jumps kept)',
     note='OPF main (FR-03) only; 0.36.0 rejects slide:<id>.'),
 'slide-number': dict(r=C, ev='%s §4 Footer, slide number (6/41/0/0); §8 Slide number beside footer text; QC-04' % TB, f=['QC-04'],
     fix='--slide-numbers static (tested: "Page 1 of 4", "3 / 38"; opt-in Keynote route #1298, costs the live field)'),
 'slide-size': dict(r=N, ev='grades/corpus-text/REPORT.md Slide sizes (nine sizes as the preview; A4 rounded to whole points)'),
 'stroke': dict(r=N, ev='%s line/connector (dashes kept: dash, dot, longDash, sysDot, custom)' % SHO,
     note='Sketch outlines draw plain and compound lines single (%s §8).' % TB),
 'strikethrough': dict(r=T), 'underline': dict(r=T), 'superscript': dict(r=T),
 'svg-break-apart': dict(r=C, ev='%s picture SVG (Keynote shows and keeps the PNG, drops the SVG)' % SHO,
     fix='none proposed: Keynote drops asvg:svgBlip; a vector icon arrives as a PNG picture (Break Apart not available)'),
 'table': dict(r=N, ev='%s §4 Table 38/0/0/0; ui/REPORT-2.md C3' % TB, f=['SW-01', 'MX-08'],
     fix='header words split by the wider substitute: columns 10% wider (tested, SW-01, MX-08) or --typefaces safe (tested)'),
 'table-borders': dict(r=T),
 'table-header-rows': dict(r=N, ev='%s §7 (header-row flag kept); grades/corpus-charts/REPORT.md Tables (header row count 1)' % RT),
 'table-merge': dict(r=N, ev='grades/corpus-charts/REPORT.md Tables (coverage-tables 3: gridSpan, rowSpan, hMerge, vMerge kept)'),
 'table-rows-cols': dict(r=N, ev='ui/REPORT-2.md C3 (row added, takes the table style)', f=['C3'],
     fix='default mode: a grown table runs over a caption text box (C3); --body-text native avoids it (tested)'),
 'table-rtl': dict(r=C, ev='LG-02; ui/REPORT.md A4 (columns C | B | A, X 61 pt)', f=['LG-02'],
     fix='opt-in Keynote route (#1298): left-to-right table in visual column order, or rtl table with x moved by its width (both tested, LG-02)',
     note='Desk expected "dropped" (15.x drew only the first column); 16.0 draws all columns, mirrored and misplaced.'),
 'table-text': dict(r=C, ev='SW-01, MX-08; ui/REPORT-2.md (sweep-tables 12 headers break inside words)', f=['SW-01', 'MX-08'],
     fix='columns 10% wider (tested, SW-01, MX-08) or --typefaces safe (tested)'),
 'text-box': dict(r=C, ev='%s §4 Body text; ui/REPORT-2.md C1; LY-02' % TB, f=['LY-02', 'MX-01'],
     fix='--body-text native in the opt-in Keynote route (tested, C1); one wrapped box for a column of lines (tested, LY-02)',
     nm='native mode: one paragraph box per region, re-wrapped by Keynote'),
 'text-color': dict(r=N, ev='%s §4 Other text; %s §8 Link text row' % (TB, TB), f=['EX-11'],
     fix='native mode: emphasis color of bold runs lost, written tx1 (EX-11, #1553)'),
 'text-columns': dict(r=T, note='Two-column lists look as the preview (grades/corpus-text/REPORT.md); whether Keynote\'s Columns shows 2 was not read.'),
 'text-in-shape': dict(r=C, ev='RT-05, QS-01 (text in a non-rectangular preset becomes a group of shape plus text box)', f=['RT-05', 'QS-01'],
     fix='untested idea: drop a:prstTxWarp prst="textNoShape" from shape-block text bodies (QS-01; helps the 51 rectangles only)'),
 'text-link': dict(r=N, ev='%s §4 Links (all native); ui/REPORT-2.md A7' % TB, f=['#1416-7'],
     fix='link text takes the theme a:hlink color: ' + LIMIT + ' (#1416 item 7: 000000 and accent1 tried)'),
 'theme': dict(r=T, note='Keynote\'s back.pptx keeps the major font name (Aptos) and writes Helvetica as minor font (probe-inventory back.pptx, read); theme colors in the color well were not read.'),
 'v-align': dict(r=N, ev='grades/matrix-m/REPORT.md M62 (native body anchored in the middle at preview size)'),
 'vertical-text': dict(r=C, ev='%s §8 Vertical text still rotated; probe-inventory back.pptx (rot 5400000, vert dropped; read)' % TB,
     fix='untested idea: vert="eaVert" for CJK text (desk); Latin stacked text has no Keynote form'),
 'video': dict(r=C, ev='%s link on a shape (video frames survive as web links on the shape); %s §9 (video comes back as plain text)' % (RTO, RT),
     fix='untested idea (format candidate): embed local video as p:video with a poster frame; OPF writes a placeholder with a link, never a Keynote movie'),
 'web-video': dict(r=C, ev='%s link on a shape (video frames survive as web links)' % RTO,
     fix='none proposed: a linked placeholder; Keynote\'s Web Video has no PPTX carrier known'),
}
# per-row overrides (result differs within a concept)
ROW = {
 'KN-SLD-022': dict(r=C, ev='ui/REPORT-2.md A8 (85% background drawn over black, #1418)', f=['#1418'],
     fix='#1416 item 3 form (color pre-blended over white) matches the preview in the window (tested, ui/REPORT-2.md); adopt it (#1418)'),
 'KN-SLD-040': dict(r=C, ev='%s §2 (default: no slide shows a body; native: 152 body placeholders)' % RT,
     fix='--body-text native fills the body placeholder (tested, %s §2); opt-in Keynote route (#1298)' % RT, nm='native mode: body placeholder'),
 'KN-LNG-012': dict(r=C, ev='MX-06; ui/REPORT.md A4 (no paragraph-direction control)', f=['MX-06'],
     fix=LIMIT + ': explicit rtl changes nothing (MX-06)'),
 'KN-CHT-009': dict(r=C, ev='EX-01 (two-series doughnut drawn as one ring, 11 decks)', f=['EX-01'],
     fix='untested idea: one single-series doughnut per ring, or a picture for Keynote (EX-01, comment on #1477)'),
 'KN-CHT-087': dict(r=C, ev='MX-05 (pie labels lose the separator)', f=['MX-05'], fix=LIMIT + ': c:separator ignored (MX-05)'),
 'KN-CHT-019': dict(r=C, ev='QC-05 (stacked-area middle labels dropped); %s §8 Area gap' % TB, f=['QC-05'],
     fix='untested idea: avoid per-point c:dLbl delete (QC-05); gaps: ' + LIMIT),
 'KN-CHT-006': dict(r=N, ev='%s §4 Chart; matrix-m objects (line kept)' % TB, f=['#1416-6'],
     fix='direct line labels are dropped: ' + LIMIT + ' (#1416 item 6, both label forms)'),
 'KN-ACC-005': dict(r=T), 'KN-CHT-100': dict(r=T), 'KN-CHT-061': dict(r=T), 'KN-CHT-097': dict(r=T), 'KN-CHT-098': dict(r=T),
 'KN-CHT-049': dict(r=T), 'KN-CHT-050': dict(r=T), 'KN-CHT-051': dict(r=T), 'KN-CHT-052': dict(r=T), 'KN-CHT-053': dict(r=T),
 'KN-CHT-054': dict(r=T), 'KN-CHT-042': dict(r=T), 'KN-LST-001': dict(r=T), 'KN-LNK-007': dict(r=T), 'KN-LNK-008': dict(r=T),
 'KN-LIN-013': dict(r=T), 'KN-THM-010': dict(r=T), 'KN-ACC-010': dict(r=T), 'KN-FMT-081': dict(r=T), 'KN-CHT-030': dict(r=T),
 'KN-CHT-029': dict(r=T), 'KN-CHT-002': dict(r=T), 'KN-CHT-101': dict(r=T), 'KN-EXP-062': dict(r=T),
 'KN-STY-010': dict(r=C, ev='QS-06 (path rect/shape gradients drawn as a circle)', f=['QS-06'],
     fix='untested idea: write path gradients as a linear mirror or radial approximation (QS-06)'),
 'KN-SLD-017': dict(r=T), 'KN-SLD-013': dict(r=T),
 # rows whose control was not found in Keynote 16.0
 'KN-FMT-004': dict(r=T, note='No Autosize Text control in Format > Text > Layout of Keynote 16.0 (walk).'),
 'KN-IMG-037': dict(r=T, note='No Mask with Selection in Keynote 16.0 (walk).'),
}
# desk "opf" values corrected here (OPF has no way to say it); the desk value is kept as opf_desk
OPF_FIX = {
 'KN-TDA-041': 'OPF cell formats are number patterns; there is no checkbox cell',
 'KN-TDA-042': 'no rating cell in OPF', 'KN-TDA-043': 'no slider cell in OPF',
 'KN-TDA-044': 'no stepper cell in OPF', 'KN-TDA-045': 'no pop-up menu cell in OPF',
 'KN-CHT-014': 'OPF has no interactive (staged) chart; the desk matched it to scatter',
 'KN-THM-004': 'OPF has no live video; the desk matched it to slide layouts',
 'KN-ACC-003': 'OPF has no 3D objects', 'KN-ACC-004': 'OPF has no drawings (Keynote Draw)',
}

# ---------------------------------------------------------------------------
# The 40 interface features the desk study lacks (gui-walk/match.json missed_by_desk_curated, same order)
# (area, feature, opf, opf_keys, result, evidence, fix, note)
# ---------------------------------------------------------------------------
NEW = [
 ('text-format', 'Text columns table (#, Column, Gutter)', 'partly', 'ContentPayload.columns (auto|1-3; no width or gutter key)', 'text-columns', None),
 ('text-format', 'Equal column width', 'partly', 'ContentPayload.columns (equal columns only)', 'text-columns', None),
 ('text-format', 'Text Inset', 'has', 'OverlayShape.padding, ContentPayload.padding (ShapePadding), TableCellStyle.padding', 'text-inset',
     dict(r=T, exp='native', note='a:bodyPr lIns/tIns/rIns/bIns; not read in the inspector')),
 ('text-format', 'More Text Options popover (Character Spacing, Baseline Shift, Baseline, Capitalization, Ligatures, Outline, Shadow)', 'partly',
     'TextRun.superscript/subscript; character spacing engine-only; no key for capitalization, ligatures, text outline or text shadow', 'char-spacing',
     dict(r=T, note='Character spacing is applied in 16.0 (%s §8, coverage-regions 19); superscript/subscript not tested.' % TB)),
 ('tables', 'Resize rows to fit cell contents (checkbox)', 'partly', 'none: row heights are engine-chosen from the content', 'table-rows-cols',
     dict(r=T, note='OPF writes fixed row heights; the checkbox state was not read')),
 ('tables', 'Table Rows / Columns steppers', 'has', 'Table.columns, Table.rows', 'table-rows-cols', None),
 ('tables', 'Insert Table presets (Headers, Basic, Plain, Sums)', 'not', None, None, None),
 ('charts', 'Value axis Scale Max / Min fields', 'partly', 'none to author; the engine writes c:scaling min/max', 'chart-gridlines',
     dict(r=C, ev='QC-08, QC-02', f=['QC-08', 'QC-02'], fix='untested: write the scaling the preview uses on every axis (QC-08); omit c:majorUnit (tested, #1416 item 2)')),
 ('charts', 'Category Labels pop-up (Auto-Fit Category Labels)', 'not', None, None, None),
 ('charts', 'Category axis Series Names checkbox', 'not', None, None, None),
 ('charts', 'Chart Font typeface and size buttons', 'partly', 'design.fontScheme (chart text uses the theme minor font); no chart font key', 'font', None),
 ('charts', 'Chart Background & Border Style', 'not', None, None, None),
 ('charts', 'Chart Shadow', 'not', None, None, None),
 ('charts', 'Insert Chart: 2D 2-Axis and 2D Mixed; Interactive Column, Bar, Scatter, Bubble', 'partly', 'Chart.type combo, Chart.secondaryAxis (no interactive charts)', 'chart-mixed', None),
 ('charts', 'Edit Chart Data button under a selected chart', 'has', 'Chart.data (ChartData), DataColumn', 'chart-insert',
     dict(r=N, ev='ui/REPORT-3.md C4 (value doubled in the data editor, chart redraws)')),
 ('lines', 'Line Start X/Y and End X/Y fields', 'has', 'OverlayShape x, y, width, height on shape "line"', 'line-shape', None),
 ('lines', 'Curved and Angled Connection Line', 'has', 'OverlayShape.connector.route (curved|elbow)', 'curve-corner', None),
 ('shapes', 'Insert Shape: Quote Bubble, Polygon, Star, Double Arrow, Rounded Pill, Parallelogram, Pentagon, Curve', 'has', 'OverlayShape.shape (ShapePreset: wedgeRoundRectCallout, star5, leftRightArrow, parallelogram, pentagon, ...)', 'shape-library', None),
 ('shapes', 'Make Motion Path from Shape', 'not', None, None, None),
 ('shapes', 'Make Sharp / Smooth / Bezier Point', 'partly', 'OverlayShape.path (SVG d: corners and curves; no point type)', 'shape-path',
     dict(r=T, exp='native', note='custom paths arrive as editable freeforms (%s shape); point types not read' % SHO)),
 ('images', 'Generate from Image', 'not', None, None, None),
 ('images', 'Reset Background (image)', 'not', None, None, None),
 ('images', 'Image File Info (file name, reveal)', 'not', None, None, None),
 ('object-style', 'Shape, Image and Line Styles preset grids', 'partly', 'ContentPayload.style, OverlayShape.style (none|subtle|moderate|intense)', 'object-styles', None),
 ('object-style', 'Title and Caption checkboxes with position on picture and shape', 'partly', 'ContentPayload.caption (Caption: text, position, align)', 'caption', None),
 ('animation', 'Copy Animation / Paste Animation', 'not', None, None, None),
 ('animation', 'Build In effects (Appear, Blur, Compress, Drift, Drift and Scale, Fade and Scale, Fly In, Keyboard, Shift, Shift and Scale, Wipe)', 'not', None, None, None),
 ('animation', 'Build Out effects (Disappear, Move Out, Blinds, Cube, Pivot, Pop)', 'not', None, None, None),
 ('animation', 'Action effects Jiggle, Pulse', 'not', None, None, None),
 ('transitions', 'Transitions Grid, Switch', 'not', None, None, None),
 ('slides', 'Copy / Paste Guides; Show Slide Layout Guides', 'not', None, None, None),
 ('document', 'Presentation Type delays (Transitions, Builds)', 'not', None, None, None),
 ('app-ui', 'Paste and Preserve Style', 'not', None, None, None),
 ('app-ui', 'Select Parent', 'not', None, None, None),
 ('writing-tools', 'Writing Tools: Make List, Make Table, Create Key Points', 'not', None, None, None),
 ('app-ui', 'View > Show Build Order / Show Colors / Show Content Hub', 'not', None, None, None),
 ('text-format', 'Format > Font > Bigger / Smaller', 'not', None, None, None),
 ('lists', 'Increase / Decrease Indent Level', 'partly', 'ListItem.level, BulletItem.level', 'lists-bullets', None),
 ('tables', 'Autofill Cells and Select submenus', 'not', None, None, None),
 ('export-import', 'Export To > Keynote X; Advanced > Change File Type', 'not', None, None, None),
]

def fix_for(res, spec, desk_fix):
    if res == N:
        return spec.get('fix')  # may describe look findings on a native object
    if spec.get('fix'):
        return spec['fix']
    if desk_fix and desk_fix not in ('None', 'None.') and not desk_fix.startswith('None'):
        return 'untested idea: ' + desk_fix
    return 'none proposed'

def result_fields(spec, desk_exp, desk_fix):
    res = spec['r']
    if res == T:
        de = spec.get('exp') or desk_exp
        ev = 'expected %s (not tested)' % (de.replace('unknown: needs test', 'unknown') if de else 'unknown')
    else:
        ev = spec['ev']
    return dict(keynote_result=res, evidence=ev, findings=[x for x in spec.get('f', []) if x not in ('font', 'C3')],
                fix=fix_for(res, spec, desk_fix), native_mode=spec.get('nm'), note=spec.get('note'))

rows = []
for r in feat:
    i = r['id']; om = omap[i]; mt = match['rows'][i]
    g = {'seen': 'seen in 16.0', 'not found': 'not found in 16.0', 'not walked': 'not walked'}[mt['gui']]
    opf = {'yes': 'has', 'partial': 'partly', 'no': 'not'}[om['opf']]
    row = dict(id=i, area=r['area'], feature=r['feature'], detail=r['detail'],
               gui_path=' > '.join(mt['gui_path']) if mt.get('gui_path') else None,
               gui_path_desk=r.get('where_in_gui') or None, gui=g, gui_note=mt.get('note'),
               opf=opf, opf_keys=om.get('opf_ref'), concept=om['concept'])
    if i in OPF_FIX:
        row['opf_desk'] = opf; row['opf'] = 'not'; row['opf_note'] = OPF_FIX[i]; row['opf_keys'] = None
    if row['opf'] == 'not':
        row.update(keynote_result=None, evidence=None, findings=[], fix=None, native_mode=None, note=None,
                   opf_scope=om.get('scope'))
    else:
        spec = ROW.get(i) or K[om['concept']]
        e = expd.get(i, {})
        row.update(result_fields(spec, e.get('expected_in_keynote'), e.get('fix')))
        row['desk_expected'] = e.get('expected_in_keynote')
    rows.append(row)

for n, (area, name, opf, keys, concept, spec) in enumerate(NEW, 1):
    el = match['missed_by_desk_curated'][n - 1]['element']
    row = dict(id='KN-GUI-%03d' % n, area=area, feature=name, detail=None, gui_path=el, gui_path_desk=None,
               gui='seen in 16.0', gui_note='curated from the 16.0 walk (missed_by_desk_curated)',
               opf=opf, opf_keys=keys, concept=concept)
    if opf == 'not':
        row.update(keynote_result=None, evidence=None, findings=[], fix=None, native_mode=None, note=None)
    else:
        s = spec or K[concept]
        row.update(result_fields(s, None, None))
    rows.append(row)

# ---------------------------------------------------------------------------
cnt = collections.Counter
by_gui = cnt(r['gui'] for r in rows)
by_opf = cnt(r['opf'] for r in rows)
rel = [r for r in rows if r['opf'] != 'not']
by_res = cnt(r['keynote_result'] for r in rel)
by_res_opf = {o: cnt(r['keynote_result'] for r in rel if r['opf'] == o) for o in ('has', 'partly')}
assert len(rows) == 1213 and sum(by_gui.values()) == 1213 and sum(by_res.values()) == len(rel)
meta = dict(built='2026-11-27', by='inventory/final/build_final.py',
            sources=['inventory/keynote-features.json', 'inventory/opf-map.json', 'inventory/expectation.json',
                     'inventory/gui-walk/match.json', TB, 'ui/REPORT.md', 'ui/REPORT-2.md', 'ui/REPORT-3.md',
                     'grades/*/REPORT.md', 'grades/*/objects.json', 'grades/examples/CONSOLIDATED.md'],
            scope='Keynote 16.0 (7052.0.68), OPF 0.36.0 exports; keynote_result is the default export mode unless native_mode says otherwise',
            counts=dict(rows=len(rows), gui=dict(by_gui), opf=dict(by_opf), keynote_result_of_has_or_partly=dict(by_res),
                        by_opf={k: dict(v) for k, v in by_res_opf.items()}, opf_corrected=len(OPF_FIX)),
            result_words={N: 'same Keynote object kind and settings', C: 'still editable in Keynote but different (how in note/evidence)',
                          P: 'a picture of the preview', D: 'not in Keynote', T: 'no measurement in this round'})
json.dump(dict(meta=meta, rows=rows), open(OUT + '/inventory.json', 'w'), indent=1, ensure_ascii=False)

# ---------------------------------------------------------------------------
# gaps.md and summary-for-issue.md
# (label, concepts, short evidence, short fix) for every OPF has/partly row whose result is not native
GROUPS = [
 ('Body text, lists, spacing, body placeholder (a box per line or item)',
  {'text-box', 'lists-bullets', 'lists-numbers', 'line-spacing', 'placeholder-title-body'}, 'C1, C3, LY-02',
  '`--body-text native` in the opt-in route (tested), after #1551, #1552, #1553'),
 ('Picture bullets', {'lists-image-bullets'}, 'EX-04', 'untested: square bullet image'),
 ('Captions and object titles', {'caption'}, 'C3', 'native mode (tested); no carrier for Keynote\'s Caption'),
 ('Text in non-rectangular shapes (becomes a group)', {'text-in-shape'}, 'RT-05, QS-01', 'untested: drop `prstTxWarp` (51 rectangles)'),
 ('Vertical text (rotated box)', {'vertical-text'}, 'Known §8', 'untested: `vert="eaVert"` for CJK'),
 ('Paragraph direction, mixed Hebrew/Latin', {'bidi', 'h-align'}, 'MX-06, RT-07', 'Keynote limit (`rtl` tried)'),
 ('Title shrink-to-fit', {'auto-shrink'}, 'C2, LY-01', '`--typefaces safe` (tested); `normAutofit`: Keynote limit'),
 ('Image description (alt text)', {'image-description'}, 'RT-03, LY-04', 'opt-in: alt in `name` (tested); #1479'),
 ('Shape-masked pictures, image fill', {'image-mask-shape', 'fill-image'}, 'RT §4', 'none needed (looks right)'),
 ('SVG pictures', {'svg-break-apart'}, 'corpus-shapes', 'none (PNG kept)'),
 ('Background picture with opacity', {'background-image'}, 'EX-02', 'untested: pre-blend opacity into the picture'),
 ('Background color with opacity', {'background-solid'}, '#1418, A8', '#1416 item 3 form (tested in the window)'),
 ('Tiled background', {'background-tile'}, 'Known §8', 'untested: opacity baked into a `p:bg` tile'),
 ('Preset shapes and their handles', {'shape-library', 'shape-adjust'}, 'QS-02 to QS-05', 'untested: four presets as freeforms'),
 ('Shadows', {'shadow-drop', 'shadow-contact'}, 'QS-08', 'none tried'),
 ('Path gradients', {'fill-gradient'}, 'QS-06', 'untested: linear or radial approximation'),
 ('Arrowhead sizes', {'arrowheads'}, 'QS-07', 'none tried'),
 ('Curved and elbow connectors', {'curve-corner'}, 'Known §8', 'untested: explicit paths (lose glue)'),
 ('Video, web video (a linked placeholder)', {'video', 'web-video'}, 'RT §4', 'format candidate: embed `p:video`'),
 ('Slide numbers', {'slide-number'}, 'Known §8, QC-04', '`--slide-numbers static` (tested, #1298)'),
 ('Cell data formats (numbers as text)', {'cell-formats'}, 'RT-08', 'Keynote limit (plain numbers tried)'),
 ('Conditional highlighting', {'conditional'}, 'corpus-charts Tables', 'none (no PPTX rule)'),
 ('Table header wrap', {'table-text'}, 'SW-01, MX-08', 'columns 10% wider (tested)'),
 ('Right-to-left table', {'table-rtl'}, 'LG-02', 'visual column order (tested, #1298)'),
 ('Point colors, highlight', {'chart-colors'}, 'MX-03', 'none holds (#1494)'),
 ('Data labels', {'chart-labels'}, 'MX-05, QC-05, QC-07, QC-09', 'Keynote limit; untested: number format'),
 ('Axis scale and gridlines', {'chart-gridlines'}, 'QC-02, QC-08', 'omit `c:majorUnit` (tested)'),
 ('Mixed and two-axis charts', {'chart-mixed'}, 'EX-07, QC-02', 'omit `c:majorUnit` (tested); inner plot area'),
 ('Radar (drawn filled)', {'chart-radar'}, 'Known §8', '`a:noFill` (tested, #1416 item 1)'),
 ('Reference line labels', {'chart-reference-lines'}, 'Known §8', 'label above the plot (tested)'),
 ('Chart title position', {'chart-title'}, 'Known §8', 'none tried'),
 ('Area charts', {'chart-area'}, 'Known §8, QC-05, EX-10', 'gap: Keynote limit'),
 ('Two-series doughnut; pie separator', {'chart-pie'}, 'EX-01, MX-05', 'untested: one doughnut per ring'),
]
used = set()
grows = []
for label, cons, ev, fx in GROUPS:
    rs = [r for r in rel if r['concept'] in cons and r['keynote_result'] in (C, P, D)]
    assert rs, label
    used.update(r['id'] for r in rs)
    res = '/'.join(sorted({r['keynote_result'] for r in rs}))
    grows.append((label, rs, res, ev, fx))
left = [r['id'] for r in rel if r['keynote_result'] in (C, P, D) and r['id'] not in used]
assert not left, left

def ids(rs):
    xs = [r['id'].replace('KN-', '') for r in rs]
    return ', '.join(xs) if len(xs) <= 5 else ', '.join(xs[:4]) + ' +%d' % (len(xs) - 4)

hp, pp = by_res_opf['has'], by_res_opf['partly']
nn = len(rel)
desk_gui_seen = sum(1 for r in rows if r['gui'] == 'seen in 16.0' and not r['id'].startswith('KN-GUI'))
table = '\n'.join('| %s%s | %d | %s | %s |' % (l, '' if res == C else ' (**%s**)' % res, len(rs), ev, fx)
                  for l, rs, res, ev, fx in grows)
G = open(OUT + '/gaps.md.in').read()
G = G.format(total=len(rows), desk=len(feat), new=len(NEW), seen=by_gui['seen in 16.0'], seen_desk=desk_gui_seen,
             notfound=by_gui['not found in 16.0'], notwalked=by_gui['not walked'],
             has=by_opf['has'], partly=by_opf['partly'], nota=by_opf['not'], rel=nn,
             h_n=hp[N], h_c=hp[C], h_p=hp[P], h_d=hp[D], h_t=hp[T], hsum=sum(hp.values()),
             p_n=pp[N], p_c=pp[C], p_p=pp[P], p_d=pp[D], p_t=pp[T], psum=sum(pp.values()),
             a_n=by_res[N], a_c=by_res[C], a_d=by_res[D], a_t=by_res[T],
             nonnative=by_res[C] + by_res[D], ngroups=len(grows), table=table, corr=len(OPF_FIX))
open(OUT + '/gaps.md', 'w').write(G)
S = open(OUT + '/summary-for-issue.md.in').read().format(
    total=len(rows), desk=len(feat), new=len(NEW), seen=by_gui['seen in 16.0'], notfound=by_gui['not found in 16.0'],
    notwalked=by_gui['not walked'], has=by_opf['has'], partly=by_opf['partly'], nota=by_opf['not'], rel=nn,
    a_n=by_res[N], a_c=by_res[C], a_d=by_res[D], a_t=by_res[T], h_n=hp[N], h_c=hp[C], h_d=hp[D], h_t=hp[T], corr=len(OPF_FIX))
open(OUT + '/summary-for-issue.md', 'w').write(S)
print(json.dumps(meta['counts']))
print('gaps.md words:', len(G.split()), ' summary chars:', len(S))
