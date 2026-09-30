# Preview vs PPTX parity: pptx.gallery values

Generated 2026-09-30T11:41:27.906Z by `dimension-audit/parity/scripts/parity.mjs` (Node v24.21.0, worktree prefix `parity`). No Office was used.

Heads: opf `26a1d82`, opf-render `a66caa3`, opf-pptx `6f6122c`, pptx-gallery `1f0e382`.

## Measurement notes (2026-09-30: the gallery font host)

This is the FF-38 re-run in which the harness models the host that pptx.gallery ships, instead of a host that loads no script faces.
Instrument change only: no tolerance changed, and every check other than fontResolution is identical in every value (checked value by
value against the run of the same worktrees with the harness as merged). Engines: core `3d51ba1` plus this change's harness commit `26a1d82`,
opf-render 0.11.3 `a66caa3`, opf-pptx `6f6122c` (a docs-only change over 0.11.2 `0400434`), pptx-gallery `1f0e382` (data-only over `b2238ac`).
The baseline of the tables below is that re-run with the harness as merged: 707 perfect, 47 near, 96 mismatch, fontResolution 733 pass,
31 near, 86 fail, identical to the published run [PARITY-2026-09-30-charts-measured.md](PARITY-2026-09-30-charts-measured.md).

**Scoreboard: 729 perfect, 108 near, 13 mismatch of 850** (was 707, 47, 96). fontResolution: 755 pass, 92 near, 3 fail (was 733, 31, 86).

### Did the harness model the real hosts? No

The 86 mismatches said "the script faces the modelled preview does not load". The harness resolved every family against one office-pack registry with
no script faces, on the reading that no shipped host loads them. The shipped host does, on demand and per document:

- The pptx.gallery editor is the opf-editor playground bundle. It builds a browser registry with `loadBrowserFontRegistry` from the office pack's
  eager faces (`substitutionPolicy: 'visual'`, `fallbackFamily: 'Roboto'`, `scriptBaseUrl`, `lazyFontsBaseUrl`; opf-editor
  `examples/playground.js`; `scripts/build-playground.mjs` copies every pinned script package and vendored face next to the page).
- opf-editor 0.10.1 added the font gate (`createFontGate`, `src/font-gate.js`, FF-41): before any document is rendered or measured
  (initial load, Source Apply, the gallery handoff, imports, undo, font and language switches) it runs `registry.ensureLazyFonts(document)` and
  `registry.ensureScripts(document)` until nothing is pending.
- opf-render 0.11.2 (FF-19) made those select the script faces a font scheme itself names, so a deck whose scheme is Meiryo or Mangal
  loads Noto Sans JP or Noto Sans Devanagari even for Latin text. In Node the same selection is `prepareNodeFonts({scripts: 'auto', presentation})`.

The harness (`scripts/font-host.mjs`) now runs those same calls on each value's own document, against the same package files (a stand-in for the
Font Loading API and for `fetch`; the renderer still hash-verifies every file), one registry per distinct load. That is a model of the
browser host in Node, not a browser: nothing is drawn. Because the editor's registry has `fallbackFamily: 'Roboto'`, a family it cannot
serve is drawn in Roboto without an error, which the classifier already reports as "unexpected fallback face". The check gained one more
condition, for a reason the earlier model could not show: the strict measured render (`renderSvgDeck` with the registry's text
measurement) must not throw, because a family can resolve to a face that cannot measure or shape its text.

`PARITY_FONT_HOST` selects the model, so each row of the table is repeatable on the same worktrees:

| model | what it loads | perfect | near | mismatch | fontResolution pass / near / fail |
| --- | --- | --- | --- | --- | --- |
| `office-only` (the previous model) | office pack, no script faces | 707 | 47 | 96 | 733 / 31 / 86 |
| `node-auto` | opf-render in Node, `prepareNodeFonts({scripts: 'auto', presentation})` | 729 | 105 | 16 | 755 / 89 / 6 |
| `gallery` (default, committed) | the browser registry and the editor's font gate | 729 | 108 | 13 | 755 / 92 / 3 |

### Before and after by dimension

Only three dimensions had fontResolution failures, all 86 of them; no other dimension changes.

