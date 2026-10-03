# Preview vs PPTX parity: pptx.gallery values

Generated 2026-10-02T23:28:26.855Z by `dimension-audit/parity/scripts/parity.mjs` (Node v26.7.0, worktree prefix `parity`). No Office was used.

Heads: opf `5e1dda7`, opf-render `3b300a3`, opf-pptx `986d22b`, pptx-gallery `c349a61`.

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
| charts | 26 | 25 | 1 | 0 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 25/26 | 26/26 | 26/26 | 26/26 |
| **all** | 26 | 25 | 1 | 0 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 25/26 | 26/26 | 26/26 | 26/26 |

The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.

Picture crop-position check: 0 of 0 pictures measured; 0 unmeasured (preview image size unknown, reported as near).

## Before / after

Baseline heads: opf `5e1dda7`, opf-render `3b300a3`, opf-pptx `986d22b`, pptx-gallery `c349a61`.

| dimension | perfect before | perfect after | near before | near after | improved | regressed |
|---|---|---|---|---|---|---|
| charts | 10 | 25 | 16 | 1 | 15 | 0 |
| **all** | 10 | 25 | 16 | 1 | 15 | 0 |
### Checks passed, before and after (all values)

Baseline: the results file passed as the baseline (a run at the same heads when the two head lists match, so the difference is the harness). Each cell is the number of values that pass the check.

| check | before | after |
|---|---|---|
| geometry | 26 | 26 |
| text | 11 | 26 |
| fills | 26 | 26 |
| zOrder | 26 | 26 |
| slideSize | 26 | 26 |
| typefaces | 26 | 26 |
| reimport | 25 | 25 |
| fontResolution | 26 | 26 |
| theme | 26 | 26 |
| mapping | 26 | 26 |
| values | 26 | 26 |

## fontResolution definition change (owner decision 2026-09-29): old vs new, same run

Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.

| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| charts | 26 | 25 | 25 | 1 | 1 | 0 | 0 | 26 | 26 | 0 | 0 |
| **all** | 26 | 25 | 25 | 1 | 1 | 0 | 0 | 26 | 26 | 0 | 0 |

| check (all values, pass count) | old definition | new definition |
|---|---|---|
| geometry | 26 | 26 |
| text | 26 | 26 |
| fills | 26 | 26 |
| zOrder | 26 | 26 |
| slideSize | 26 | 26 |
| typefaces | 26 | 26 |
| reimport | 25 | 25 |
| fontResolution | 26 | 26 |
| theme | 26 | 26 |
| mapping | 26 | 26 |

### Selected families with only a visual-only replacement (near)

These 0 selected families render in the preview with a policy-table look-alike that is not metric-compatible (0 with the table's listed replacement, 0 with a listed alternate). Each needs a metric-compatible open replacement, or a supplied real face, to pass. "values" is the number of the 26 values that select the family.

| selected family | preview face | license class | route | values |
|---|---|---|---|---|

### Selected families that pass

| selected family | preview face | license class | route | values |
|---|---|---|---|---|
| Aptos | Intos | proprietary-standard | replacement | 26 |
| Aptos Display | Intos Display | proprietary-standard | replacement | 26 |
| Roboto Mono | Roboto Mono | open | real | 26 |

### fontResolution failures (new definition)

0 selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):

| reason kind | family-value failures |
|---|---|

| failing family | license class | policy route | values | reason |
|---|---|---|---|---|

## Top mismatch reasons per dimension

- **charts** (26): none

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| reimport \| slides.0 chart re-imports as column, expected world (chart-data-adapted reported) | 1 | charts/world |

## Preview font resolution (registry status, the old-definition view)

Families the traced preview uses plus the resolved design heading/body/code fonts, resolved against the office pack (plus base) with `substitutionPolicy:"visual"`. "Metric" follows the `FONT_COMPATIBILITY` policy in opf-render. This is the registry status the old definition gated on; the verdict under the new definition is in the section above.

| status | families | values affected | families (values) |
|---|---|---|---|
| real | 1 | 26 | Roboto Mono (26) |
| metric-substitute | 2 | 26 | Aptos Display→Intos Display (26), Aptos→Intos (26) |
| visual-substitute | 0 | 0 |  |
| missing | 0 | 0 |  |

26/26 values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).

## Package typeface inventory

Foreign `typeface=` values are those not used by the preview; they are listed by part, with the number of values affected:


Theme per-script supplements (`<a:font script=…>`) are listed separately and not gated: 43 distinct faces (游ゴシック Light, 맑은 고딕, 等线 Light, 新細明體, Times New Roman, Angsana New, Nyala, Vrinda, Shruti, MoolBoran, Tunga, Raavi, …).

## Re-running

```powershell
dimension-audit\parity\run.ps1                          # current worktrees -> parity-results.json + PARITY.md
dimension-audit\parity\run.ps1 -Update                  # move sources\parity-* to origin/main, rebuild, rerun
dimension-audit\parity\build.ps1 -Prefix pr123; dimension-audit\parity\run.ps1 -Prefix pr123 -Baseline dimension-audit\parity\parity-results.json -Out dimension-audit\parity\out\pr123.json
```

For a fix PR, create `sources\<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}` worktrees with the PR branch in the repo you changed and origin/main elsewhere. The report then adds a before/after table.
