# Preview vs PPTX parity: pptx.gallery values

Generated 2026-09-23T04:38:53.955Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `parity`). No Office was used.

Heads: opf `53be042`, opf-render `e500ed9`, opf-pptx `cf0bc0c`, pptx-gallery `f17e9ae`.

## What "perfect" means

For each value, the harness builds the gallery's own OPF Config document. It renders the traced preview (`renderSvgDeck` with `trace:true`, plus `resolvePresentation` geometry) and exports it with `toPptx`. It then compares the two element by element. PPTX shapes are mapped to preview items in two ways: by the exporter's stable object names (`OPF heading|text|card <path> line N`), or else by geometric containment in the composed item box.

| check | pass means |
|---|---|
| geometry | text line anchor x (left: box x + marL; center; right) and baseline (box y + size) are within 0.02 pt. Chart, table, picture and card frames equal the composed box within 0.02 pt. Deltas up to 0.5 pt count as near. |
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
| color-schemes | 14 | 0 | 0 | 14 | 0/14 | 0/14 | 14/14 | 14/14 | 14/14 | 0/14 | 0/14 | 0/14 | 0/14 | 14/14 |
| font-schemes | 89 | 0 | 0 | 89 | 0/89 | 0/89 | 89/89 | 89/89 | 89/89 | 0/89 | 0/89 | 4/89 | 0/89 | 89/89 |
| font-schemes-legacy | 4 | 0 | 0 | 4 | 0/4 | 0/4 | 4/4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | 0/4 | 4/4 |
| languages | 93 | 0 | 0 | 93 | 0/93 | 0/93 | 93/93 | 93/93 | 93/93 | 0/93 | 0/93 | 0/93 | 0/93 | 93/93 |
| themes | 4 | 0 | 0 | 4 | 3/4 | 3/4 | 4/4 | 4/4 | 4/4 | 0/4 | 0/4 | 0/4 | 0/4 | 4/4 |
| narratives | 10 | 0 | 0 | 10 | 0/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 10/10 |
| audiences | 14 | 0 | 0 | 14 | 10/14 | 10/14 | 14/14 | 14/14 | 14/14 | 0/14 | 0/14 | 0/14 | 0/14 | 14/14 |
| tones | 7 | 0 | 0 | 7 | 0/7 | 0/7 | 7/7 | 7/7 | 7/7 | 0/7 | 0/7 | 0/7 | 0/7 | 7/7 |
| socials | 10 | 0 | 0 | 10 | 0/10 | 0/10 | 10/10 | 10/10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 10/10 |
| backgrounds | 6 | 0 | 0 | 6 | 0/6 | 0/6 | 2/6 | 6/6 | 6/6 | 0/6 | 0/6 | 0/6 | 0/6 | 6/6 |
| backgrounds (withAssets) | 6 | 0 | 0 | 6 | 0/6 | 0/6 | 2/6 | 6/6 | 6/6 | 0/6 | 0/6 | 0/6 | 0/6 | 6/6 |
| image-treatments | 15 | 0 | 0 | 15 | 0/15 | 0/15 | 15/15 | 15/15 | 15/15 | 0/15 | 0/15 | 0/15 | 0/15 | 15/15 |
| image-treatments (withAssets) | 15 | 0 | 0 | 15 | 0/15 | 0/15 | 15/15 | 15/15 | 15/15 | 0/15 | 0/15 | 0/15 | 0/15 | 15/15 |
| headers-footers | 10 | 0 | 0 | 10 | 0/10 | 0/10 | 10/10 | 0/10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 10/10 |
| headers-footers (withAssets) | 10 | 0 | 0 | 10 | 0/10 | 0/10 | 10/10 | 0/10 | 10/10 | 0/10 | 0/10 | 0/10 | 0/10 | 10/10 |
| blocks | 32 | 0 | 0 | 32 | 20/32 | 20/32 | 25/32 | 32/32 | 32/32 | 0/32 | 0/32 | 1/32 | 0/32 | 32/32 |
| layouts | 485 | 0 | 0 | 485 | 269/485 | 240/485 | 442/485 | 485/485 | 485/485 | 0/485 | 0/485 | 0/485 | 0/485 | 475/485 |
| charts | 76 | 0 | 0 | 76 | 76/76 | 0/76 | 76/76 | 76/76 | 76/76 | 0/76 | 0/76 | 0/76 | 0/76 | 76/76 |
| **all** | 900 | 0 | 0 | 900 | 378/900 | 273/900 | 842/900 | 880/900 | 900/900 | 0/900 | 0/900 | 5/900 | 0/900 | 890/900 |

