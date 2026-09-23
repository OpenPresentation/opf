# Preview vs PPTX parity: pptx.gallery values

Generated 2026-09-23T11:30:50.032Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `parity`). No Office was used.

Heads: opf `a74f3f6`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery `f17e9ae`.

## What "perfect" means

For each value, the harness builds the gallery's own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter's stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box.

| check | pass means |
|---|---|
| geometry | the rendered text line extent (left edge from the anchor and the line width by core measureText; PPTX: box x + marL, centered or right-aligned in the box) and baseline (box y + size) are within 0.02 pt. Chart, table, picture and card frames equal the composed box within 0.02 pt. Deltas up to 0.5 pt count as near. |
| text | Same line text; same run segmentation; per run, the same family in the script slot used by the text (latin/ea/cs), size within 0.005 pt, bold, italic and resolved RGB colour (srgb, or schemeClr resolved through theme1); same paragraph alignment; same list markers. Native charts: preview labels exist in the chart caches, and the chart XML names the preview font. |
| fills | Same background kind and colour. Per element group, the same set of solid fill colours (table cell fills included) and the same image count and bytes (sha256). Chart series colours appear in the preview. |
| zOrder | The order of mapped element groups in spTree matches SVG paint order, and the slide count matches. |
| slideSize | `p:sldSz` equals the SVG viewBox within 0.02 pt. |
| typefaces | Every `typeface=` in every part (charts and embedded workbook styles included) and every font listed in app.xml is a family the preview uses. Theme per-script supplements are reported separately and are not gated. |
| reimport | `fromPptx` preserves design.colorScheme, fontScheme, theme, background, dimensions, language, narrative, tone, audience and slide layout ids. A loss with a specific diagnostic counts as near; a silent loss fails. |
| fontResolution | Every family the preview uses resolves, in the office pack with visual substitution, to the real face (`exact`) or to a metric-compatible substitute. A visual substitute or a missing face fails. |
| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. |

Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.

## Per-dimension counts

| dimension | n | perfect | near | mismatch | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 0 | 0 | 14 | 0/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 0/14 | 14/14 | 14/14 |
| font-schemes | 89 | 4 | 0 | 85 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 4/89 | 89/89 | 89/89 |
| font-schemes-legacy | 4 | 0 | 0 | 4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0/4 | 4/4 | 4/4 |
| languages | 93 | 0 | 0 | 93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 93/93 | 0/93 | 93/93 | 93/93 |
| themes | 4 | 0 | 0 | 4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0/4 | 4/4 | 3/4 |
| narratives | 10 | 0 | 0 | 10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 |
| audiences | 14 | 0 | 0 | 14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 0/14 | 14/14 | 11/14 |
| tones | 7 | 0 | 0 | 7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 0/7 | 7/7 | 7/7 |
| socials | 10 | 0 | 0 | 10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 |
| backgrounds | 6 | 0 | 0 | 6 | 6/6 | 6/6 | 5/6 | 6/6 | 6/6 | 6/6 | 5/6 | 0/6 | 6/6 | 6/6 |
| backgrounds (withAssets) | 6 | 0 | 0 | 6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 | 6/6 | 6/6 |
| image-treatments | 15 | 0 | 0 | 15 | 15/15 | 0/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 0/15 | 15/15 | 15/15 |
| image-treatments (withAssets) | 15 | 0 | 0 | 15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 15/15 | 0/15 | 15/15 | 0/15 |
| headers-footers | 10 | 0 | 0 | 10 | 10/10 | 0/10 | 10/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 |
| headers-footers (withAssets) | 10 | 0 | 0 | 10 | 10/10 | 0/10 | 10/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 | 10/10 | 10/10 |
| blocks | 32 | 0 | 0 | 32 | 27/32 | 25/32 | 27/32 | 29/32 | 32/32 | 32/32 | 32/32 | 1/32 | 32/32 | 28/32 |
| layouts | 485 | 0 | 0 | 485 | 378/485 | 436/485 | 332/485 | 392/485 | 485/485 | 485/485 | 485/485 | 0/485 | 485/485 | 280/485 |
| charts | 76 | 0 | 0 | 76 | 76/76 | 26/76 | 9/76 | 76/76 | 76/76 | 76/76 | 76/76 | 0/76 | 76/76 | 76/76 |
| **all** | 900 | 4 | 0 | 896 | 774/900 | 759/900 | 674/900 | 784/900 | 900/900 | 900/900 | 899/900 | 5/900 | 900/900 | 672/900 |

The check columns count values that pass that check. A value is perfect only when every check passes.

