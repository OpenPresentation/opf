# Preview vs PPTX parity: pptx.gallery values

Generated 2026-09-29T19:37:51.028Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `base`). No Office was used.

Heads: opf `b1fdfa7`, opf-render `762dbb9`, opf-pptx `874d9e9`, pptx-gallery `5963702`.

## What "perfect" means

For each value, the harness builds the gallery's own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter's stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box. The slide-image picture (`OPF slide image slides.N`, FF-26) maps to the preview slide-image group; its frame is compared as the visible image rect (the frame widened by `a:srcRect`, clipped to the frame).

| check | pass means |
|---|---|
| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, picture and card frames equal the composed box within 0.02 pt; a table frame equals the drawn preview table (the union of its cell rectangles, which can be shorter than the composed box) within 0.02 pt. The crop (`a:srcRect`) of a picture places the image content where the preview `preserveAspectRatio` does, within 0.02 pt at the visible edges. Deltas up to 0.5 pt count as near; a non-finite delta (NaN or infinite geometry, or a crop that leaves no image) fails. |
| text | Same line text (plain runs `a:r` and fields `a:fld`, such as the slide number and date, which carry the rendered value in `a:t`); same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size within 0.005 pt, bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, and the chart XML names the preview font. |
| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |
| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |
| fontResolution | For every family the selected design uses (owner decision, 2026-09-29; see below): **pass** when the PPTX names the selected family (theme major/minor for the heading/body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table's metric-compatible replacement. **near** when the PPTX names the selected family and the preview draws the policy table's route for it, but only at the visual look-alike tier ("visual-only replacement"; layout not guaranteed). **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table's route (an unexpected host, system or generic fallback), or the PPTX writes a replacement name instead of the selected name. The metric or visual tier is reported per family. |
| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |

fontResolution owner decision, 2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if we export to PowerPoint the pptx file should include references to the font they selected and want to see in PowerPoint." Refinement, later the same day (verbatim): "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it's named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG. When we export to PPTX we should have PowerPoint open that file and display actual Aptos." So a look-alike is intended, the PPTX must keep the selected name, and the target look-alike is metric-compatible; a visual-only look-alike is policy-conformant but reported as near. Before this decision the check passed only for the real face or a metric-compatible substitute; that old definition is computed from the same run (`results[].legacy`) and compared below.

Modelled preview font host: the office pack with `substitutionPolicy:"visual"` and no `scripts` (Noto script) pack. The shipped previews load the same: the opf-editor playground bundle that pptx.gallery embeds builds its registry with `loadOfficeFontRegistry()` and no `scripts`, the gallery layout thumbnails use no registry, and opf-render never loads the script pack by itself (a host must pass `scripts`, for example from `detectScripts(presentation)`; no shipped host does). A family that only the script pack serves therefore fails fontResolution with "preview has no face", which is a product gap, not an instrument error.

Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.

## Per-dimension counts

| dimension | n | perfect | near | mismatch | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 0 | 14 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 0/14 (+14 near) | 14/14 | 14/14 |
| font-schemes | 89 | 4 | 20 | 65 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 4/89 (+20 near) | 89/89 | 89/89 |
| font-schemes-legacy | 4 | 0 | 0 | 4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0/4 | 4/4 | 4/4 |
| languages | 93 | 0 | 68 | 25 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 0/93 (+68 near) | 93/93 | 93/93 |
| themes | 4 | 0 | 4 | 0 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0/4 (+4 near) | 4/4 | 4/4 |
| narratives | 10 | 0 | 10 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 0/10 (+10 near) | 10/10 | 10/10 |
| audiences | 14 | 0 | 14 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 0/14 (+14 near) | 14/14 | 14/14 |
| tones | 7 | 0 | 7 | 0 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 0/7 (+7 near) | 7/7 | 7/7 |
| socials | 10 | 0 | 10 | 0 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 0/10 (+10 near) | 10/10 | 10/10 |
| backgrounds | 6 | 0 | 5 | 1 | 6/6 | 6/6 | 5/6 | 6/6 | 6/6 | 6/6 | 5/6 | 0/6 (+6 near) | 6/6 | 6/6 |
| backgrounds (withAssets) | 6 | 0 | 6 | 0 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 (+6 near) | 6/6 | 6/6 |
| image-treatments | 15 | 0 | 0 | 15 | 15/15 | 0/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 0/15 (+15 near) | 15/15 | 15/15 |
| image-treatments (withAssets) | 15 | 0 | 15 | 0 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 0/15 (+15 near) | 15/15 | 15/15 |
| headers-footers | 10 | 0 | 0 | 10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 (+10 near) | 10/10 | 10/10 |
| headers-footers (withAssets) | 10 | 0 | 0 | 10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 (+10 near) | 10/10 | 10/10 |
| blocks | 32 | 1 | 18 | 13 | 32/32 | 29/32 | 30/32 | 32/32 | 32/32 | 32/32 | 32/32 | 1/32 (+21 near) | 32/32 | 32/32 |
| layouts | 485 | 0 | 436 | 49 | 485/485 | 473/485 | 446/485 | 485/485 | 485/485 | 485/485 | 485/485 | 0/485 (+485 near) | 485/485 | 475/485 |
| charts | 26 | 0 | 0 | 26 | 26/26 | 11/26 | 0/26 | 26/26 | 26/26 | 26/26 | 26/26 | 0/26 (+26 near) | 26/26 | 26/26 |
| **all** | 850 | 5 | 627 | 218 | 850/850 | 805/850 | 782/850 | 830/850 | 850/850 | 850/850 | 849/850 | 5/850 (+741 near) | 850/850 | 840/850 |

The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.

Picture crop-position check: 408 of 408 pictures measured; 0 unmeasured (preview image size unknown, reported as near).

## Before / after

Baseline heads: opf `b1fdfa7`, opf-render `762dbb9`, opf-pptx `874d9e9`, pptx-gallery `5963702`.

| dimension | perfect before | perfect after | near before | near after | improved | regressed |
|---|---|---|---|---|---|---|
| color-schemes | 0 | 0 | 0 | 14 | 14 | 0 |
| font-schemes | 4 | 4 | 20 | 20 | 0 | 0 |
| font-schemes-legacy | 0 | 0 | 0 | 0 | 0 | 0 |
| languages | 0 | 0 | 68 | 68 | 0 | 0 |
| themes | 0 | 0 | 4 | 4 | 0 | 0 |
| narratives | 0 | 0 | 10 | 10 | 0 | 0 |
| audiences | 0 | 0 | 14 | 14 | 0 | 0 |
| tones | 0 | 0 | 7 | 7 | 0 | 0 |
| socials | 0 | 0 | 10 | 10 | 0 | 0 |
| backgrounds | 0 | 0 | 5 | 5 | 0 | 0 |
| backgrounds (withAssets) | 0 | 0 | 6 | 6 | 0 | 0 |
| image-treatments | 0 | 0 | 0 | 0 | 0 | 0 |
| image-treatments (withAssets) | 0 | 0 | 15 | 15 | 0 | 0 |
| headers-footers | 0 | 0 | 0 | 0 | 0 | 0 |
| headers-footers (withAssets) | 0 | 0 | 0 | 0 | 0 | 0 |
| blocks | 1 | 1 | 17 | 18 | 1 | 0 |
| layouts | 0 | 0 | 432 | 436 | 4 | 0 |
| charts | 0 | 0 | 0 | 0 | 0 | 0 |
| **all** | 5 | 5 | 608 | 627 | 19 | 0 |
### Checks passed, before and after (all values)

Baseline: the results file passed as the baseline (a run at the same heads when the two head lists match, so the difference is the harness). Each cell is the number of values that pass the check.

| check | before | after |
|---|---|---|
| geometry | 830 | 850 |
| text | 805 | 805 |
| fills | 782 | 782 |
| zOrder | 830 | 830 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 849 | 849 |
| fontResolution | 5 | 5 |
| theme | 850 | 850 |
| mapping | 840 | 840 |
| values | 850 | 850 |

## fontResolution definition change (owner decision 2026-09-29): old vs new, same run

Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.

| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 0 | 0 | 0 | 14 | 14 | 0 | 0 | 0 | 14 | 0 |
| font-schemes | 89 | 4 | 4 | 0 | 20 | 85 | 65 | 4 | 4 | 20 | 65 |
| font-schemes-legacy | 4 | 0 | 0 | 0 | 0 | 4 | 4 | 0 | 0 | 0 | 4 |
| languages | 93 | 0 | 0 | 0 | 68 | 93 | 25 | 0 | 0 | 68 | 25 |
| themes | 4 | 0 | 0 | 0 | 4 | 4 | 0 | 0 | 0 | 4 | 0 |
| narratives | 10 | 0 | 0 | 0 | 10 | 10 | 0 | 0 | 0 | 10 | 0 |
| audiences | 14 | 0 | 0 | 0 | 14 | 14 | 0 | 0 | 0 | 14 | 0 |
| tones | 7 | 0 | 0 | 0 | 7 | 7 | 0 | 0 | 0 | 7 | 0 |
| socials | 10 | 0 | 0 | 0 | 10 | 10 | 0 | 0 | 0 | 10 | 0 |
| backgrounds | 6 | 0 | 0 | 0 | 5 | 6 | 1 | 0 | 0 | 6 | 0 |
| backgrounds (withAssets) | 6 | 0 | 0 | 0 | 6 | 6 | 0 | 0 | 0 | 6 | 0 |
| image-treatments | 15 | 0 | 0 | 0 | 0 | 15 | 15 | 0 | 0 | 15 | 0 |
| image-treatments (withAssets) | 15 | 0 | 0 | 0 | 15 | 15 | 0 | 0 | 0 | 15 | 0 |
| headers-footers | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 | 10 | 0 |
| headers-footers (withAssets) | 10 | 0 | 0 | 0 | 0 | 10 | 10 | 0 | 0 | 10 | 0 |
| blocks | 32 | 1 | 1 | 0 | 18 | 31 | 13 | 1 | 1 | 21 | 10 |
| layouts | 485 | 0 | 0 | 0 | 436 | 485 | 49 | 0 | 0 | 485 | 0 |
| charts | 26 | 0 | 0 | 0 | 0 | 26 | 26 | 0 | 0 | 26 | 0 |
| **all** | 850 | 5 | 5 | 0 | 627 | 845 | 218 | 5 | 5 | 741 | 104 |

| check (all values, pass count) | old definition | new definition |
|---|---|---|
| geometry | 850 | 850 |
| text | 805 | 805 |
| fills | 782 | 782 |
| zOrder | 830 | 830 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 849 | 849 |
| fontResolution | 5 | 5 |
| theme | 850 | 850 |
| mapping | 840 | 840 |

### Selected families with only a visual-only replacement (near)

These 27 selected families render in the preview with a policy-table look-alike that is not metric-compatible (5 with the table's listed replacement, 22 with a listed alternate). Each needs a metric-compatible open replacement, or a supplied real face, to pass. "values" is the number of the 850 values that select the family.

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Aptos | Roboto | proprietary-standard | replacement | 704 |
| Aptos Display | Carlito | proprietary-standard | replacement | 704 |
| Segoe UI | Arimo | proprietary-standard | alternate | 7 |
| Segoe UI Semibold | Roboto SemiBold | proprietary-standard | alternate | 7 |
| Georgia | Gelasio | proprietary-standard | replacement | 6 |
| Grandview | Roboto | proprietary-standard | alternate | 5 |
| Arial Black | Arimo | proprietary-standard | alternate | 3 |
| Grandview Display | Roboto | proprietary-standard | alternate | 3 |
| Impact | Carlito | proprietary-standard | alternate | 2 |
| Seaford | Carlito | proprietary-standard | alternate | 2 |
| Seaford Display | Carlito | proprietary-standard | alternate | 2 |
| Tenorite | Roboto | proprietary-standard | alternate | 2 |
| Tenorite Display | Roboto | proprietary-standard | alternate | 2 |
| Bookman Old Style | Gelasio | proprietary-standard | alternate | 1 |
| Century Schoolbook | Gelasio | proprietary-standard | replacement | 1 |
| Consolas | Cousine | proprietary-standard | replacement | 1 |
| Constantia | Caladea | proprietary-standard | alternate | 1 |
| Garamond | Tinos | proprietary-standard | alternate | 1 |
| Lucida Sans | Arimo | proprietary-standard | alternate | 1 |
| Rockwell | Gelasio | proprietary-standard | alternate | 1 |
| Segoe UI Light | Carlito | proprietary-standard | alternate | 1 |
| Segoe UI Semilight | Roboto | proprietary-standard | alternate | 1 |
| Skeena | Carlito | proprietary-standard | alternate | 1 |
| Skeena Display | Carlito | proprietary-standard | alternate | 1 |
| Tahoma | Arimo | proprietary-standard | alternate | 1 |
| Trebuchet MS | Arimo | proprietary-standard | alternate | 1 |
| Verdana | Arimo | proprietary-standard | alternate | 1 |

### Selected families that pass

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Roboto Mono | Roboto Mono | open | real | 848 |
| Arial | Arimo | proprietary-standard | replacement | 3 |
| Roboto | Roboto | open | real | 3 |
| Calibri | Carlito | proprietary-standard | replacement | 1 |
| Courier New | Cousine | proprietary-standard | replacement | 1 |
| Times New Roman | Tinos | proprietary-standard | replacement | 1 |

### fontResolution failures (new definition)

71 selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):

| reason kind | family-value failures |
|---|---|
| preview has no face for | 64 |
| preview has no face for open family | 45 |

| failing family | license class | policy route | values | reason |
|---|---|---|---|---|
| Open Sans | open | not loaded in preview | 7 | preview has no face for open family Open Sans |
| Montserrat | open | not loaded in preview | 5 | preview has no face for open family Montserrat |
| Arabic Typesetting | proprietary-standard | not loaded in preview | 4 | preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview |
| Mangal | proprietary-standard | not loaded in preview | 4 | preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview |
| Poppins | open | not loaded in preview | 3 | preview has no face for open family Poppins |
| Sylfaen | proprietary-standard | not loaded in preview | 3 | preview has no face for Sylfaen; policy route Noto Sans \| Noto Sans Georgian \| Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview |
| Angsana New | proprietary-standard | not loaded in preview | 2 | preview has no face for Angsana New; policy route Noto Sans Thai is not loaded; bundled in the scripts pack, not loaded in this preview |
| DaunPenh | proprietary-standard | not loaded in preview | 2 | preview has no face for DaunPenh; policy route Noto Sans Khmer is not loaded; bundled in the scripts pack, not loaded in this preview |
| David | proprietary-standard | not loaded in preview | 2 | preview has no face for David; policy route Noto Serif Hebrew \| Noto Sans Hebrew is not loaded; bundled in the scripts pack, not loaded in this preview |
| Gautami | proprietary-standard | not loaded in preview | 2 | preview has no face for Gautami; policy route Noto Sans Telugu is not loaded; bundled in the scripts pack, not loaded in this preview |
| Kalinga | proprietary-standard | not loaded in preview | 2 | preview has no face for Kalinga; policy route Noto Sans Oriya is not loaded; bundled in the scripts pack, not loaded in this preview |
| Kartika | proprietary-standard | not loaded in preview | 2 | preview has no face for Kartika; policy route Noto Sans Malayalam is not loaded; bundled in the scripts pack, not loaded in this preview |
| Latha | proprietary-standard | not loaded in preview | 2 | preview has no face for Latha; policy route Noto Sans Tamil is not loaded; bundled in the scripts pack, not loaded in this preview |
| Malgun Gothic | proprietary-standard | not loaded in preview | 2 | preview has no face for Malgun Gothic; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview |
| Meiryo | proprietary-standard | not loaded in preview | 2 | preview has no face for Meiryo; policy route Noto Sans JP is not loaded; bundled in the scripts pack, not loaded in this preview |
| Microsoft JhengHei | proprietary-standard | not loaded in preview | 2 | preview has no face for Microsoft JhengHei; policy route Noto Sans TC is not loaded; bundled in the scripts pack, not loaded in this preview |
| Microsoft YaHei | proprietary-standard | not loaded in preview | 2 | preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview |
| Noto Naskh Arabic | open | not loaded in preview | 2 | preview has no face for open family Noto Naskh Arabic; bundled in the scripts pack, not loaded in this preview |
| Nyala | proprietary-standard | not loaded in preview | 2 | preview has no face for Nyala; policy route Noto Sans Ethiopic is not loaded; bundled in the scripts pack, not loaded in this preview |
| Raavi | proprietary-standard | not loaded in preview | 2 | preview has no face for Raavi; policy route Noto Sans Gurmukhi is not loaded; bundled in the scripts pack, not loaded in this preview |
| Shonar Bangla | proprietary-standard | not loaded in preview | 2 | preview has no face for Shonar Bangla; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview |
| Shruti | proprietary-standard | not loaded in preview | 2 | preview has no face for Shruti; policy route Noto Sans Gujarati is not loaded; bundled in the scripts pack, not loaded in this preview |
| Tunga | proprietary-standard | not loaded in preview | 2 | preview has no face for Tunga; policy route Noto Sans Kannada is not loaded; bundled in the scripts pack, not loaded in this preview |
| Vrinda | proprietary-standard | not loaded in preview | 2 | preview has no face for Vrinda; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview |
| Aparajita | proprietary-standard | not loaded in preview | 1 | preview has no face for Aparajita; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview |

… and 46 more failing families (one value each unless listed above); the full per-family verdicts are in the results file under results[].fontResolution.

## Top mismatch reasons per dimension

- **color-schemes** (14): none
- **font-schemes** (89): fontResolution | preview has no face for open family Noto Naskh Arabic; bundled in the scripts pack, not loaded in this preview (2); fontResolution | preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for SimSun; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for FangSong; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for Yu Gothic; policy route Noto Sans JP is not loaded; bundled in the scripts pack, not loaded in this preview (1)
- **font-schemes-legacy** (4): fontResolution | preview has no face for open family Playfair Display (1); fontResolution | preview has no face for Source Sans Pro; policy route Source Sans 3 is not loaded (1); fontResolution | preview has no face for open family Montserrat (1); fontResolution | preview has no face for open family Open Sans (1); fontResolution | preview has no face for open family Bebas Neue (1)
- **languages** (93): fontResolution | preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview (3); fontResolution | preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview (3); fontResolution | preview has no face for Sylfaen; policy route Noto Sans | Noto Sans Georgian | Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview (2); fontResolution | preview has no face for Nyala; policy route Noto Sans Ethiopic is not loaded; bundled in the scripts pack, not loaded in this preview (1); fontResolution | preview has no face for Shonar Bangla; policy route Noto Sans Bengali is not loaded; bundled in the scripts pack, not loaded in this preview (1)
- **themes** (4): none
- **narratives** (10): none
- **audiences** (14): none
- **tones** (7): none
- **socials** (10): none
- **backgrounds** (6): fills | background color F0F0F0 vs FFFFFF (1)
- **backgrounds (withAssets)** (6): none
- **image-treatments** (15): text | preview text line missing in PPTX (15); text | PPTX text not in preview (15)
- **image-treatments (withAssets)** (15): none
- **headers-footers** (10): zOrder | z-order inversions between element groups (4) (6); zOrder | z-order inversions between element groups (2) (2); zOrder | z-order inversions between element groups (6) (1); zOrder | z-order inversions between element groups (8) (1)
- **headers-footers (withAssets)** (10): zOrder | z-order inversions between element groups (4) (6); zOrder | z-order inversions between element groups (2) (2); zOrder | z-order inversions between element groups (6) (1); zOrder | z-order inversions between element groups (8) (1)
- **blocks** (32): fontResolution | preview has no face for open family Open Sans (5); fontResolution | preview has no face for open family Montserrat (3); fontResolution | preview has no face for open family Poppins (2); fills | chart series colors not in preview (3) (2); text | text color 000000 vs 2874A6 (1)
- **layouts** (485): fills | chart series colors not in preview (1) (39); text | list markers differ (10); text | preview text line missing in PPTX (10)
- **charts** (26): text | chart preview text not in native chart cache (11); fills | chart series colors not in preview (11) (9); fills | chart series colors not in preview (6) (4); fills | chart series colors not in preview (4) (4); fills | chart series colors not in preview (7) (4)

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|
| 1 | fills \| chart series colors not in preview (1) | fail | 41 | 82 | layouts/data-visualization [slides.0.blocks.0.chart]<br>layouts/dashboard [slides.0.blocks.0.chart]<br>layouts/waterfall-bridge [slides.0.blocks.0.chart] |  |
| 2 | text \| preview text line missing in PPTX | fail | 25 | 85 | image-treatments/full-bleed [slides.0.image]<br>image-treatments/text-overlay [slides.0.image]<br>image-treatments/side-by-side [slides.0.image] | Image unavailable |
| 3 | text \| PPTX text not in preview | fail | 15 | 15 | image-treatments/full-bleed [slides.0.image]<br>image-treatments/text-overlay [slides.0.image]<br>image-treatments/side-by-side [slides.0.image] | Image |
| 4 | zOrder \| z-order inversions between element groups (4) | fail | 12 | 12 | headers-footers/section-marker-header [slide 0]<br>headers-footers/section-marker-header@withAssets [slide 0]<br>headers-footers/dated-footer [slide 0] |  |
| 5 | text \| chart preview text not in native chart cache | fail | 11 | 11 | charts/stacked-column-3x [slides.0.chart]<br>charts/100pct-stacked-column-3x [slides.0.chart]<br>charts/stacked-line-3x [slides.0.chart] | Value 1  Value 2  Value 3 |
| 6 | text \| list markers differ | fail | 10 | 58 | layouts/list-5x-box-vertical-title-center-slideimage [slides.0.blocks.0.items]<br>layouts/list-5x-box-vertical-title-left-slideimage [slides.0.blocks.0.items]<br>layouts/list-6x-box-vertical [slides.0.blocks.0.items] | 3 preview [•••] vs 2 pptx [••] |
| 7 | fills \| chart series colors not in preview (11) | fail | 9 | 9 | charts/line-with-markers [slides.0.chart]<br>charts/stacked-line-3x [slides.0.chart]<br>charts/stacked-line-with-markers-3x [slides.0.chart] |  |
| 8 | fontResolution \| preview has no face for open family Open Sans | fail | 7 | 7 | font-schemes/open-sans [Open Sans]<br>font-schemes-legacy/modern-professional [Open Sans]<br>blocks/value-proposition [Open Sans] |  |
| 9 | fontResolution \| preview has no face for open family Montserrat | fail | 5 | 5 | font-schemes/montserrat [Montserrat]<br>font-schemes-legacy/modern-professional [Montserrat]<br>blocks/problem-statement [Montserrat] |  |
| 10 | fontResolution \| preview has no face for Mangal; policy route Noto Sans Devanagari is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 4 | 4 | font-schemes/mangal [Mangal]<br>languages/hindi [Mangal]<br>languages/marathi [Mangal] |  |
| 11 | fontResolution \| preview has no face for Arabic Typesetting; policy route Noto Naskh Arabic is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 4 | 4 | font-schemes/arabic-typesetting [Arabic Typesetting]<br>languages/arabic [Arabic Typesetting]<br>languages/persian [Arabic Typesetting] |  |
| 12 | zOrder \| z-order inversions between element groups (2) | fail | 4 | 4 | headers-footers/slide-number-only [slide 0]<br>headers-footers/slide-number-only@withAssets [slide 0]<br>headers-footers/slide-number-progress [slide 0] |  |
| 13 | fills \| chart series colors not in preview (6) | fail | 4 | 4 | charts/column [slides.0.chart]<br>charts/stacked-column-3x [slides.0.chart]<br>charts/100pct-stacked-column-3x [slides.0.chart] |  |
| 14 | fills \| chart series colors not in preview (4) | fail | 4 | 4 | charts/bar [slides.0.chart]<br>charts/stacked-bar-3x [slides.0.chart]<br>charts/100pct-stacked-bar-3x [slides.0.chart] |  |
| 15 | fills \| chart series colors not in preview (7) | fail | 4 | 4 | charts/radar [slides.0.chart]<br>charts/radar-with-markers [slides.0.chart]<br>charts/filled-radar [slides.0.chart] |  |
| 16 | fontResolution \| preview has no face for Sylfaen; policy route Noto Sans \| Noto Sans Georgian \| Noto Sans Armenian is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 3 | 3 | font-schemes/sylfaen [Sylfaen]<br>languages/armenian [Sylfaen]<br>languages/georgian [Sylfaen] |  |
| 17 | fontResolution \| preview has no face for open family Poppins | fail | 3 | 3 | font-schemes/poppins [Poppins]<br>blocks/solution-overview [Poppins]<br>blocks/before-after-story [Poppins] |  |
| 18 | fontResolution \| preview has no face for Microsoft YaHei; policy route Noto Sans SC is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/microsoft-yahei [Microsoft YaHei]<br>languages/chinese-simplified [Microsoft YaHei] |  |
| 19 | fontResolution \| preview has no face for Malgun Gothic; policy route Noto Sans KR is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/malgun-gothic [Malgun Gothic]<br>languages/korean [Malgun Gothic] |  |
| 20 | fontResolution \| preview has no face for Latha; policy route Noto Sans Tamil is not loaded; bundled in the scripts pack, not loaded in this preview | fail | 2 | 2 | font-schemes/latha [Latha]<br>languages/tamil [Latha] |  |

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| fontResolution \| visual-only replacement (no metric-compatible open font for Aptos Display): Aptos Display -> Carlito | 704 | color-schemes/black-and-white [Aptos Display] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Aptos): Aptos -> Roboto | 704 | color-schemes/black-and-white [Aptos] |
| text \| line segmentation differs (preview line is part of a PPTX paragraph) | 15 | image-treatments/full-bleed [slides.0.image] |
| mapping \| pptx shape unmapped (sp:OPF list paragraph #) | 10 | layouts/list-5x-box-vertical-title-center-slideimage [unmapped] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI Semibold): Segoe UI Semibold -> Roboto SemiBold (listed alternate) | 7 | font-schemes/segoe-ui [Segoe UI Semibold] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Segoe UI): Segoe UI -> Arimo (listed alternate) | 7 | font-schemes/segoe-ui [Segoe UI] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Georgia): Georgia -> Gelasio | 6 | font-schemes/georgia [Georgia] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Grandview): Grandview -> Roboto (listed alternate) | 5 | font-schemes/impact [Grandview] |
| text \| chart label wrapped/split in preview (native chart lays out its own labels) | 4 | charts/column [slides.0.chart] |
| fontResolution \| visual-only replacement (no metric-compatible open font for Arial Black): Arial Black -> Arimo (listed alternate) | 3 | font-schemes/arial [Arial Black] |

## Preview font resolution (registry status, the old-definition view)

Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render. This is the registry status the old definition gated on; the verdict under the new definition is in the section above.

| status | families | values affected | families (values) |
|---|---|---|---|
| real | 2 | 848 | Roboto Mono (848), Roboto (3) |
| metric-substitute | 4 | 6 | Arial→Arimo (3), Courier New→Cousine (1), Calibri→Carlito (1), Times New Roman→Tinos (1) |
| visual-substitute | 27 | 741 | Aptos Display→Carlito (704), Aptos→Roboto (704), Segoe UI Semibold→Roboto SemiBold (7), Segoe UI→Arimo (7), Georgia→Gelasio (6), Grandview→Roboto (5), Arial Black→Arimo (3), Grandview Display→Roboto (3), Impact→Carlito (2), Seaford Display→Carlito (2), Seaford→Carlito (2), Tenorite Display→Roboto (2), Tenorite→Roboto (2), Consolas→Cousine (1), Lucida Sans→Arimo (1), Segoe UI Semilight→Roboto (1), Segoe UI Light→Carlito (1), Tahoma→Arimo (1), Trebuchet MS→Arimo (1), Verdana→Arimo (1), Bookman Old Style→Gelasio (1), Century Schoolbook→Gelasio (1), Constantia→Caladea (1), Garamond→Tinos (1), Rockwell→Gelasio (1), Skeena Display→Carlito (1), Skeena→Carlito (1) |
| missing | 71 | 104 | Open Sans (7), Montserrat (5), Mangal (4), Arabic Typesetting (4), Sylfaen (3), Poppins (3), Microsoft YaHei (2), Malgun Gothic (2), Latha (2), David (2), Vrinda (2), Shruti (2), Tunga (2), Kartika (2), Kalinga (2), Raavi (2), Gautami (2), Microsoft JhengHei (2), Meiryo (2), Angsana New (2), Shonar Bangla (2), Noto Naskh Arabic (2), Nyala (2), DaunPenh (2), SimSun (1), FangSong (1), Yu Gothic (1), PMingLiU (1), MingLiU (1), MS Mincho (1), BatangChe (1), Batang (1), GungsuhChe (1), Gungsuh (1), Nirmala UI (1), Miriam (1), Gisha (1), Aparajita (1), DilleniaUPC (1), Sakkal Majalla (1), … |

5/850 values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).

## Package typeface inventory

Foreign `typeface=` values are those not used by the preview; they are listed by part, with the number of values affected:


Theme per-script supplements (`<a:font script=…>`) are listed separately and not gated: 50 distinct faces (游ゴシック Light, 맑은 고딕, 等线 Light, 新細明體, Times New Roman, Angsana New, Nyala, Vrinda, Shruti, MoolBoran, Tunga, Raavi, …).

## Re-running

```powershell
dimension-audit\parity\run.ps1                          # current worktrees -> parity-results.json + PARITY.md
dimension-audit\parity\run.ps1 -Update                  # move sources\parity-* to origin/main, rebuild, rerun
dimension-audit\parity\build.ps1 -Prefix pr123; dimension-audit\parity\run.ps1 -Prefix pr123 -Baseline dimension-audit\parity\parity-results.json -Out dimension-audit\parity\out\pr123.json
```

For a fix PR, create `sources\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.
