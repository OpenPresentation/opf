# Font flow and switch-matrix map: design brief (2026-09-22)

This was a read-only investigation. No edits, pushes or Office runs.

**Heads read (origin/main):**
- opf `615e02e`
- opf-pptx `7b34f55` (#57 merged)
- opf-render `c8d7d5c`
- opf-editor `5620230`
- pptx-gallery `f17e9ae`

**Path abbreviations:**
- **P** = opf-pptx `src/index.js`
- **V** = opf-pptx `vendor/pptxgenjs/pptxgen.es.js`
- **C** = opf `packages/javascript/src/composition.ts`
- **S** = opf `spec/schemas/opf.schema.json`
- **R** = opf-render `src/svg.js`
- **G** = pptx-gallery

## 1. Switching operations: there is no dedicated API

| Operation | Public surface | Tests today |
|---|---|---|
| Any switch through the CLI | `opf edit` runs a generic RFC 6902 patch plus whole-document validation (cli `src/patch.ts:55-88`, `src/index.ts:163-173`) | `packages/cli/test/cli.mjs:45-59` |
| Catalog switch in the editor (fontScheme, colorScheme, theme, layout, narrative, language…) | `setCatalogId(editor,path,kind,id)`: an object value keeps its overrides and replaces only `id` (opf-editor `src/index.js:428-444,766-771`). `createCatalogSelect` (`:389-406`) | `test/component-smoke.mjs:41-57` covers **themes only**. Nothing calls `setCatalogId` for fontScheme |
| Gallery apply | `attachDefinition` inlines layout, font, color and theme records. **Font schemes are cut down to major/minor only** (opf-editor `src/galleries.js:164-170`), so a `code` role is dropped | none for fonts |
| Content-type change (bullets → cards, table, timeline, metric, quote or code) | No conversion API. Only block insert, duplicate and remove, plus `createContentBlock(kind)` (opf-editor `src/blocks.js:65-107`) | block tests only |
| Narrative, tone, audience | Top-level ids (S:183, :127, :64). They are text guidance only. "Choosing a narrative does not rewrite content" (`skills/opf-presets/SKILL.md:20`) | — |
| Language | Top-level `language` (S:107-125). **Neither the renderer nor the exporter reads it** (R has no reads; P has no `lang` or `language`) | — |
| Header and footer | `design.header` and `design.footer` zones (S:868-884, 1546-1597) | furniture workflow scripts |

**Resolution order.** Everywhere it is: slide design, then deck design, then theme, then default.
- Exporter: P:882-891 and per slide at P:1005-1011.
- Renderer: R:340-390.

The final default is `aptos` in every engine (FF-35: opf#124, opf-render#33, opf-editor#31, opf-pptx#64). Core exports `DEFAULT_FONT_SCHEME`, and pagination, the renderer, the editor and the exporter all fall back to it. At the time of this map (FF-06), the exporter fell back to `aptos` (P:151), while core pagination, the renderer and the editor fell back to `roboto` (C `pagination.ts:271`, R:230/359, opf-editor `src/index.js:20`), and editor transfer pinned `roboto` on import (`src/transfer.js:130-145`). A remaining Roboto literal for unknown schemes is tracked as FF-35b.

This only bites when a theme lacks a fontScheme. All four themes carry one: minimal=aptos, classic=tenorite, dark=seaford, bold=impact.

## 2. The 14 gallery dimensions

| Dim (count) | OPF field | Font or text effect | Preview | PPTX |
|---|---|---|---|---|
| Font schemes (89) | `design.fontScheme` (S:820; FontScheme S:1118-1168) | **Direct.** heading ← `heading.family`, else `major`. body ← `body.family`, else `minor`. code ← `code.family`, **else "Roboto Mono"** (C:25-33). `accent` is never read | per-role CSS family + one generic keyword (R:1203) | theme major/minor latin + every run's latin/ea/cs |
| Themes (4) | `design.theme` | **Indirect**, through the bundled fontScheme | same | same |
| Languages (93) | `language` | **Intended**: record gives a `fontScheme` (e.g. ja→meiryo, zh-Hans→microsoft-yahei, ar→arabic-typesetting, he→david, hi→mangal, th→angsana-new; G `data/languages.json`). **Actual: nothing applies it.** No `lang`, `rtl` or script slot is emitted | not read. No CJK, Arabic or Indic faces bundled. An unmappable glyph throws `missing-glyph` | every `lang="en-US"`, no `rtl` (the V:5920/5808 `lang`/`rtlMode` options go unused) |
| Layouts (485 gallery / 30 core) | `slide.layout` | which roles appear (title=heading, others=body) | composeSlide | same geometry |
| Content blocks (32) | slides only (gallery-only) | may add code, table or chart roles, which leak the code default | — | — |
| Charts (76) | `slide.chart.type` | chart part fonts | body (R:1103,1159) | see §3 row "chart" |
| Headers and footers (10) | `design.header/footer` | furniture text in the body style; date/number text | R:1191 | measured static text boxes, **not `p:hf`** (P:1335-1352; native `p:hf` intentionally deferred) |
| Color schemes (14), backgrounds (6), image treatments (15), socials (10) | `design.colorScheme` / `design.background` / image `fit` / `speaker.socials` | none (socials can add text) | — | — |
| Narratives (10), tones (7), audiences (14) | top-level ids | text only, author-driven | — | — |

**Catalog shape.**
- There are 89 font-scheme records: 29 latin, 16 ea, 44 cs.
- Each record has exactly one `languageFamily` and one `major`/`minor` pair.
- No record has role fields (`code` etc.), ea/cs slots or fallbacks.
- `consolas` and `courier-new` are `type:monospace`, yet code still resolves to Roboto Mono.

## 3. Where each font lands in the PPTX

| PPTX location | Value today | Controlled by |
|---|---|---|
| `theme1` major/minor `<a:latin>` | heading / body family (P:932-936 → V:6680-6681) | fontScheme |
| `theme1` major/minor `<a:ea>`/`<a:cs>` | **`""`**. Hard-coded in V:6682 | nothing |
| `theme1` `<a:font script=…>` (~45 per font) | Office 2013 script list: Yu Gothic, 等线, 新細明體, Times New Roman, Arial (Arab/Hebr/Viet), Mangal, Tahoma… (V:6682) | nothing |
| Slide runs `<a:latin/ea/cs>` | the same family in all three slots, `pitchFamily="34"` (V:5961; also for monospace). Families: body/heading/code/run `fontFamily` (P:1080, 1473, 1515) | fontScheme roles, `TextRun.fontFamily` |
| Code runs | `fonts.code` → **"Roboto Mono" unless inline `code.family`** (C:31) | fontScheme.code only |
| List `buFont` | marker family (P:1953) | body |
| Master `bodyStyle` buFont | `+mn-lt` (P:1974-1980, #57) | theme minor |
| Master, layout, notesMaster, `presentation.xml` `defaultTextStyle` | `+mn-lt/+mn-ea/+mn-cs`, `+mj-*` (V:6518, etc.) | theme, **so ea/cs resolve to ""** |
| `endParaRPr` (non-table) | no typeface → master → `+mn-*` | same |
| Table cell runs and `endParaRPr` | explicit body in latin/ea/cs (P:1288; V:6264-6266). `tableStyles.xml` is just a `def` GUID (V:6749) | body |
| Notes slide runs | `<a:rPr lang="en-US"/>` with no typeface (V:6525) → notesStyle `+mn-*` | theme |
| Chart axis and legend | latin = body (axis latin only; legend latin+cs, no ea) (P:1194-1201; V:3546-3548, 4471, 4579) | body |
| Chart **data labels** | **`Arial`**. `dLbls/txPr` is written for every non-radar series even though `showValue:false`; `dataLabelFontFace` is never passed (V:3700, 3815, 4104, 4235, 4323) | nothing |
| Pie chart dLbl | **hard-coded `Arial`**, 18 pt (V:4344) | nothing |
| Chart title / axis titles | `opts.fontFace ‖ 'Arial'` (V:4723-4729). Not emitted today because `showTitle:false` | — |
| Chart data table | `+mn-*` (V:3508-3510) | theme |
| Embedded chart xlsx | `styles.xml` `<name val="Arial"/>` and an xlsx theme with Calibri/Calibri Light (V:2975-2977) | nothing |
| `docProps/app.xml` "Fonts Used" | **Arial, Calibri** hard-coded (V:6430-6431) | nothing |
| Chart `txPr` post-process | P:1766 rewrites only `solidFill`, **not typefaces** | — |

**Observed.** An inventory of `font-variants-node24.pptx` (a pre-#57 baseline) shows:
- slides: only Roboto, Roboto Medium/SemiBold/ExtraBold, and Roboto Mono;
- master buFont: Arial × 9 (fixed by #57);
- theme ea/cs: `""`;
- app.xml: Arial and Calibri.

## 4. Gaps and risks, with the proposed fix layer

| # | Gap | Fix layer |
|---|---|---|
| G1 | Theme ea/cs are empty, and every `+mn-ea`/`+mn-cs` (master, notes, `defaultTextStyle`, `endParaRPr`, `.Text`-created runs) resolves to "", which is the likely Aptos source (H1 in `aptos-origin-brief.md`) | **opf-pptx** post-process: set theme major/minor ea/cs = the chosen heading/body family, or the scheme's ea/cs family when language demands it |
| G2 | Theme `<a:font script>` list names ~40 Office fonts | opf-pptx: drop the list, or keep it only for the declared language's script. Needs a native check of what `Presentation.Fonts` lists |
| G3 | Code falls back to Roboto Mono whatever the scheme | **core** C:31: fall back to `body`, or to scheme `type==='monospace'`. Add a `code` role to catalogs or a documented default. Also the **editor** `galleries.js:164-170` must keep `code` |
| G4 | Chart dLbls and pie labels are Arial | opf-pptx: pass `dataLabelFontFace: fonts.body` and rewrite `<a:latin typeface="Arial"/>` inside chart parts. Add ea/cs to axis `txPr` |
| G5 | Embedded xlsx is Arial/Calibri | opf-pptx `normalizeNestedZip` (P:2026): set styles font and xlsx theme to body. Low risk for `Presentation.Fonts` but strays in the package |
| G6 | `app.xml` says Arial, Calibri | opf-pptx: regenerate TitlesOfParts/HeadingPairs from the actual inventory |
| G7 | `language` is ignored: no `lang`/`altLang`, no `rtl`, ea/cs = the Latin family (so CJK in a Carlito deck falls back to PowerPoint font-linking, e.g. Yu Gothic, which is not embeddable-by-choice) | core: resolve `language.fontScheme` into an ea or cs role. opf-pptx: emit `lang` and `rtlMode`, and put the language scheme in the theme ea/cs + run ea/cs. The renderer needs script faces |
| G8 | `pitchFamily="34"` is written for monospace | opf-pptx: omit it or use 49 for monospace |
| G9 | Notes and `endParaRPr` have no explicit face | fixed by G1 (theme-level) |
| G10 | Default mismatch (aptos vs roboto). **Resolved** by FF-35 (opf#124, opf-render#33, opf-editor#31, opf-pptx#64); follow-up FF-35b | core: one exported `DEFAULT_FONT_SCHEME` |
| G11 | ecosystem-ci pins opf-pptx `fcc006a`, 16 commits behind (pre-#57) (`ecosystem-ci.yml:43`) | bump the pin with the matrix |
| G12 | Per-slide fontScheme overrides reach runs but not the theme, so placeholders and notes use the deck scheme | document it; the matrix must include a per-slide override |

## 5. Offline switch matrix

**Oracle.**
- Export, then unzip, including nested xlsx.
- Collect every `typeface=` except `+m?-*`, every `a:font script` (reported separately), `buFont`, xlsx `<name>`, and app.xml lpstr.
- Assert `set(explicit) ⊆ chosen roles ∪ {""→fail}`. Theme ea/cs must be non-empty after G1.
- Assert the preview SVG `font-family` set equals the same roles.
- Re-render after each patch, and diff so that only the switched dimension changes.

**Sampling.** Use a pairwise (2-wise) covering array over 14 factors, with level classes rather than every record:
- fontScheme: latin sans, latin serif, monospace, Google, ea, cs
- theme ×4
- language: en, ja, zh-Hans, ar, he, hi, th
- layout: ~6 archetypes
- content block: bullets, cards, table, timeline, metric, quote, code, chart
- chart: bar, pie, line, scatter
- header/footer: off, number, date, text
- plus 2 levels each for color, background, image, narrative, tone, audience and socials

A generated covering array is about 50-60 decks. Add fixed "must" cases:
- every content type × {Carlito, Consolas scheme}
- per-slide override
- inline `code.family`
- slide-mixed CJK in a Latin deck

Transitions: for each deck, apply the patch sequence A→B→A and check round-trip stability, plus a preview hash change.

**Native PowerPoint sample** (manual, Windows): 6 decks, namely Carlito-only with code+chart+table+notes, Aptos default, Meiryo/ja, Arabic Typesetting/ar with RTL, Consolas, and a per-slide override. Snapshot `Presentation.Fonts` (Embedded/Embeddable) and do a save-with-embed allowlist, reusing `native-font-embed.ps1` and its audit.

**Where it should live.**
- The oracle and the unit matrix go in **opf-pptx** (`test/font-inventory.mjs`, next to `master-bullet-font.mjs`; `export-corpus.mjs` already iterates `@openpresentation/opf/examples`). Fixes land there and the tests run against `src`.
- The cross-package matrix (core composition + render preview + pptx) goes in **core** `scripts/test-font-switch-ecosystem.mjs`, added to `test:fonts` (`package.json:16`). It should extend `test-font-ecosystem.mjs`, which today asserts every `a:latin` = Roboto (`:13-40`), and `test-office-fonts.mjs`.
- Core runs against pinned sibling SHAs, so the pin must move after each opf-pptx fix (G11).

## 6. Environment coverage

All four repos test on Node 24 only, and every package declares `engines: node 24.x`.

**CI by repo:**

| Repo | CI OS | Browser | Packed consumer | TS consumer typecheck |
|---|---|---|---|---|
| opf core | ubuntu (`opf-ci.yml:18`, `ecosystem-ci.yml:13` in the Playwright 1.63.0 container). windows + macos only in `cli-windows.yml:49`, path-filtered, no browser | ecosystem-ci (:71-115) | yes (`packed-install-smoke.mjs`; registry + tarball :96-104) | yes: `check-packed-types.mjs:62-70` (TS 5.9 and TS 7, NodeNext/Bundler), `test-packed-ecosystem.mjs:326-340` |
| opf-pptx | ubuntu container + **windows** (`ci.yml:15,28`) | `test:browser` (:113); Chromium on Windows (:111) | `test/packed-install.mjs` | only via core |
| opf-render | ubuntu container only | 7 suites (`ci.yml:83-91`) | yes | only via core |
| opf-editor | ubuntu container only | 3 suites (:79-83) | yes | only via core |

**Runtime claims:**
- Exports conditions are `types` and `import`/`default` only.
- opf-render has a nested `browser` condition, plus `./fonts-node` and `./fonts-browser`.
- opf-pptx `#image-fallback` has a browser/default split.
- No package has `node` or `worker` conditions.
- Nothing mentions Workers, Deno, Bun or edge.

**Host dependence:**
- **PPTX bytes do not depend on OS, locale or timezone.** Timestamp and ZIP date are fixed (P:55-59) and normalized for `core.xml` and the nested xlsx (P:1827, 2026). The seed is fixed. No host font lookup exists.
- **Two caveats:**
  - WebP→PNG uses sharp on Node but canvas in the browser, so those bytes differ.
  - **Exported typefaces depend on the caller's `textMeasurement` registry.** P:891 passes heading, body and code through `resolveStyle`, so a substituting registry (for example `loadOfficeFontRegistry({substitutionPolicy:'visual'})`, Calibri→Carlito) changes the family written to the PPTX. The matrix must pin the registry and record the substitution.
- **Preview:**
  - opf-render loads only bundled or caller-supplied fonts (`fonts-node.js:1,42`; `fonts-browser.js`; goldens use `systemFonts:false`).
  - Core uses `Intl.Segmenter("und")` (C:328, `pagination.ts:45`), so its output follows the runtime ICU version.
- **#24 residual:**
  - Linux Chromium measures 334.193 px against Source Serif SmText Bold's 334.062 px, and the gate is 0.1 px.
  - A rounding fix was rejected because it broke macOS (`docs/compatibility-matrix.md:319`).
  - CI only exercises Linux. macOS evidence is manual, and no gate compares Linux with macOS.

**Recommendation:**
- **Run on all three OSes, and in a packed TS consumer:**
  - the export typeface-inventory oracle (pure Node: cheap and deterministic, and it should be byte-identical across OSes, so hash the PPTX on each and compare);
  - the preview SVG font-family check with the bundled registry.
- **Linux container only:** raster/browser parity. Add a macOS job for `test:font-variants-browser` as a non-blocking #24 tracker.
- **Cheapest macOS additions:**
  - opf-pptx `ci.yml:28`: add `macos-latest` to the matrix and change `:111` to `runner.os != 'Linux'`.
  - opf-render: add a small `macos-latest` job running `npm ci && npm test` plus `test:font-variants-browser`.
- **Optional:** a Chromium module-worker smoke that imports `toPptx` and `renderSvg` from the packed tarballs. It would be the first evidence for worker/edge use.

## 7. Burndown linkage (FF-06 → FF-07..FF-12)

| Burndown item | Gaps it covers |
|---|---|
| FF-07 | G1, G7 (lang, rtl, ea/cs) |
| FF-08 | G2, G4, G5, G6, G8, G9 |
| FF-09 | §5 |
| FF-10 | §6 |
| FF-11 | §6 caveats |
| FF-12 | §5 native sample |

The remaining gaps are now burndown items:
- core code default and editor role loss (G3): FF-17
- default unification (G10): FF-17
- the language/script schema (per-script slots): FF-18
- renderer script faces and RTL: FF-19
- the sibling pin bump (G11): FF-20
- editor switch tests: FF-16