| dimension | values | fontResolution before (pass / near / fail) | after (pass / near / fail) | perfect before to after | mismatch before to after |
| --- | --- | --- | --- | --- | --- |
| font-schemes | 89 | 11 / 18 / 60 | 33 / 54 / 2 | 11 to 33 | 60 to 2 |
| font-schemes-legacy | 4 | 3 / 0 / 1 | 3 / 0 / 1 | 3 to 3 | 1 to 1 |
| languages | 93 | 66 / 2 / 25 | 66 / 27 / 0 | 66 to 66 | 25 to 0 |
| all 850 | 850 | 733 / 31 / 86 | 755 / 92 / 3 | 707 to 729 | 96 to 13 |

Of the 86 failures, 83 were modelling artifacts and 3 remain as real gaps.

- **22 values become perfect** (font schemes only): the selected family is itself a pinned open Noto script family (21 families: Noto Sans JP, SC, TC, KR, Thai, Khmer,
  Ethiopic, Tamil, Telugu, Kannada, Malayalam, Oriya, Gurmukhi, Gujarati, Bengali, Devanagari, Hebrew, Armenian, Georgian, Noto Naskh Arabic (the family of two schemes) and
  Noto Nastaliq Urdu), and the host loads the real face. Noto Sans Mongolian resolves too but is one of the three remaining failures.
- **61 values become near** (36 font schemes and 25 languages): 38 selected families are proprietary script fonts (Microsoft YaHei, Meiryo, Malgun Gothic,
  Mangal, Arabic Typesetting, Sylfaen, Nyala and the rest in the family table below), and they now draw with the policy's Noto replacement. None is a
  metric-compatible replacement, so each is near by the owner's 2026-09-29 definition ("visual-only replacement"); the PPTX names the selected family in
  every one. Making any of them pass needs a metric-compatible open face or a supplied real face (FF-44).
- **3 values remain mismatches** (next section).

### What remains: 3 values

| value | family | host result | reason | tracker record, status | disposition |
| --- | --- | --- | --- | --- | --- |
| font-schemes/raleway | Raleway (open, OFL-1.1) | the editor draws Roboto (`fallbackFamily`, generic); Node throws `font-unavailable` | no pinned pack ships Raleway: it is not bundled because resvg ignores the `wght` axis of the variable file and the Reserved Font Name forbids renamed instances | Raleway, rank 32, `loading-gap`, phase 2 | real gap, FF-43 packaging (unmodified upstream static files) and FF-41 host proof; not changed here |
| font-schemes-legacy/classic-editorial | Playfair Display (open, OFL-1.1) | as Raleway | the same limitation (variable file, `wght` ignored) | Playfair Display, rank 31, `loading-gap`, phase 2 | real gap, FF-43 and FF-41; not changed here |
| font-schemes/noto-sans-mongolian | Noto Sans Mongolian (open) | the face loads and resolves, but `renderSvgDeck` throws `font-shaping-failed` (`Not a fixed size`) for every string | fontkit cannot decode the pinned 400 face (@expo-google-fonts/noto-sans-mongolian, Version 3.002): a versioned struct in its layout tables throws for Latin, digits and Mongolian text alike. The old check passed the family's resolution only because it never measured; in the editor the gate finishes and the render then errors | Noto Sans Mongolian, rank 38, `style-gap`, phase 2 (the record so far asked only about the missing 700 face; its next action now says so) | real gap, FF-44 (shaping corpus, per-family qualification): a face or shaping fix in opf-render |

### A difference between the hosts: Sylfaen in Node

Under `node-auto` three more values fail (font-schemes/sylfaen, languages/armenian, languages/georgian); the editor model passes them as near. Sylfaen's replacement is
Noto Sans (visual; alternates Noto Sans Georgian and Armenian). opf-render's Node loader always loads the Latin Noto Sans as a glyph-fallback face that serves
requests by its own name only, and `scripts: 'auto'` skips a package that is already loaded. So when the selection is `Latn` (a Sylfaen scheme with Latin text) Noto Sans stays fallback-only
and is never a replacement for Sylfaen: `font-unavailable`, "None of its replacements ... is loaded". The browser registry has no such filter, so the gate loads the package normally.
A small change in `loadOfficeFontRegistry` (`src/fonts-node.js`) leaves the scripts that `autoScriptSelection(presentation)` selects out of the fallback-only load. On the same
heads it makes all three values render in Node and leaves the rest as they were (183 of the 186 font-scheme and language values then render in Node; the other three are the gaps above):