The check columns count values that pass that check. A value is perfect only when every check passes.

## Top mismatch reasons per dimension

- **color-schemes** (14): text | alignment ctr (preview) vs l (pptx) (14); geometry | text line anchor-x delta >50pt (14); reimport | slide layout id not preserved (no diagnostic) (14); geometry | table frame delta >50pt (14); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (14)
- **font-schemes** (89): text | alignment ctr (preview) vs l (pptx) (89); geometry | text line anchor-x delta >50pt (89); theme | theme clrScheme differs from document color scheme (10 slots) (89); reimport | design.fontScheme not preserved (no diagnostic) (89); reimport | slide layout id not preserved (no diagnostic) (89)
- **font-schemes-legacy** (4): text | alignment ctr (preview) vs l (pptx) (4); geometry | text line anchor-x delta >50pt (4); typefaces | foreign font in app.xml: Arial (4); typefaces | foreign font in app.xml: Calibri (4); theme | theme clrScheme differs from document color scheme (10 slots) (4)
- **languages** (93): text | alignment ctr (preview) vs l (pptx) (93); geometry | text line anchor-x delta >50pt (93); typefaces | foreign font in app.xml: Calibri (93); theme | theme clrScheme differs from document color scheme (10 slots) (93); reimport | design.fontScheme not preserved (no diagnostic) (93)
- **themes** (4): typefaces | foreign font in app.xml: Arial (4); typefaces | foreign font in app.xml: Calibri (4); theme | theme clrScheme differs from document color scheme (10 slots) (4); reimport | design.colorScheme not preserved (no diagnostic) (4); reimport | design.fontScheme not preserved (no diagnostic) (4)
- **narratives** (10): text | alignment ctr (preview) vs l (pptx) (10); geometry | text line anchor-x delta >50pt (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); typefaces | foreign font in app.xml: Arial (10)
- **audiences** (14): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (14); fontResolution | preview font visual-substitute: Aptos -> Carlito (14); typefaces | foreign font in app.xml: Arial (14); typefaces | foreign font in app.xml: Calibri (14); theme | theme clrScheme differs from document color scheme (10 slots) (14)
- **tones** (7): text | alignment ctr (preview) vs l (pptx) (7); geometry | text line anchor-x delta >50pt (7); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (7); fontResolution | preview font visual-substitute: Aptos -> Carlito (7); typefaces | foreign font in app.xml: Arial (7)
- **socials** (10): text | alignment ctr (preview) vs l (pptx) (10); geometry | text line anchor-x delta >50pt (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); typefaces | foreign font in app.xml: Arial (10)
- **backgrounds** (6): text | alignment ctr (preview) vs l (pptx) (6); geometry | text line anchor-x delta >50pt (6); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (6); fontResolution | preview font visual-substitute: Aptos -> Carlito (6); typefaces | foreign font in app.xml: Arial (6)
- **backgrounds (withAssets)** (6): text | alignment ctr (preview) vs l (pptx) (6); geometry | text line anchor-x delta >50pt (6); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (6); fontResolution | preview font visual-substitute: Aptos -> Carlito (6); typefaces | foreign font in app.xml: Arial (6)
- **image-treatments** (15): text | alignment ctr (preview) vs l (pptx) (15); geometry | text line anchor-x delta >50pt (15); text | preview text line missing in PPTX (15); text | PPTX text not in preview (15); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (15)
- **image-treatments (withAssets)** (15): text | alignment ctr (preview) vs l (pptx) (15); geometry | text line anchor-x delta >50pt (15); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (15); fontResolution | preview font visual-substitute: Aptos -> Carlito (15); typefaces | foreign font in app.xml: Arial (15)
- **headers-footers** (10): text | alignment ctr (preview) vs l (pptx) (10); geometry | text line anchor-x delta >50pt (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); typefaces | foreign font in app.xml: Arial (10)
- **headers-footers (withAssets)** (10): text | alignment ctr (preview) vs l (pptx) (10); geometry | text line anchor-x delta >50pt (10); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (10); fontResolution | preview font visual-substitute: Aptos -> Carlito (10); typefaces | foreign font in app.xml: Arial (10)
- **blocks** (32): typefaces | foreign font in app.xml: Arial (32); typefaces | foreign font in app.xml: Calibri (32); theme | theme clrScheme differs from document color scheme (10 slots) (32); reimport | design.colorScheme not preserved (no diagnostic) (32); reimport | design.fontScheme not preserved (no diagnostic) (32)
- **layouts** (485): fontResolution | preview font visual-substitute: Aptos Display -> Carlito (485); fontResolution | preview font visual-substitute: Aptos -> Carlito (485); typefaces | foreign font in app.xml: Arial (485); typefaces | foreign font in app.xml: Calibri (485); theme | theme clrScheme differs from document color scheme (10 slots) (485)
- **charts** (76): text | native chart has no explicit typeface (inherits theme/Office default) (76); fontResolution | preview font visual-substitute: Aptos Display -> Carlito (76); fontResolution | preview font visual-substitute: Aptos -> Carlito (76); typefaces | foreign typeface Arial in ppt/charts/chartN.xml:latin (76); typefaces | foreign typeface Geneva in ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/styles.xml:xlsx-font (76)

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|
| 1 | reimport \| slide layout id not preserved (no diagnostic) | fail | 900 | 942 | color-schemes/black-and-white [slides.0]<br>color-schemes/bold-red [slides.0]<br>color-schemes/boost [slides.0] |  |
| 2 | typefaces \| foreign font in app.xml: Calibri | fail | 899 | 899 | color-schemes/black-and-white<br>color-schemes/bold-red<br>color-schemes/boost |  |
| 3 | theme \| theme clrScheme differs from document color scheme (10 slots) | fail | 899 | 899 | color-schemes/black-and-white<br>color-schemes/bold-red<br>color-schemes/boost |  |
| 4 | typefaces \| foreign font in app.xml: Arial | fail | 897 | 897 | color-schemes/black-and-white<br>color-schemes/bold-red<br>color-schemes/boost |  |
| 5 | fontResolution \| preview font visual-substitute: Aptos Display -> Carlito | fail | 754 | 754 | color-schemes/black-and-white [Aptos Display]<br>color-schemes/bold-red [Aptos Display]<br>color-schemes/boost [Aptos Display] |  |
| 6 | fontResolution \| preview font visual-substitute: Aptos -> Carlito | fail | 754 | 754 | color-schemes/black-and-white [Aptos]<br>color-schemes/bold-red [Aptos]<br>color-schemes/boost [Aptos] |  |
| 7 | text \| alignment ctr (preview) vs l (pptx) | fail | 504 | 931 | color-schemes/black-and-white [slides.0.title]<br>color-schemes/bold-red [slides.0.title]<br>color-schemes/boost [slides.0.title] | Color scheme preview |
| 8 | geometry \| text line anchor-x delta >50pt | fail | 504 | 943 | color-schemes/black-and-white [slides.0.title]<br>color-schemes/bold-red [slides.0.title]<br>color-schemes/boost [slides.0.title] | dx 436.8 dy 0 "Color scheme preview" |
| 9 | reimport \| design.fontScheme not preserved (no diagnostic) | fail | 222 | 222 | font-schemes/consolas<br>font-schemes/courier-new<br>font-schemes/arial |  |
| 10 | text \| native chart has no explicit typeface (inherits theme/Office default) | fail | 117 | 158 | blocks/financial-snapshot [slides.0.blocks.4.chart]<br>blocks/data-story-insight [slides.0.blocks.1.chart]<br>layouts/data-visualization [slides.0.blocks.0.chart] |  |
| 11 | typefaces \| foreign typeface Arial in ppt/charts/chartN.xml:latin | fail | 117 | 117 | blocks/financial-snapshot<br>blocks/data-story-insight<br>layouts/data-visualization |  |
| 12 | typefaces \| foreign typeface Geneva in ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/styles.xml:xlsx-font | fail | 117 | 117 | blocks/financial-snapshot<br>blocks/data-story-insight<br>layouts/data-visualization |  |
| 13 | typefaces \| foreign typeface Arial in ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/styles.xml:xlsx-font | fail | 117 | 117 | blocks/financial-snapshot<br>blocks/data-story-insight<br>layouts/data-visualization |  |
| 14 | typefaces \| foreign typeface Calibri Light in ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/theme/themeN.xml:latin | fail | 117 | 117 | blocks/financial-snapshot<br>blocks/data-story-insight<br>layouts/data-visualization |  |
| 15 | typefaces \| foreign typeface Calibri in ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/theme/themeN.xml:latin | fail | 117 | 117 | blocks/financial-snapshot<br>blocks/data-story-insight<br>layouts/data-visualization |  |
| 16 | text \| chart preview text not in native chart cache | fail | 111 | 152 | blocks/financial-snapshot [slides.0.blocks.4.chart]<br>blocks/data-story-insight [slides.0.blocks.1.chart]<br>layouts/data-visualization [slides.0.blocks.0.chart] | Curr \| ent \| Next \| Targ |
| 17 | reimport \| language not preserved (no diagnostic) | fail | 93 | 93 | languages/afrikaans<br>languages/albanian<br>languages/amharic |  |
| 18 | reimport \| design.colorScheme not preserved (no diagnostic) | fail | 64 | 64 | color-schemes/black-and-white<br>color-schemes/bold-red<br>color-schemes/boost |  |
| 19 | reimport \| narrative not preserved (no diagnostic) | fail | 56 | 56 | narratives/problem-solution<br>narratives/heros-journey<br>narratives/what-so-what-now-what |  |
| 20 | reimport \| tone not preserved (no diagnostic) | fail | 53 | 53 | audiences/executive<br>audiences/investor<br>audiences/board |  |

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| text \| line segmentation differs (preview line is part of a PPTX paragraph) | 16 | image-treatments/full-bleed [slides.0.image] |
| mapping \| pptx shape unmapped (sp:OPF list paragraph #) | 10 | layouts/list-5x-box-vertical-title-center-slideimage [unmapped] |
| text \| font size 14.145pt vs 14.15pt | 2 | layouts/list-6x-heading-title-center [slides.0.blocks.0.items] |

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

- `Arial@ppt/charts/chartN.xml:latin` — 117
- `Geneva@ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/styles.xml:xlsx-font` — 117
- `Arial@ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/styles.xml:xlsx-font` — 117
- `Calibri Light@ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/theme/themeN.xml:latin` — 117
- `Calibri@ppt/embeddings/Microsoft_Excel_WorksheetN.xlsx!/xl/theme/themeN.xml:latin` — 117

Theme per-script supplements (`<a:font script=…>`) are listed separately and not gated: 48 distinct faces (游ゴシック Light, 맑은 고딕, 等线 Light, 新細明體, Times New Roman, Angsana New, Nyala, Vrinda, Shruti, MoolBoran, Tunga, Raavi, …).

## Re-running

```powershell
dimension-audit\parity\run.ps1                          # current worktrees -> parity-results.json + PARITY.md
dimension-audit\parity\run.ps1 -Update                  # move sources\parity-* to origin/main, rebuild, rerun
dimension-audit\parity\build.ps1 -Prefix pr123; dimension-audit\parity\run.ps1 -Prefix pr123 -Baseline dimension-audit\parity\parity-results.json -Out dimension-audit\parity\out\pr123.json
```

For a fix PR, create `sources\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.
