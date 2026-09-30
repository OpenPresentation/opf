# Dimension audit B: what in pptx.gallery works, per dimension

Heads (origin/main, detached worktrees `sources/audit-B-*`): pptx-gallery f17e9ae, opf 2634350, opf-render e500ed9, opf-pptx ef8a158, opf-editor 23bc65b. Node 24.21.0. No Office/COM was used.

**Method.** Each value uses the gallery's own "OPF Config" snippet: `lib/opf-snippets.ts` is bundled with esbuild and aliased to local core (`scripts/gen-snippets.mjs`). Each snippet then goes through `scripts/audit.mjs`:
1. core `validatePresentation` + `lintPresentation`;
2. core catalog lookup;
3. opf-render `renderSvgDeck` in three font modes: no registry (the SVG names the family and the host resolves it), the strict bundled base pack, and the office pack with visual substitution;
4. opf-pptx `toPptx`, followed by a full-package inventory: every `typeface=` including nested xlsx, script fonts, `lang`/`altLang`/`rtl`, theme clrScheme, slide srgbClr and bg, and app.xml;
5. `fromPptx` re-import;
6. for metadata dimensions, a consumption diff: the field is removed, and the SVG and PPTX parts are compared byte for byte.

`scripts/summarize.mjs` classifies the results. The raw data is in `out/raw-results.json`, the classified data in `results.json`, and the PPTX files in `out/pptx/`.

| dimension | n | classification |
|---|---|---|
| Color schemes | 14 | partial 14 |
| Font schemes (89 upstream) | 89 | partial 89 (preview tier: bundled 1, office-pack substitute 7, host-only 81) |
| Font schemes (gallery legacy) | 4 | partial 4 (not in the core catalog; the gallery inlines them) |
| Languages | 93 | schema-only 93 |
| Themes | 4 | partial 4 |
| Narratives | 10 | authoring-metadata 1, gallery-only 9 |
| Audiences | 14 | authoring-metadata 2, gallery-only 12 |
| Tones | 7 | authoring-metadata 7 |
| Socials | 10 | authoring-metadata 10 |

These gaps apply to every exported value:
- the theme clrScheme is the Office default (accent1 4472C4); only dk1/lt1 match, and only by coincidence;
- theme major/minor ea/cs are `""`;
- app.xml lists Arial and Calibri;
- every run is `lang="en-US"`, with no `rtl`;
- `fromPptx` keeps only `design.dimensions`, so colorScheme, fontScheme, theme, language, narrative, tone, audience, organization and speaker are dropped with no diagnostic;
- every re-import emits `heading-import-reflow`.

Per-dimension tables are in `color-schemes.md`, `font-schemes.md`, `font-schemes-legacy.md`, `languages.md`, `themes.md`, `narratives.md`, `audiences.md`, `tones.md` and `socials.md`.

## Preview vs export disagreements

- **Font schemes, with a substituting registry.**
  - With the office pack and `substitutionPolicy:'visual'`, preview renders Carlito, Cousine or Gelasio.
  - `toPptx` with the same options then **writes the substitute** into the theme and runs, so the chosen Aptos, Calibri, Consolas, Courier New, Georgia, Tahoma or Times New Roman is lost.
  - Seven schemes are affected, plus the `minimal` theme.
- **Font schemes, with the strict bundled registry.** Both preview and `toPptx` throw `font-unavailable` for 92 of 93 values; only `roboto` passes. Without a registry, export always succeeds and writes the chosen names.
- **Colors and theme backgrounds.** Preview and export agree slot for slot on the literal colours. The export theme clrScheme disagrees with both.
- **Languages.** Preview with no registry "succeeds" for CJK, Arabic and Indic text only because it does no glyph check. The strict pack fails:
  - `font-unavailable` for the language scheme;
  - `missing-glyph` on bundled Roboto for 26 scripts.

## Probe and classifier update (FF-36)

The heads, table and gap list above describe the original run. Since the
FF-36 audit update (heads in `results.json`):

- Slide colours resolve `a:schemeClr` through each slide's relationship chain
  (slide to layout to master to theme). The colour map is the slide
  `clrMapOvr`, else the layout `clrMapOvr`, else the master `p:clrMap`. The
  `p:bg` fill resolves the same way. An unresolved link is a reason
  ("export colour chain unresolved") in every dimension; nothing defaults to
  master 1 or theme 1.
- Socials: `handleInExport` searches slide, layout and master XML only, not
  the embedded `ppt/tags/opfDocument.xml`. A colour with child transforms (`lumMod`,
  `lumOff`, `tint`, `shade`, `alpha`) is reported as unresolved and never
  counts as agreeing.
- Colour schemes and themes compare preview and export scheme slots
  deck-wide and slide by slide, plus any resolved export colour the preview
  slide does not paint and the slide background. A literal `srgbClr` whose
  value is a scheme slot colour the document never writes literally is a
  reason.
- Languages are checked against the catalog `ooxmlLang`, `direction` and the
  font slot of the gallery's native name (the parity harness's script test):
  slide-run `lang`, `rtl` paragraphs against the preview's right-to-left
  lines, run and theme `ea`/`cs` faces, and re-import.
- Every reason is conditional on a measured field. `works` needs an empty
  reason list in every dimension. `sharedExportGaps` lists only the gaps that
  every export in the run shares.

## Charts (FF-36, 2026-09-30)

Audit B now also measures the 26 kept gallery chart ids (`charts.md`), using the gallery's own `buildChartOpfSnippet` (added to
`scripts/snippet-entry.ts`). `scripts/audit.mjs` (Charts) probes each snippet three ways, and `scripts/summarize.mjs` classifies:

- **Preview.** A traced render (`trace: true`): the chart group's `data-opf-chart` equals the id, the text is not "No chart data", the
  legacy single-series sketch is not what was drawn, and the marks match the data (bars, polylines, markers, areas, slices, points).
- **Export.** One chart part on slide 1 whose element, `barDir`, `grouping`, marker, `radarStyle` and `scatterStyle` equal the core
  catalog record's `mappings.openxml`; series values and category labels (an XY chart's X values) equal the source data; an embedded
  workbook; no `chart-data-adapted` diagnostic.
- **Re-import.** `fromPptx` returns one chart block with the same id and data.

A classic id with no reason is `works`; a chartex id (treemap, histogram, pareto, world, box-and-whisker, waterfall, funnel) is
`partial`: the preview keeps the legacy sketch, the export writes a clustered column chart and reports `chart-data-adapted`
(`chartex-fallback`), and re-import returns `column`. Parity (series colours, label text) is measured separately by the FF-38 harness.

## Preview font host (FF-48, 2026-09-30)

The three font modes in step 3 above are kept and recorded, but they are not how any shipped host renders. Audit B now classifies
font availability against the host model of the parity harness (`../parity/scripts/font-host.mjs`, `gallery` by default: the gallery
editor's browser registry and font gate on the value's own document) and the owner font policy (`../parity/scripts/font-availability.mjs`):
the preview draws a policy-table look-alike and the PPTX names the family the user selected is `works`. `scripts/audit.mjs` adds
`measure.hostFonts` (the host's gate and strict measured render, the FF-38 verdict per selected family, its reasons) to font schemes,
themes and languages, and a `host` verdict to the non-Latin text sample and to each language's native-name probe. `scripts/summarize.mjs`
turns only a `fail` verdict or an undrawable value into a reason. `AUDIT_FONT_HOST=strict` classifies from the strict measurements
instead (the earlier behaviour). It needs `dimension-audit/parity/` next to `B/`. Details: [../README.md](../README.md).