```js
// before
const requested = scripts === undefined || scripts === "auto" || (Array.isArray(scripts) && !scripts.length) ? [] : scriptFontPackages(scripts).map(pkg => pkg.name);
// after (import autoScriptSelection from ./script-font-pack.js)
const requested = scripts === "auto" && presentation && typeof presentation === "object" ? scriptFontPackages(autoScriptSelection(presentation).scripts).map(pkg => pkg.name)
  : scripts === undefined || scripts === "auto" || (Array.isArray(scripts) && !scripts.length) ? [] : scriptFontPackages(scripts).map(pkg => pkg.name);
```

It is an opf-render change and needs a test of its own (a Sylfaen scheme with Latin text and `scripts: 'auto'`), so it is recorded against FF-19 and FF-44 and not made here. It does not move the
committed scoreboard, which models the gallery host.

### Families that changed (the 62 that failed before)

| family | license class | preview face now | tier | values |
| --- | --- | --- | --- | --- |
| Arabic Typesetting | proprietary-standard | Noto Naskh Arabic | visual | 4 |
| Mangal | proprietary-standard | Noto Sans Devanagari | visual | 4 |
| Sylfaen | proprietary-standard | Noto Sans | visual | 3 |
| Angsana New | proprietary-standard | Noto Sans Thai | visual | 2 |
| DaunPenh | proprietary-standard | Noto Sans Khmer | visual | 2 |
| David | proprietary-standard | Noto Serif Hebrew | visual | 2 |
| Gautami | proprietary-standard | Noto Sans Telugu | visual | 2 |
| Kalinga | proprietary-standard | Noto Sans Oriya | visual | 2 |
| Kartika | proprietary-standard | Noto Sans Malayalam | visual | 2 |
| Latha | proprietary-standard | Noto Sans Tamil | visual | 2 |
| Malgun Gothic | proprietary-standard | Noto Sans KR | visual | 2 |
| Meiryo | proprietary-standard | Noto Sans JP | visual | 2 |
| Microsoft JhengHei | proprietary-standard | Noto Sans TC | visual | 2 |
| Microsoft YaHei | proprietary-standard | Noto Sans SC | visual | 2 |
| Noto Naskh Arabic | open | Noto Naskh Arabic | real | 2 |
| Nyala | proprietary-standard | Noto Sans Ethiopic | visual | 2 |
| Raavi | proprietary-standard | Noto Sans Gurmukhi | visual | 2 |
| Shonar Bangla | proprietary-standard | Noto Sans Bengali | visual | 2 |
| Shruti | proprietary-standard | Noto Sans Gujarati | visual | 2 |
| Tunga | proprietary-standard | Noto Sans Kannada | visual | 2 |
| Vrinda | proprietary-standard | Noto Sans Bengali | visual | 2 |
| Aparajita | proprietary-standard | Noto Sans Devanagari | visual | 1 |
| Batang | proprietary-standard | Noto Sans KR | visual | 1 |
| BatangChe | proprietary-standard | Noto Sans KR | visual | 1 |
| DilleniaUPC | proprietary-standard | Noto Sans Thai | visual | 1 |
| FangSong | proprietary-standard | Noto Sans SC | visual | 1 |
| Gisha | proprietary-standard | Noto Sans Hebrew | visual | 1 |
| Gungsuh | proprietary-standard | Noto Sans KR | visual | 1 |
| GungsuhChe | proprietary-standard | Noto Sans KR | visual | 1 |
| Khmer UI | proprietary-standard | Noto Sans Khmer | visual | 1 |
| MingLiU | proprietary-standard | Noto Sans TC | visual | 1 |
| Miriam | proprietary-standard | Noto Sans Hebrew | visual | 1 |
| MS Mincho | proprietary-standard | Noto Sans JP | visual | 1 |
| Nirmala UI | proprietary-standard | Noto Sans Devanagari | visual | 1 |
| Noto Nastaliq Urdu | open | Noto Nastaliq Urdu | real | 1 |
| Noto Sans Armenian | open | Noto Sans Armenian | real | 1 |
| Noto Sans Bengali | open | Noto Sans Bengali | real | 1 |
| Noto Sans Devanagari | open | Noto Sans Devanagari | real | 1 |
| Noto Sans Ethiopic | open | Noto Sans Ethiopic | real | 1 |
| Noto Sans Georgian | open | Noto Sans Georgian | real | 1 |
| Noto Sans Gujarati | open | Noto Sans Gujarati | real | 1 |
| Noto Sans Gurmukhi | open | Noto Sans Gurmukhi | real | 1 |
| Noto Sans Hebrew | open | Noto Sans Hebrew | real | 1 |
| Noto Sans JP | open | Noto Sans JP | real | 1 |
| Noto Sans Kannada | open | Noto Sans Kannada | real | 1 |
| Noto Sans Khmer | open | Noto Sans Khmer | real | 1 |
| Noto Sans KR | open | Noto Sans KR | real | 1 |
| Noto Sans Malayalam | open | Noto Sans Malayalam | real | 1 |
| Noto Sans Mongolian | open | Noto Sans Mongolian | real | 1 |
| Noto Sans Oriya | open | Noto Sans Oriya | real | 1 |
| Noto Sans SC | open | Noto Sans SC | real | 1 |
| Noto Sans Tamil | open | Noto Sans Tamil | real | 1 |
| Noto Sans TC | open | Noto Sans TC | real | 1 |
| Noto Sans Telugu | open | Noto Sans Telugu | real | 1 |
| Noto Sans Thai | open | Noto Sans Thai | real | 1 |
| Playfair Display | open | Roboto | fail | 1 |
| PMingLiU | proprietary-standard | Noto Sans TC | visual | 1 |
| Raleway | open | Roboto | fail | 1 |
| Sakkal Majalla | proprietary-standard | Noto Naskh Arabic | visual | 1 |
| SimSun | proprietary-standard | Noto Sans SC | visual | 1 |
| Traditional Arabic | proprietary-standard | Noto Naskh Arabic | visual | 1 |
| Yu Gothic | proprietary-standard | Noto Sans JP | visual | 1 |

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
| fontResolution | For every family the selected design uses (owner decision, 2026-09-29; see below): **pass** when the PPTX names the selected family (theme major/minor for the heading/body fonts, run or chart slots otherwise) and the preview draws the real face (an open bundled family) or the FF-31 policy table's metric-compatible replacement. **near** when the PPTX names the selected family and the preview draws the policy table's route for it, but only at the visual look-alike tier ("visual-only replacement"; layout not guaranteed). **fail** when the family has no row in the policy table, the preview has no face for it, the preview draws a face that is not the table's route (an unexpected host, system or generic fallback), or the PPTX writes a replacement name instead of the selected name. The metric or visual tier is reported per family. Since 2026-09-30 the value must also pass the strict measured render with the registry of the modelled host: a value the host cannot draw (for example `font-shaping-failed`) fails. |
| theme | Theme major/minor latin equal the preview heading/body fonts, and the theme clrScheme equals the document colour scheme. |
| mapping | Every preview element group has PPTX shapes and the reverse. An unmapped PPTX shape counts as near. A slide-image picture with no preview slide image fails. |