## Before / after

Baseline heads: opf `c278532`, opf-render `47d19b2`, opf-pptx `5b657c9`, pptx-gallery `f17e9ae`.

| dimension | perfect before | perfect after | near before | near after | improved | regressed |
|---|---|---|---|---|---|---|
| color-schemes | 0 | 0 | 0 | 0 | 0 | 0 |
| font-schemes | 0 | 4 | 0 | 0 | 4 | 0 |
| font-schemes-legacy | 0 | 0 | 0 | 0 | 0 | 0 |
| languages | 0 | 0 | 0 | 0 | 0 | 0 |
| themes | 0 | 0 | 0 | 0 | 0 | 0 |
| narratives | 0 | 0 | 0 | 0 | 0 | 0 |
| audiences | 0 | 0 | 0 | 0 | 0 | 0 |
| tones | 0 | 0 | 0 | 0 | 0 | 0 |
| socials | 0 | 0 | 0 | 0 | 0 | 0 |
| backgrounds | 0 | 0 | 0 | 0 | 0 | 0 |
| backgrounds (withAssets) | 0 | 0 | 0 | 0 | 0 | 0 |
| image-treatments | 0 | 0 | 0 | 0 | 0 | 0 |
| image-treatments (withAssets) | 0 | 0 | 0 | 0 | 0 | 0 |
| headers-footers | 0 | 0 | 0 | 0 | 0 | 0 |
| headers-footers (withAssets) | 0 | 0 | 0 | 0 | 0 | 0 |
| blocks | 0 | 0 | 0 | 0 | 0 | 0 |
| layouts | 0 | 0 | 0 | 0 | 0 | 0 |
| charts | 0 | 0 | 0 | 0 | 0 | 0 |
| **all** | 0 | 4 | 0 | 0 | 4 | 0 |

## Top mismatch reasons per dimension

