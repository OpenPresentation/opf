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