fontResolution owner decision, 2026-09-29 (verbatim): "look-alike fonts are to get around any font licensing restrictions. They are desirable for open source but if we export to PowerPoint the pptx file should include references to the font they selected and want to see in PowerPoint." Refinement, later the same day (verbatim): "if the user wants Aptos... if Aptos is license restricted we can substitute a font (Aptos2 or whatever it's named) that looks similar and has the same size in pixels on the screen for rendering live previews of SVG. When we export to PPTX we should have PowerPoint open that file and display actual Aptos." So a look-alike is intended, the PPTX must keep the selected name, and the target look-alike is metric-compatible; a visual-only look-alike is policy-conformant but reported as near. Before this decision the check passed only for the real face or a metric-compatible substitute; that old definition is computed from the same run (`results[].legacy`) and compared below.

Modelled preview font host: the pptx.gallery editor (font-host.mjs). Its browser registry is built from the eager faces of the office pack with `substitutionPolicy:"visual"` and `fallbackFamily:"Roboto"`, and its font gate (opf-editor `createFontGate`) runs `ensureLazyFonts(document)` and `ensureScripts(document)` before the document is rendered, which loads the vendored preview faces (Intos, the open pack) and the script (Noto) faces that the text and font schemes of the value need. The same calls run here against the same package files (Font Loading API and fetch stood in for), one registry per distinct load. A family the loaded registry does not serve, or serves only through the generic fallback, fails fontResolution; so does a value whose strict measured render with that registry throws. This models the browser host in Node; no browser draws anything.
Classification: **perfect** means every check passes; **near** means only near deltas; **mismatch** means at least one check fails. Both engines use the default layout measurement (no host registry), so geometry is computed from the same composition.