- **color-schemes** (14): geometry | table frame delta >50pt (14); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (14); fontResolution | preview font visual-substitute: Aptos -> Carlito (14)
- **font-schemes** (89): fontResolution | preview font missing: Grandview (2); fontResolution | preview font missing: Noto Naskh Arabic (2); fontResolution | preview font visual-substitute: Consolas -> Cousine (1); fontResolution | preview font missing: Arial Black (1); fontResolution | preview font missing: Impact (1)
- **font-schemes-legacy** (4): fontResolution | preview font missing: Playfair Display (1); fontResolution | preview font missing: Source Sans Pro (1); fontResolution | preview font missing: Montserrat (1); fontResolution | preview font missing: Open Sans (1); fontResolution | preview font missing: Bebas Neue (1)
- **languages** (93): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (66); fontResolution | preview font visual-substitute: Aptos -> Carlito (66); fontResolution | preview font missing: Arabic Typesetting (3); fontResolution | preview font missing: Mangal (3); fontResolution | preview font missing: Sylfaen (2)
- **themes** (4): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (1); fontResolution | preview font visual-substitute: Aptos -> Carlito (1); fontResolution | preview font missing: Tenorite Display (1); fontResolution | preview font missing: Tenorite (1); mapping | preview element group has no PPTX shape (image) (1)
- **narratives** (10): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10)
- **audiences** (14): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (14); fontResolution | preview font visual-substitute: Aptos -> Carlito (14); mapping | preview element group has no PPTX shape (image) (3)
- **tones** (7): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (7); fontResolution | preview font visual-substitute: Aptos -> Carlito (7)
- **socials** (10): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10)
- **backgrounds** (6): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (6); fontResolution | preview font visual-substitute: Aptos -> Carlito (6); fills | background color F0F0F0 vs FFFFFF (1)
- **backgrounds (withAssets)** (6): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (6); fontResolution | preview font visual-substitute: Aptos -> Carlito (6)
- **image-treatments** (15): text | preview text line missing in PPTX (15); text | PPTX text not in preview (15); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (15); fontResolution | preview font visual-substitute: Aptos -> Carlito (15)
- **image-treatments (withAssets)** (15): mapping | preview element group has no PPTX shape (image) (15); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (15); fontResolution | preview font visual-substitute: Aptos -> Carlito (15)
- **headers-footers** (10): text | preview text line missing in PPTX (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); zOrder | z-order inversions between element groups (4) (6); zOrder | z-order inversions between element groups (2) (2)
- **headers-footers (withAssets)** (10): text | preview text line missing in PPTX (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); zOrder | z-order inversions between element groups (4) (6); zOrder | z-order inversions between element groups (2) (2)
- **blocks** (32): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (8); fontResolution | preview font visual-substitute: Aptos -> Carlito (8); fontResolution | preview font missing: Segoe UI Semibold (6); fontResolution | preview font missing: Segoe UI (6); fontResolution | preview font visual-substitute: Georgia -> Gelasio (5)
- **layouts** (485): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (485); fontResolution | preview font visual-substitute: Aptos -> Carlito (485); mapping | preview element group has no PPTX shape (image) (202); geometry | picture frame delta >50pt (103); fills | image count 0 preview vs 1 pptx (87)
- **charts** (76): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (76); fontResolution | preview font visual-substitute: Aptos -> Carlito (76); text | chart preview text not in native chart cache (46); fills | chart series colors not in preview (11) (26); fills | chart series colors not in preview (6) (12)

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|
| 1 | fontResolution \| preview font visual-substitute: Aptos Display -> Carlito | fail | 754 | 754 | color-schemes/black-and-white [Aptos Display]<br>color-schemes/bold-red [Aptos Display]<br>color-schemes/boost [Aptos Display] |  |
| 2 | fontResolution \| preview font visual-substitute: Aptos -> Carlito | fail | 754 | 754 | color-schemes/black-and-white [Aptos]<br>color-schemes/bold-red [Aptos]<br>color-schemes/boost [Aptos] |  |
| 3 | mapping \| preview element group has no PPTX shape (image) | fail | 225 | 225 | themes/dark [slides.0.design.slideImage]<br>audiences/sales [slides.0.design.slideImage]<br>audiences/customer [slides.0.design.slideImage] |  |
| 4 | geometry \| picture frame delta >50pt | fail | 106 | 106 | blocks/solution-overview [slides.0.items]<br>blocks/value-proposition [slides.0.items]<br>blocks/team-grid [slides.0.items] | {"x":0,"y":0,"w":1280,"h":720} vs {"x":57.6,"y":189.98,"w":1164.8,"h":472.42} |
| 5 | fills \| image count 0 preview vs 1 pptx | fail | 90 | 90 | blocks/solution-overview [slides.0.items]<br>blocks/value-proposition [slides.0.items]<br>blocks/team-grid [slides.0.items] |  |
| 6 | zOrder \| z-order inversions between element groups (1) | fail | 52 | 52 | layouts/network-dependency-map [slide 0]<br>layouts/geographic-map [slide 0]<br>layouts/chart-1x-title-center-slideimage [slide 0] |  |
| 7 | zOrder \| z-order inversions between element groups (2) | fail | 46 | 46 | headers-footers/slide-number-only [slide 0]<br>headers-footers/slide-number-only@withAssets [slide 0]<br>headers-footers/slide-number-progress [slide 0] |  |
| 8 | fills \| chart series colors not in preview (1) | fail | 46 | 87 | layouts/data-visualization [slides.0.blocks.0.chart]<br>layouts/dashboard [slides.0.blocks.0.chart]<br>layouts/waterfall-bridge [slides.0.blocks.0.chart] |  |
| 9 | text \| chart preview text not in native chart cache | fail | 46 | 46 | charts/clustered-column [slides.0.chart]<br>charts/stacked-column-2x [slides.0.chart]<br>charts/stacked-column-3x [slides.0.chart] | Value 1  Value 2 |
| 10 | text \| preview text line missing in PPTX | fail | 45 | 105 | image-treatments/full-bleed [slides.0.image]<br>image-treatments/text-overlay [slides.0.image]<br>image-treatments/side-by-side [slides.0.image] | Image unavailable |
| 11 | text \| alignment l (preview) vs ctr (pptx) | fail | 39 | 264 | blocks/market-opportunity [slides.0.blocks.0.metric]<br>blocks/kpi-dashboard [slides.0.blocks.0.metric]<br>blocks/traction-metrics [slides.0.blocks.0.metric] | $48B TAM |
| 12 | fills \| chart series colors not in preview (11) | fail | 26 | 26 | charts/line-with-high-low [slides.0.chart]<br>charts/line-with-high-low-and-markers [slides.0.chart]<br>charts/line-with-markers [slides.0.chart] |  |
| 13 | fills \| PPTX fill color(s) absent in preview | fail | 24 | 24 | layouts/list-1x-box [slides.0.items]<br>layouts/list-1x-box-vertical [slides.0.items]<br>layouts/list-2x-box [slides.0.blocks.0.items] | 011842 not in [] |
| 14 | geometry \| table frame delta >50pt | fail | 20 | 20 | color-schemes/black-and-white [slides.3.table]<br>color-schemes/bold-red [slides.3.table]<br>color-schemes/boost [slides.3.table] | {"x":57.6,"y":147.48,"w":1164.8,"h":162} vs {"x":57.6,"y":147.48,"w":1164.8,"h": |
| 15 | text \| PPTX text not in preview | fail | 16 | 16 | image-treatments/full-bleed [slides.0.image]<br>image-treatments/text-overlay [slides.0.image]<br>image-treatments/side-by-side [slides.0.image] | Image |
| 16 | fills \| image count 1 preview vs 2 pptx | fail | 16 | 16 | layouts/image-2x-crop-vertical-title-left-slideimage [slides.0.blocks.0.image]<br>layouts/image-2x-fit-vertical-title-left-slideimage [slides.0.blocks.0.image]<br>layouts/image-3x-crop-slideimage [slides.0.blocks.1.image] |  |
| 17 | zOrder \| z-order inversions between element groups (4) | fail | 12 | 12 | headers-footers/section-marker-header [slide 0]<br>headers-footers/section-marker-header@withAssets [slide 0]<br>headers-footers/dated-footer [slide 0] |  |
| 18 | fills \| chart series colors not in preview (6) | fail | 12 | 12 | charts/column [slides.0.chart]<br>charts/clustered-column [slides.0.chart]<br>charts/stacked-column-2x [slides.0.chart] |  |
| 19 | text \| list markers differ | fail | 10 | 58 | layouts/list-5x-box-vertical-title-center-slideimage [slides.0.blocks.0.items]<br>layouts/list-5x-box-vertical-title-left-slideimage [slides.0.blocks.0.items]<br>layouts/list-6x-box-vertical [slides.0.blocks.0.items] | 3 preview [•••] vs 2 pptx [••] |
| 20 | fills \| chart series colors not in preview (4) | fail | 9 | 9 | charts/bar [slides.0.chart]<br>charts/clustered-bar-2x [slides.0.chart]<br>charts/stacked-bar-2x [slides.0.chart] |  |

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| mapping \| pptx shape unmapped (pic:OPF slide image slides.#) | 119 | themes/dark [unmapped] |
| text \| line segmentation differs (preview line is part of a PPTX paragraph) | 16 | image-treatments/full-bleed [slides.0.image] |
| mapping \| pptx shape unmapped (sp:OPF list paragraph #) | 10 | layouts/list-5x-box-vertical-title-center-slideimage [unmapped] |
| text \| chart label wrapped/split in preview (native chart lays out its own labels) | 5 | blocks/financial-snapshot [slides.0.blocks.4.chart] |
| text \| font size 14.145pt vs 14.15pt | 2 | layouts/list-6x-heading-title-center [slides.0.blocks.0.items] |
| text \| chart text sizes preview [13.5] vs chart [12,18] | 2 | charts/pie [slides.0.chart] |
| reimport \| design.background not preserved (diagnostic unresolved-asset-reference) | 1 | backgrounds/photography |

## Preview font resolution

Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render.

| status | families | values affected | families (values) |
|---|---|---|---|
| real | 2 | 898 | Roboto Mono (898), Roboto (3) |
| metric-substitute | 4 | 6 | Arial→Arimo (3), Courier New→Cousine (1), Calibri→Carlito (1), Times New Roman→Tinos (1) |
| visual-substitute | 5 | 762 | Aptos Display→Carlito (754), Aptos→Carlito (754), Georgia→Gelasio (6), Consolas→Cousine (1), Tahoma→Arimo (1) |
| missing | 93 | 133 | Segoe UI Semibold (7), Segoe UI (7), Open Sans (7), Grandview (5), Montserrat (5), Mangal (4), Arabic Typesetting (4), Arial Black (3), Grandview Display (3), Sylfaen (3), Poppins (3), Impact (2), Seaford Display (2), Seaford (2), Tenorite Display (2), Tenorite (2), Microsoft YaHei (2), Malgun Gothic (2), Latha (2), David (2), Vrinda (2), Shruti (2), Tunga (2), Kartika (2), Kalinga (2), Raavi (2), Gautami (2), Microsoft JhengHei (2), Meiryo (2), Angsana New (2), Shonar Bangla (2), Noto Naskh Arabic (2), Nyala (2), DaunPenh (2), Lucida Sans (1), Segoe UI Semilight (1), Segoe UI Light (1), Trebuchet MS (1), Verdana (1), Bookman Old Style (1), … |

5/900 values render only with the chosen font or a metric-compatible substitute.

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
