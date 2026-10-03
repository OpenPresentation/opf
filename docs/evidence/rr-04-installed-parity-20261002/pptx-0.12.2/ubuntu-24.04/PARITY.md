# Preview vs PPTX parity: pptx.gallery values

Generated 2026-10-03T01:00:48.494Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `parity`). No Office was used.

Heads: opf `5e1dda7`, opf-render `3b300a3`, opf-pptx `e4569ac`, pptx-gallery `c349a61`.

## What "perfect" means

For each value, the harness builds the gallery's own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter's stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box. The slide-image picture (`OPF slide image slides.N`, FF-26) maps to the preview slide-image group; its frame is compared as the visible image rect (the frame widened by `a:srcRect`, clipped to the frame).

| check | pass means |
|---|---|
| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, picture and card frames equal the composed box within 0.02 pt; a table frame equals the drawn preview table (the union of its cell rectangles, which can be shorter than the composed box) within 0.02 pt. The crop (`a:srcRect`) of a picture places the image content where the preview `preserveAspectRatio` does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt count as near; a non-finite delta (NaN or infinite geometry, or a crop that leaves no image) fails. |
| text | Same line text (plain runs `a:r` and fields `a:fld`, such as the slide number and date, which carry the rendered value in `a:t`); same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size exactly (within 0.001 pt, the print resolution of the preview: run sizes are whole hundredths of a point, RR-16; it was 0.005 pt before), bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, the chart XML names the preview font, and each text role the preview draws (axis, data labels, legend, title) has the same size in the same role of the chart part (FF-62; not "any size in the part"). |
| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |
| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |
| fontResolution | For every family the selected design uses (owner decision, 2026-09-29; see below): **pass** when the PPTX names the selected family (theme major/minor for the heading/body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table's metric-compatible replacement. **near** when the PPTX names the selected family and the preview draws the policy table's route for it, but only at the visual look-alike tier ("visual-only replacement"; layout not guaranteed). **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table's route (an unexpected host, system or generic fallback), or the PPTX writes a replacement name instead of the selected name. The metric or visual tier is reported per family. Since FF-60 a drawn weight that toPptx writes as Regular or Bold (bold from 600) counts at the tier of the face the export selects, when the preview draws exactly that face (Aptos 500 to Intos Regular, 600 and 800 to Intos Bold); the raw registry tier stays in the legacy definition. Since 2026-09-30 the value must also pass the strict measured render with the registry of the modelled host: a value the host cannot draw (for example `font-shaping-failed`) fails. |
| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |

fontResolution owner decision, 2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if we export to PowerPoint the pptx file should include references to the font they selected and want to see in PowerPoint." Refinement, later the same day (verbatim): "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it's named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG. When we export to PPTX we should have PowerPoint open that file and display actual Aptos." So a look-alike is intended, the PPTX must keep the selected name, and the target look-alike is metric-compatible; a visual-only look-alike is policy-conformant but reported as near. Before this decision the check passed only for the real face or a metric-compatible substitute; that old definition is computed from the same run (`results[].legacy`) and compared below.

Modelled preview font host: the pptx.gallery editor (font-host.mjs). Its browser registry is built from the eager faces of the office pack with `substitutionPolicy:"visual"` and `fallbackFamily:"Roboto"`, and its font gate (opf-editor `createFontGate`) runs `ensureLazyFonts(document)` and `ensureScripts(document)` before the document is rendered, which loads the vendored preview faces (Intos, the open pack) and the script (Noto) faces that the text and font schemes of the value need. The same calls run here against the same package files (Font Loading API and fetch stood in for), one registry per distinct load. A family the loaded registry does not serve, or serves only through the generic fallback, fails fontResolution; so does a value whose strict measured render with that registry throws. This models the browser host in Node; no browser draws anything.
Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.

## Per-dimension counts

| dimension | n | perfect | near | mismatch | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 0 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| font-schemes | 89 | 35 | 54 | 0 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 35/89 (+54 near) | 89/89 | 89/89 |
| font-schemes-legacy | 4 | 3 | 1 | 0 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 3/4 (+1 near) | 4/4 | 4/4 |
| languages | 93 | 66 | 27 | 0 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 66/93 (+27 near) | 93/93 | 93/93 |
| themes | 4 | 1 | 3 | 0 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 1/4 (+3 near) | 4/4 | 4/4 |
| narratives | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| audiences | 14 | 14 | 0 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| tones | 7 | 7 | 0 | 0 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| socials | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| backgrounds | 6 | 6 | 0 | 0 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| backgrounds (withAssets) | 6 | 6 | 0 | 0 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| image-treatments | 15 | 15 | 0 | 0 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 |
| image-treatments (withAssets) | 15 | 15 | 0 | 0 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 |
| headers-footers | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| headers-footers (withAssets) | 10 | 10 | 0 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| blocks | 32 | 24 | 8 | 0 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 24/32 (+8 near) | 32/32 | 32/32 |
| layouts | 485 | 485 | 0 | 0 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 |
| charts | 26 | 10 | 16 | 0 | 26/26 | 11/26 | 26/26 | 26/26 | 26/26 | 26/26 | 25/26 | 26/26 | 26/26 | 26/26 |
| **all** | 850 | 741 | 109 | 0 | 850/850 | 835/850 | 850/850 | 850/850 | 850/850 | 850/850 | 849/850 | 757/850 (+93 near) | 850/850 | 850/850 |

The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.

Picture crop-position check: 425 of 425 pictures measured; 0 unmeasured (preview image size unknown, reported as near).

## fontResolution definition change (owner decision 2026-09-29): old vs new, same run

Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.

| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 0 | 0 |
| font-schemes | 89 | 34 | 35 | 0 | 54 | 55 | 0 | 34 | 35 | 54 | 0 |
| font-schemes-legacy | 4 | 2 | 3 | 0 | 1 | 2 | 0 | 2 | 3 | 1 | 0 |
| languages | 93 | 66 | 66 | 0 | 27 | 27 | 0 | 66 | 66 | 27 | 0 |
| themes | 4 | 1 | 1 | 0 | 3 | 3 | 0 | 1 | 1 | 3 | 0 |
| narratives | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| audiences | 14 | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 0 | 0 |
| tones | 7 | 7 | 7 | 0 | 0 | 0 | 0 | 7 | 7 | 0 | 0 |
| socials | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| backgrounds | 6 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | 0 | 0 |
| backgrounds (withAssets) | 6 | 6 | 6 | 0 | 0 | 0 | 0 | 6 | 6 | 0 | 0 |
| image-treatments | 15 | 15 | 15 | 0 | 0 | 0 | 0 | 15 | 15 | 0 | 0 |
| image-treatments (withAssets) | 15 | 15 | 15 | 0 | 0 | 0 | 0 | 15 | 15 | 0 | 0 |
| headers-footers | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| headers-footers (withAssets) | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 |
| blocks | 32 | 19 | 24 | 0 | 8 | 13 | 0 | 19 | 24 | 8 | 0 |
| layouts | 485 | 438 | 485 | 0 | 0 | 47 | 0 | 438 | 485 | 0 | 0 |
| charts | 26 | 10 | 10 | 16 | 16 | 0 | 0 | 26 | 26 | 0 | 0 |
| **all** | 850 | 687 | 741 | 16 | 109 | 147 | 0 | 703 | 757 | 93 | 0 |

| check (all values, pass count) | old definition | new definition |
|---|---|---|
| geometry | 850 | 850 |
| text | 835 | 835 |
| fills | 850 | 850 |
| zOrder | 850 | 850 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 849 | 849 |
| fontResolution | 703 | 757 |
| theme | 850 | 850 |
| mapping | 850 | 850 |

### Selected families with only a visual-only replacement (near)

These 63 selected families render in the preview with a policy-table look-alike that is not metric-compatible (63 with the table's listed replacement, 0 with a listed alternate). Each needs a metric-compatible open replacement, or a supplied real face, to pass. "values" is the number of the 850 values that select the family.

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Segoe UI | Red Hat Display | proprietary-standard | replacement | 7 |
| Segoe UI Semibold | Red Hat Display | proprietary-standard | replacement | 7 |
| Grandview | Barlow | proprietary-standard | replacement | 5 |
| Arabic Typesetting | Noto Naskh Arabic | proprietary-standard | replacement | 4 |
| Mangal | Noto Sans Devanagari | proprietary-standard | replacement | 4 |
| Arial Black | Montserrat | proprietary-standard | replacement | 3 |
| Grandview Display | Barlow | proprietary-standard | replacement | 3 |
| Sylfaen | Noto Sans | proprietary-standard | replacement | 3 |
| Angsana New | Noto Sans Thai | proprietary-standard | replacement | 2 |
| DaunPenh | Noto Sans Khmer | proprietary-standard | replacement | 2 |
| David | Noto Serif Hebrew | proprietary-standard | replacement | 2 |
| Gautami | Noto Sans Telugu | proprietary-standard | replacement | 2 |
| Impact | Anton | proprietary-standard | replacement | 2 |
| Kalinga | Noto Sans Oriya | proprietary-standard | replacement | 2 |
| Kartika | Noto Sans Malayalam | proprietary-standard | replacement | 2 |
| Latha | Noto Sans Tamil | proprietary-standard | replacement | 2 |
| Malgun Gothic | Noto Sans KR | proprietary-standard | replacement | 2 |
| Meiryo | Noto Sans JP | proprietary-standard | replacement | 2 |
| Microsoft JhengHei | Noto Sans TC | proprietary-standard | replacement | 2 |
| Microsoft YaHei | Noto Sans SC | proprietary-standard | replacement | 2 |
| Nyala | Noto Sans Ethiopic | proprietary-standard | replacement | 2 |
| Raavi | Noto Sans Gurmukhi | proprietary-standard | replacement | 2 |
| Seaford | Source Sans 3 | proprietary-standard | replacement | 2 |
| Seaford Display | Source Sans 3 | proprietary-standard | replacement | 2 |
| Shonar Bangla | Noto Sans Bengali | proprietary-standard | replacement | 2 |
| Shruti | Noto Sans Gujarati | proprietary-standard | replacement | 2 |
| Tenorite | Figtree | proprietary-standard | replacement | 2 |
| Tenorite Display | Figtree | proprietary-standard | replacement | 2 |
| Tunga | Noto Sans Kannada | proprietary-standard | replacement | 2 |
| Vrinda | Noto Sans Bengali | proprietary-standard | replacement | 2 |
| Aparajita | Noto Sans Devanagari | proprietary-standard | replacement | 1 |
| Batang | Noto Sans KR | proprietary-standard | replacement | 1 |
| BatangChe | Noto Sans KR | proprietary-standard | replacement | 1 |
| Bookman Old Style | Libre Caslon Text | proprietary-standard | replacement | 1 |
| Century Schoolbook | Gelasio | proprietary-standard | replacement | 1 |
| Consolas | Cousine | proprietary-standard | replacement | 1 |
| Constantia | PT Serif | proprietary-standard | replacement | 1 |
| DilleniaUPC | Noto Sans Thai | proprietary-standard | replacement | 1 |
| FangSong | Noto Sans SC | proprietary-standard | replacement | 1 |
| Garamond | EB Garamond | proprietary-standard | replacement | 1 |
| Gisha | Noto Sans Hebrew | proprietary-standard | replacement | 1 |
| Gungsuh | Noto Sans KR | proprietary-standard | replacement | 1 |
| GungsuhChe | Noto Sans KR | proprietary-standard | replacement | 1 |
| Khmer UI | Noto Sans Khmer | proprietary-standard | replacement | 1 |
| Lucida Sans | Work Sans | proprietary-standard | replacement | 1 |
| MingLiU | Noto Sans TC | proprietary-standard | replacement | 1 |
| Miriam | Noto Sans Hebrew | proprietary-standard | replacement | 1 |
| MS Mincho | Noto Sans JP | proprietary-standard | replacement | 1 |
| Nirmala UI | Noto Sans Devanagari | proprietary-standard | replacement | 1 |
| PMingLiU | Noto Sans TC | proprietary-standard | replacement | 1 |
| Rockwell | Bitter | proprietary-standard | replacement | 1 |
| Sakkal Majalla | Noto Naskh Arabic | proprietary-standard | replacement | 1 |
| Segoe UI Light | Red Hat Display | proprietary-standard | replacement | 1 |
| Segoe UI Semilight | Red Hat Display | proprietary-standard | replacement | 1 |
| SimSun | Noto Sans SC | proprietary-standard | replacement | 1 |
| Skeena | Open Sans | proprietary-standard | replacement | 1 |
| Skeena Display | Open Sans | proprietary-standard | replacement | 1 |
| Source Sans Pro | Source Sans 3 | open | replacement | 1 |
| Tahoma | Red Hat Text | proprietary-standard | replacement | 1 |
| Traditional Arabic | Noto Naskh Arabic | proprietary-standard | replacement | 1 |
| Trebuchet MS | Figtree | proprietary-standard | replacement | 1 |
| Verdana | Montserrat | proprietary-standard | replacement | 1 |
| Yu Gothic | Noto Sans JP | proprietary-standard | replacement | 1 |

### Selected families that pass

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Roboto Mono | Roboto Mono | open | real | 848 |
| Aptos | Intos | proprietary-standard | replacement | 704 |
| Aptos Display | Intos Display | proprietary-standard | replacement | 704 |
| Open Sans | Open Sans | open | real | 7 |
| Georgia | Gelasio | proprietary-standard | replacement | 6 |
| Montserrat | Montserrat | open | real | 5 |
| Arial | Arimo | proprietary-standard | replacement | 3 |
| Poppins | Poppins | open | real | 3 |
| Roboto | Roboto | open | real | 3 |
| Noto Naskh Arabic | Noto Naskh Arabic | open | real | 2 |
| Bebas Neue | Bebas Neue | open | real | 1 |
| Calibri | Carlito | proprietary-standard | replacement | 1 |
| Courier New | Cousine | proprietary-standard | replacement | 1 |
| Lora | Lora | open | real | 1 |
| Merriweather Sans | Merriweather Sans | open | real | 1 |
| Noto Nastaliq Urdu | Noto Nastaliq Urdu | open | real | 1 |
| Noto Sans | Noto Sans | open | real | 1 |
| Noto Sans Armenian | Noto Sans Armenian | open | real | 1 |
| Noto Sans Bengali | Noto Sans Bengali | open | real | 1 |
| Noto Sans Devanagari | Noto Sans Devanagari | open | real | 1 |
| Noto Sans Ethiopic | Noto Sans Ethiopic | open | real | 1 |
| Noto Sans Georgian | Noto Sans Georgian | open | real | 1 |
| Noto Sans Gujarati | Noto Sans Gujarati | open | real | 1 |
| Noto Sans Gurmukhi | Noto Sans Gurmukhi | open | real | 1 |
| Noto Sans Hebrew | Noto Sans Hebrew | open | real | 1 |
| Noto Sans JP | Noto Sans JP | open | real | 1 |
| Noto Sans Kannada | Noto Sans Kannada | open | real | 1 |
| Noto Sans Khmer | Noto Sans Khmer | open | real | 1 |
| Noto Sans KR | Noto Sans KR | open | real | 1 |
| Noto Sans Malayalam | Noto Sans Malayalam | open | real | 1 |
| Noto Sans Mongolian | Noto Sans Mongolian | open | real | 1 |
| Noto Sans Oriya | Noto Sans Oriya | open | real | 1 |
| Noto Sans SC | Noto Sans SC | open | real | 1 |
| Noto Sans Tamil | Noto Sans Tamil | open | real | 1 |
| Noto Sans TC | Noto Sans TC | open | real | 1 |
| Noto Sans Telugu | Noto Sans Telugu | open | real | 1 |
| Noto Sans Thai | Noto Sans Thai | open | real | 1 |
| Playfair Display | Playfair Display | open | real | 1 |
| PT Serif | PT Serif | open | real | 1 |
| Raleway | Raleway | open | real | 1 |
| Times New Roman | Tinos | proprietary-standard | replacement | 1 |

### fontResolution failures (new definition)

0 selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):

| reason kind | family-value failures |
|---|---|

| failing family | license class | policy route | values | reason |
|---|---|---|---|---|

## Top mismatch reasons per dimension

- **color-schemes** (14): none
- **font-schemes** (89): none
- **font-schemes-legacy** (4): none
- **languages** (93): none
- **themes** (4): none
- **narratives** (10): none
- **audiences** (14): none
- **tones** (7): none
- **socials** (10): none
- **backgrounds** (6): none
- **backgrounds (withAssets)** (6): none
- **image-treatments** (15): none
- **image-treatments (withAssets)** (15): none
- **headers-footers** (10): none
- **headers-footers (withAssets)** (10): none
- **blocks** (32): none
- **layouts** (485): none
- **charts** (26): none

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| text \| chart label wrapped/split in preview (native chart lays out its own labels) | 15 | charts/column [slides.0.chart] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI Semibold): Segoe UI Semibold -> Red Hat Display | 7 | font-schemes/segoe-ui [Segoe UI Semibold] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI): Segoe UI -> Red Hat Display | 7 | font-schemes/segoe-ui [Segoe UI] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Grandview): Grandview -> Barlow | 5 | font-schemes/impact [Grandview] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Mangal): Mangal -> Noto Sans Devanagari | 4 | font-schemes/mangal [Mangal] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Arabic Typesetting): Arabic Typesetting -> Noto Naskh Arabic | 4 | font-schemes/arabic-typesetting [Arabic Typesetting] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Arial Black): Arial Black -> Montserrat | 3 | font-schemes/arial [Arial Black] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Grandview Display): Grandview Display -> Barlow | 3 | font-schemes/grandview [Grandview Display] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Sylfaen): Sylfaen -> Noto Sans | 3 | font-schemes/sylfaen [Sylfaen] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Impact): Impact -> Anton | 2 | font-schemes/impact [Impact] |