## Per-dimension counts

| dimension | n | perfect | near | mismatch | geometry | text | fills | zOrder | slideSize | typefaces | reimport | fontResolution | theme | mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 0 | 0 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 | 14/14 |
| font-schemes | 89 | 33 | 54 | 2 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 89/89 | 33/89 (+54 near) | 89/89 | 89/89 |
| font-schemes-legacy | 4 | 3 | 0 | 1 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 3/4 | 4/4 | 4/4 |
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
| blocks | 32 | 21 | 8 | 3 | 32/32 | 29/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 24/32 (+8 near) | 32/32 | 32/32 |
| layouts | 485 | 483 | 2 | 0 | 485/485 | 483/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 | 485/485 |
| charts | 26 | 5 | 14 | 7 | 26/26 | 5/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 | 26/26 |
| **all** | 850 | 729 | 108 | 13 | 850/850 | 824/850 | 850/850 | 850/850 | 850/850 | 850/850 | 850/850 | 755/850 (+92 near) | 850/850 | 850/850 |

The check columns count values that pass that check (fontResolution also shows how many are near). A value is perfect only when every check passes.

Picture crop-position check: 425 of 425 pictures measured; 0 unmeasured (preview image size unknown, reported as near).

## Before / after

Baseline heads: opf `aedd364`, opf-render `a66caa3`, opf-pptx `0400434`, pptx-gallery `b2238ac`.

| dimension | perfect before | perfect after | near before | near after | improved | regressed |
|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 0 | 0 | 0 | 0 |
| font-schemes | 11 | 33 | 18 | 54 | 58 | 0 |
| font-schemes-legacy | 3 | 3 | 0 | 0 | 0 | 0 |
| languages | 66 | 66 | 2 | 27 | 25 | 0 |
| themes | 1 | 1 | 3 | 3 | 0 | 0 |
| narratives | 10 | 10 | 0 | 0 | 0 | 0 |
| audiences | 14 | 14 | 0 | 0 | 0 | 0 |
| tones | 7 | 7 | 0 | 0 | 0 | 0 |
| socials | 10 | 10 | 0 | 0 | 0 | 0 |
| backgrounds | 6 | 6 | 0 | 0 | 0 | 0 |
| backgrounds (withAssets) | 6 | 6 | 0 | 0 | 0 | 0 |
| image-treatments | 15 | 15 | 0 | 0 | 0 | 0 |
| image-treatments (withAssets) | 15 | 15 | 0 | 0 | 0 | 0 |
| headers-footers | 10 | 10 | 0 | 0 | 0 | 0 |
| headers-footers (withAssets) | 10 | 10 | 0 | 0 | 0 | 0 |
| blocks | 21 | 21 | 8 | 8 | 0 | 0 |
| layouts | 483 | 483 | 2 | 2 | 0 | 0 |
| charts | 5 | 5 | 14 | 14 | 0 | 0 |
| **all** | 707 | 729 | 47 | 108 | 83 | 0 |
### Checks passed, before and after (all values)

Baseline: the results file passed as the baseline (a run at the same heads when the two head lists match, so the difference is the harness). Each cell is the number of values that pass the check.

| check | before | after |
|---|---|---|
| geometry | 850 | 850 |
| text | 824 | 824 |
| fills | 850 | 850 |
| zOrder | 850 | 850 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 850 | 850 |
| fontResolution | 733 | 755 |
| theme | 850 | 850 |
| mapping | 850 | 850 |
| values | 850 | 850 |

## fontResolution definition change (owner decision 2026-09-29): old vs new, same run

Both columns come from the same run on the same heads. The old definition passes only the real face or a metric-compatible substitute. The new one is defined above. Every other check is identical under both, so the only difference is fontResolution and the classes that follow from it.

| dimension | n | perfect old | perfect new | near old | near new | mismatch old | mismatch new | fontResolution pass old | pass new | near new | fail new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| color-schemes | 14 | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 0 | 0 |
| font-schemes | 89 | 34 | 33 | 0 | 54 | 55 | 2 | 34 | 33 | 54 | 2 |
| font-schemes-legacy | 4 | 3 | 3 | 0 | 0 | 1 | 1 | 3 | 3 | 0 | 1 |
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
| blocks | 32 | 21 | 21 | 0 | 8 | 11 | 3 | 24 | 24 | 8 | 0 |
| layouts | 485 | 483 | 483 | 2 | 2 | 0 | 0 | 485 | 485 | 0 | 0 |
| charts | 26 | 5 | 5 | 14 | 14 | 7 | 7 | 26 | 26 | 0 | 0 |
| **all** | 850 | 730 | 729 | 16 | 108 | 104 | 13 | 756 | 755 | 92 | 3 |

| check (all values, pass count) | old definition | new definition |
|---|---|---|
| geometry | 850 | 850 |
| text | 824 | 824 |
| fills | 850 | 850 |
| zOrder | 850 | 850 |
| slideSize | 850 | 850 |
| typefaces | 850 | 850 |
| reimport | 850 | 850 |
| fontResolution | 756 | 755 |
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
| PT Serif | PT Serif | open | real | 1 |
| Times New Roman | Tinos | proprietary-standard | replacement | 1 |

### fontResolution failures (new definition)

2 selected families fail. Family-value failures by reason kind (a value with several failing families counts once per family):

| reason kind | family-value failures |
|---|---|
| preview uses an unexpected fallback face for | 2 |
| the modelled host cannot draw this value | 1 |

| failing family | license class | policy route | values | reason |
|---|---|---|---|---|
| Playfair Display | open | unrouted | 1 | preview uses an unexpected fallback face for Playfair Display: Roboto (not the policy route) |
| Raleway | open | unrouted | 1 | preview uses an unexpected fallback face for Raleway: Roboto (not the policy route) |

## Top mismatch reasons per dimension

- **color-schemes** (14): none
- **font-schemes** (89): fontResolution | preview uses an unexpected fallback face for Raleway: Roboto (not the policy route) (1); fontResolution | the modelled host cannot draw this value: font-shaping-failed (Noto Sans Mongolian), Not a fixed size (1)
- **font-schemes-legacy** (4): fontResolution | preview uses an unexpected fallback face for Playfair Display: Roboto (not the policy route) (1)
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
- **blocks** (32): text | text color 000000 vs 2874A6 (1); text | text color 000000 vs F77F00 (1); text | text color 000000 vs A41410 (1)
- **layouts** (485): none
- **charts** (26): text | chart preview text not in native chart cache (7)

## 20 most common mismatch patterns

| # | pattern (check \| reason) | severity | values | occurrences | example ids | sample |
|---|---|---|---|---|---|---|
| 1 | text \| chart preview text not in native chart cache | fail | 7 | 7 | charts/treemap [slides.0.chart]<br>charts/histogram [slides.0.chart]<br>charts/pareto [slides.0.chart] | Q1 2024  Q2 2024  Q3 2024  Q4 2024  Q1 2025  Q2 2025 |
| 2 | fontResolution \| preview uses an unexpected fallback face for Raleway: Roboto (not the policy route) | fail | 1 | 1 | font-schemes/raleway [Raleway] |  |
| 3 | fontResolution \| the modelled host cannot draw this value: font-shaping-failed (Noto Sans Mongolian), Not a fixed size | fail | 1 | 1 | font-schemes/noto-sans-mongolian |  |
| 4 | fontResolution \| preview uses an unexpected fallback face for Playfair Display: Roboto (not the policy route) | fail | 1 | 1 | font-schemes-legacy/classic-editorial [Playfair Display] |  |
| 5 | text \| text color 000000 vs 2874A6 | fail | 1 | 1 | blocks/pitch-deck-intro [slides.0.tag] | Pitch Intro |
| 6 | text \| text color 000000 vs F77F00 | fail | 1 | 1 | blocks/section-break [slides.0.tag] | Chapter 02 |
| 7 | text \| text color 000000 vs A41410 | fail | 1 | 1 | blocks/closing-cta [slides.0.tag] | Next Step |