## Preview font resolution (registry status, the old-definition view)

Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render. This is the registry status the old definition gated on; the verdict under the new definition is in the section above.

| status | families | values affected | families (values) |
|---|---|---|---|
| real | 32 | 848 | Roboto Mono (848), Open Sans (7), Montserrat (5), Poppins (3), Roboto (3), Noto Naskh Arabic (2), PT Serif (1), Raleway (1), Noto Sans Armenian (1), Noto Sans Bengali (1), Noto Sans Devanagari (1), Noto Sans Georgian (1), Noto Sans Gujarati (1), Noto Sans Gurmukhi (1), Noto Sans Hebrew (1), Noto Sans JP (1), Noto Sans Kannada (1), Noto Sans KR (1), Noto Sans Malayalam (1), Noto Sans Oriya (1), Noto Sans SC (1), Noto Sans Tamil (1), Noto Sans TC (1), Noto Sans Telugu (1), Noto Sans (1), Noto Sans Thai (1), Noto Nastaliq Urdu (1), Noto Sans Ethiopic (1), Noto Sans Khmer (1), Playfair Display (1), Lora (1), Merriweather Sans (1) |
| metric-substitute | 7 | 672 | Aptos Display→Intos Display (704), Aptos→Intos (704), Georgia→Gelasio (6), Arial→Arimo (3), Courier New→Cousine (1), Calibri→Carlito (1), Times New Roman→Tinos (1) |
| visual-substitute | 65 | 147 | Segoe UI Semibold→Red Hat Display (7), Segoe UI→Red Hat Display (7), Grandview→Barlow (5), Mangal→Noto Sans Devanagari (4), Arabic Typesetting→Noto Naskh Arabic (4), Arial Black→Montserrat (3), Grandview Display→Barlow (3), Sylfaen→Noto Sans (3), Impact→Anton (2), Seaford Display→Source Sans 3 (2), Seaford→Source Sans 3 (2), Tenorite Display→Figtree (2), Tenorite→Figtree (2), Microsoft YaHei→Noto Sans SC (2), Malgun Gothic→Noto Sans KR (2), Latha→Noto Sans Tamil (2), David→Noto Serif Hebrew (2), Vrinda→Noto Sans Bengali (2), Shruti→Noto Sans Gujarati (2), Tunga→Noto Sans Kannada (2), Kartika→Noto Sans Malayalam (2), Kalinga→Noto Sans Oriya (2), Raavi→Noto Sans Gurmukhi (2), Gautami→Noto Sans Telugu (2), Microsoft JhengHei→Noto Sans TC (2), Meiryo→Noto Sans JP (2), Angsana New→Noto Sans Thai (2), Shonar Bangla→Noto Sans Bengali (2), Nyala→Noto Sans Ethiopic (2), DaunPenh→Noto Sans Khmer (2), Consolas→Cousine (1), Lucida Sans→Work Sans (1), Segoe UI Semilight→Red Hat Display (1), Segoe UI Light→Red Hat Display (1), Tahoma→Red Hat Text (1), Trebuchet MS→Figtree (1), Verdana→Montserrat (1), Bookman Old Style→Libre Caslon Text (1), Century Schoolbook→Gelasio (1), Constantia→PT Serif (1), … |
| missing | 0 | 0 |  |

703/850 values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).

## Package typeface inventory

Foreign `typeface=` values are those not used by the preview; they are listed by part, with the number of values affected:


Theme per-script supplements (`<a:font script=…>`) are listed separately and not gated: 52 distinct faces (游ゴシック Light, 맑은 고딕, 等线 Light, 新細明體, Times New Roman, Angsana New, Nyala, Vrinda, Shruti, MoolBoran, Tunga, Raavi, …).

## Re-running

```powershell
dimension-audit\parity\run.ps1                          # current worktrees -> parity-results.json + PARITY.md
dimension-audit\parity\run.ps1 -Update                  # move sources\parity-* to origin/main, rebuild, rerun
dimension-audit\parity\build.ps1 -Prefix pr123; dimension-audit\parity\run.ps1 -Prefix pr123 -Baseline dimension-audit\parity\parity-results.json -Out dimension-audit\parity\out\pr123.json
```

For a fix PR, create `sources\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.