## Near-only patterns (tolerable deltas)

| pattern | values | example |
|---|---|---|
| text \| chart label wrapped/split in preview (native chart lays out its own labels) | 14 | charts/column [slides.0.chart] |
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
| real | 32 | 848 | Roboto Mono (848), Open Sans (7), Montserrat (5), Poppins (3), Roboto (3), Noto Naskh Arabic (2), PT Serif (1), Noto Sans Armenian (1), Noto Sans Bengali (1), Noto Sans Devanagari (1), Noto Sans Georgian (1), Noto Sans Gujarati (1), Noto Sans Gurmukhi (1), Noto Sans Hebrew (1), Noto Sans JP (1), Noto Sans Kannada (1), Noto Sans KR (1), Noto Sans Malayalam (1), Noto Sans Mongolian (1), Noto Sans Oriya (1), Noto Sans SC (1), Noto Sans Tamil (1), Noto Sans TC (1), Noto Sans Telugu (1), Noto Sans (1), Noto Sans Thai (1), Noto Nastaliq Urdu (1), Noto Sans Ethiopic (1), Noto Sans Khmer (1), Bebas Neue (1), Lora (1), Merriweather Sans (1) |
| metric-substitute | 7 | 716 | Aptos Display→Intos Display (704), Aptos→Intos (704), Georgia→Gelasio (6), Arial→Arimo (3), Courier New→Cousine (1), Calibri→Carlito (1), Times New Roman→Tinos (1) |
| visual-substitute | 63 | 93 | Segoe UI Semibold→Red Hat Display (7), Segoe UI→Red Hat Display (7), Grandview→Barlow (5), Mangal→Noto Sans Devanagari (4), Arabic Typesetting→Noto Naskh Arabic (4), Arial Black→Montserrat (3), Grandview Display→Barlow (3), Sylfaen→Noto Sans (3), Impact→Anton (2), Seaford Display→Source Sans 3 (2), Seaford→Source Sans 3 (2), Tenorite Display→Figtree (2), Tenorite→Figtree (2), Microsoft YaHei→Noto Sans SC (2), Malgun Gothic→Noto Sans KR (2), Latha→Noto Sans Tamil (2), David→Noto Serif Hebrew (2), Vrinda→Noto Sans Bengali (2), Shruti→Noto Sans Gujarati (2), Tunga→Noto Sans Kannada (2), Kartika→Noto Sans Malayalam (2), Kalinga→Noto Sans Oriya (2), Raavi→Noto Sans Gurmukhi (2), Gautami→Noto Sans Telugu (2), Microsoft JhengHei→Noto Sans TC (2), Meiryo→Noto Sans JP (2), Angsana New→Noto Sans Thai (2), Shonar Bangla→Noto Sans Bengali (2), Nyala→Noto Sans Ethiopic (2), DaunPenh→Noto Sans Khmer (2), Consolas→Cousine (1), Lucida Sans→Work Sans (1), Segoe UI Semilight→Red Hat Display (1), Segoe UI Light→Red Hat Display (1), Tahoma→Red Hat Text (1), Trebuchet MS→Figtree (1), Verdana→Montserrat (1), Bookman Old Style→Libre Caslon Text (1), Century Schoolbook→Gelasio (1), Constantia→PT Serif (1), … |
| missing | 2 | 2 | Raleway→Roboto (1), Playfair Display→Roboto (1) |

756/850 values render only with the chosen font or a metric-compatible substitute (the old fontResolution pass).

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
