# Measured fonts and reproducible previews

For the starter set and delivery priorities, see the [font roadmap](plans/font-roadmap.md).

## Font policy (FF-31)

OPF keeps one machine-readable font policy table, [`spec/reference/font-policy.json`](../spec/reference/font-policy.json). Core exports it as `FONT_POLICY`, `fontPolicyFor()` and `applyFontPolicyDecisions()` from `@openpresentation/opf` or `@openpresentation/opf/font-policy`. Each row gives a family's license class, where viewers get it, whether OPF may ever embed it, and its preview replacement with a measured width difference. It also lists alternates, ending where possible with a face that already ships with opf-render. The [licensing table](programs/font-fidelity-everywhere/font-licensing.md) lists all 153 rows. [`font-policy.schema.json`](../spec/reference/font-policy.schema.json) is its JSON Schema. The [measurement evidence](evidence/font-replacements-20260923/README.md) explains how each replacement was chosen.

**The policy in brief (owner decisions, 2026-09-29).** This is the canonical statement; the sibling repositories link here.

1. **The user's font selection is the source of truth.** The user picks a font, for example Aptos or Calibri through a font scheme. That name is what the document, the theme and the PPTX carry.
2. **License-restricted (proprietary) fonts are never bundled or embedded,** so previews cannot draw them. Openly licensed fonts such as Carlito and Roboto are bundled, and "licensed" below always means license-restricted. Live previews, SVG, the editor and gallery thumbnails use an open look-alike instead. The goal is a replacement that looks similar and is metric-compatible (same advance widths and line metrics), so text occupies the same size on screen and wraps as it does in PowerPoint. Calibri→Carlito is the model.
3. **Where no metric-compatible open replacement exists yet,** a visual-only look-alike is a documented fallback. It is reported as visual and is a known layout-fidelity gap to close, not the intended end state. The parity scoreboard counts it as near, not perfect. The Aptos family is no longer such a case: Intos previews it as metric.
4. **PPTX export always writes the selected font name,** for example `typeface="Aptos"` in the theme and in runs, never the replacement. PowerPoint then opens the file and shows the actual font, installed or as a Microsoft 365 cloud font.
5. **Only open fonts may be embedded,** through the explicit embed path (FF-13).
6. **Font files are bundled, never hotlinked.** Fonts, Google Fonts included, ship as pinned files (an exact npm version, or a vendored file with a recorded sha256) and are never loaded at runtime from a font CDN. That protects visitor privacy (a German court held the Google Fonts CDN a GDPR violation in 2022) and keeps previews offline-capable and audits reproducible. Build-time self-hosting such as `next/font/google` is not a hotlink but is not pinned, so use `next/font/local` with pinned files. Guards fail on CDN references in every repository.
7. **Every bundled face records a verified permissive license.** Allowed: exactly OFL-1.1, Apache-2.0, MIT and UFL-1.0; not GPL, LGPL, AGPL, proprietary or unclear public-domain fonts. The record has the SPDX id, any Reserved Font Name the copyright block declares, the source URL, package@version and sha256, all checked against the LICENSE file the font ships with. A modified version (subset, instance, conversion) may not use a Reserved Font Name in its name: a family whose served name contains its reserved name (Carlito, Raleway) is bundled only as the unmodified upstream file, while one that reserves another name (Noto Sans JP reserves "Source") may be modified. Details and enforcement: [Font files: bundling and licenses](programs/font-fidelity-everywhere/font-licensing.md#font-files-bundling-and-licenses).

**Release status.** Point 4 is published: opf-pptx 0.10.0 and later (current 0.13.2) write the selected name into the PPTX, and the editor and pptx.gallery builds that depend on the release-plan set export it. opf-pptx 0.9.1 and earlier wrote the substitute.

**Provisional owner decisions (provisional, owner may revise).** Three choices about which open face stands in for a family are pending with the owner. The policy above is settled; only these replacement picks are provisional. Root resolved them provisionally with the recommended defaults:

| Decision | Families | Replacement |
| --- | --- | --- |
| `aptos-preview` | Aptos (the default `aptos` scheme) | Intos (metric, owner policy 2026-09-29; Roboto and Carlito are alternates) |
| `segoe-ui-preview` | Segoe UI, Semibold, Light and Semilight | Red Hat Display (visual) |
| `cambria-tier` | Cambria | Caladea, reclassified from metric to visual. Its `metricModeFallback` keeps metric-mode registries previewing Cambria with Caladea, reported as visual, as they did before FF-31. |

All three live in one block, `provisionalDecisions`, at the top of the JSON. The rows that follow a decision carry no replacement family of their own. A change of decision is therefore a one-line edit. When a decision changes, a stored measurement of the old family is dropped as unmeasured until `scripts/measure-font-replacements.mjs` is run again.

1. **Licensed, non-free fonts are never bundled or embedded.** This covers Aptos, Calibri, Cambria, Segoe UI, Georgia, Tahoma, Grandview, Seaford, Tenorite, Consolas, Times New Roman, Arial, Courier New and the Windows script fonts. Rendering uses the family's designated open replacement instead:
   - **Metric-compatible** is the goal, used where a replacement exists and measures identical: Calibri→Carlito, Arial→Arimo, Times New Roman→Tinos, Courier New→Cousine and Georgia→Gelasio. A metric row needs an upstream statement and a measurement in all four styles, with a mean width difference below 0.1% and no corpus string more than 0.3% off. Georgia→Gelasio passes only with Gelasio shaped with its `liga` and `clig` features off (the row lists them as `disabledFeatures`): with default features Gelasio ligates fi, fl, ffi and ffl, which Georgia does not, and runs differ by up to 1.02%. With them off every one of the 300 corpus strings matches in all four styles (mean and maximum below 0.01%). opf-render turns those features off in measurement and in SVG, so a renderer that does not is visual against Georgia.
   - **Size adjustment** (RR-38): a visual replacement whose advances and glyphs are far from the real font's can carry `sizeAdjust`, a preview-only font-size multiplier. A renderer scales the replacement's size by it when it measures and when it draws, so lines have the length PowerPoint's have; core's composed geometry, the exported sizes and every PPTX are unchanged. Arabic Typesetting→Noto Naskh Arabic is 0.64 (the real font's advances are 0.643 of the replacement's over the Arabic corpus; its ink height is 0.71, so glyphs draw about 10 percent smaller than PowerPoint's). It applies only when the face drawn is the row's replacement. `lineAscent` and `lineAscentMixed` (em; Arabic Typesetting 0.70 and 0.78, measured in a native PowerPoint 365 probe against the font's hhea ascent of 0.701) say where PowerPoint puts the baseline below the top of a line box, for a line in the real font alone and for a line that also holds other fonts; a renderer that puts baselines one em below the line top moves such runs up by `1 - lineAscent` em.
   - **Alternates** are tried, in order, when the declared replacement's pack is not loaded. An alternate is always reported as visual, including on a metric row.
   - **Aptos family:** Aptos→Intos, Aptos Display→Intos Display, Aptos Narrow→Intos Narrow and Aptos Serif→Intos Serif are metric: 0.000% mean and maximum against Aptos 2.01 in all four styles, with equal vertical metrics.
   - **Otherwise the closest measured open face**, marked visual: a documented fallback and a known layout-fidelity gap until a metric-compatible replacement exists. For example, Segoe UI→Red Hat Display measures a 1.72% mean width difference.
2. **The PPTX always names the chosen family, and no font file is included.** The exporter writes `Aptos` when the document chose Aptos. PowerPoint resolves standard fonts on the viewer's machine: those shipped with Office, Windows or macOS, and Microsoft 365 cloud fonts. The replacement never reaches the package (opf-pptx `test/export-chosen-fonts.mjs`).
3. **Openly licensed fonts render as themselves.** Examples are Roboto, Carlito and the Noto script families. They can reach a PPTX only through an explicit embed path (FF-13), never by default.
4. **Families that are proprietary and non-standard, or missing from the table,** keep their name in the PPTX. `fontAvailabilityDiagnostics()` reports that viewers may lack them. It also flags Microsoft 365 cloud-only fonts (such as Aptos) and families that ship only in an optional Windows language feature.

### Which faces are available

opf-render ships only fonts that it already pins and hash-verifies:
- **Base pack:** Roboto and Roboto Mono.
- **Office pack:** Carlito, Caladea, Arimo, Tinos, Cousine and Gelasio.
- **Office pack, Aptos family:** Intos, Intos Display, Intos Narrow and Intos Serif (OFL-1.1, vendored in opf-render at a pinned commit, unmodified from the upstream files). A registry built without them (for example the base pack alone) falls back to the alternates Roboto and Carlito, reported as visual.
- **Optional `scripts` pack (FF-19):** Noto for non-Latin scripts and CJK.

Some replacements are open families that no renderer pack ships yet, such as Red Hat Display for Segoe UI and Red Hat Text for Tahoma. For these, the renderer tries the declared replacement first, then the alternates. The last alternate is the best measured bundled face, so previews stay deterministic without any extra download. `registry.substitutions` records which face was used and its tier. The proposed `catalog` pack (21 OFL `@expo-google-fonts` packages, listed in the opf-render PR) would make the declared replacements and the open catalog families available. Downloading it needs approval, and it is not part of this change.

| Environment | Open catalog families | Proprietary families | When the real font is required |
| --- | --- | --- | --- |
| Local Node, cloud or serverless (`loadFonts({pack: 'office', substitutionPolicy: 'visual'})` from `/fonts-node`) | Exact when a pack ships them (Roboto, Carlito, …, Noto with `scripts`) | Metric replacement: identical widths. Visual replacement: approximate, reported in `fonts.substitutions` with the measured delta | Supply licensed files with `loadFonts({faces: [{path, family, weight, italic}]})`; they resolve as exact faces |
| Strict mode (`substitutionPolicy: 'metric'`) | Exact | Metric replacements only | `font-unavailable` names the license class, the declared replacement and tier, the pack, and the caller hook. There is never a silent wrong-metric fallback |
| Browser (`loadFonts` from `/fonts-browser`) | Exact when the host serves the pack files | Same replacement rules | Same hook: pass the caller's own faces |
| PowerPoint (exported PPTX) | Named; the viewer needs the font or substitutes | The selected name, never the replacement: the real font on Office, Windows or macOS, or through Microsoft 365 cloud fonts | Named; the viewer substitutes |

**Aptos, the default scheme.** Aptos is a Microsoft 365 cloud font and is not redistributable. Under the owner policy of 2026-09-29 it previews with Intos, an OFL font whose advance widths, kerning and vertical metrics equal Aptos 2.01: 0.000% mean and maximum width difference over the 300-string corpus in regular, bold, italic and bold italic, for Aptos, Aptos Display, Aptos Narrow and Aptos Serif (Aptos Serif measured from Microsoft's standalone Aptos Fonts download, the others from the Microsoft 365 cloud fonts). Line breaks, line heights and text sizes therefore agree with Aptos. The letter shapes are Intos's own (Inter-derived, Gelasio-derived for the serif), not Aptos's. The exported PPTX still names Aptos, Aptos Display, Aptos Narrow or Aptos Serif, and no Aptos file is bundled or embedded. Deployments that hold an Aptos license can pass the real files through `faces` for exact previews.

Intos ships in opf-render's default office pack (`loadFonts({pack: 'office'})`), about 12 MB of font files, so the default metric policy previews the Aptos family without asking for visual mode. Without those faces, previews fall back to the alternates Roboto and Carlito, marked visual. Like the open families, Intos is an `embed: "used"` face: `registry.embeddedFonts` stays the 33 eager npm faces, the handle's `embeddedFonts` supplies it, and a standalone SVG embeds only the Intos faces its text draws (an Aptos slide: Intos regular and Intos Display bold, 14.7 MB with the eager faces, against 20.7 MB with all eight styles). Intos is a single-maintainer project started in September 2026, so it is pinned by commit and SHA-256 and the previous replacements stay as alternates. The pptx.gallery parity scoreboard's `fontResolution` check counts the Aptos family as perfect because the replacement is metric-compatible.

**Browser hosts load the vendored faces on demand.** The eager list is what a host puts in one `fonts.json` (12.6 MB); the vendored faces (Intos and the open families, `registry.lazyFonts`, 51 faces) would add 19.4 MB, so they ship as separate hash-pinned files at their package-relative paths (`fonts/intos/...`, `fonts/<family>/...`) and load through `loadFonts({faces, lazyFontsBaseUrl})` from `/fonts-browser`. `await fonts.ensure(presentation)` (the registry's `ensureLazyFonts` and `ensureScripts` are the lower-level calls) fetches and verifies only the faces the document draws (renderer 0.11.5, face level: a plain Aptos deck needs Intos Display Bold and Intos Regular, 2 files, 1.5 MB; an italic or bold run adds one face; before 0.11.5 it was every face of the resolved families, 8 files, 5.9 MB), then adds them to the document and the registry together, so the editor never measures with a face it paints as a fallback. The gallery commits only a pinned manifest, `lazy-fonts.json` (`scripts/gallery-lazy-fonts.mjs`, written by `build-registry-gallery-editor` from the published renderer's manifest when the pinned editor example sets `lazyFontsBaseUrl`, and copied by `prepare-gallery-editor`): exact renderer version, SPDX license, license-file hash and every face's SHA-256, no bytes. The gallery's own build copies the faces from the pinned renderer package's `fonts/` directory into an untracked path, verifying each hash, the way it does for script fonts. The local editor demo (`build-editor-demo`, through `scripts/emit-lazy-fonts.mjs`) copies the files beside the page instead. The editor playground calls `fonts.ensure(presentation)` when a document needs them. `node scripts/test-editor-lazy-fonts.mjs` drives the built playground in Chromium.

The [Windows reference-font advance study](evidence/shared-metric-native-anchor/font-study-comparison.json) is exploratory source-checkpoint evidence, not an additional compatibility certification. It measures 1,024 cases across regular/bold Calibri, Arial, Times New Roman and Courier New, recording local reference-file versions/hashes and native font-slot names. Disabling optional ligatures and rounding base glyph advances to eighth-point steps predicts 949 observations within 0.02pt; 75 outliers remain, including combining marks, Arabic and Calibri kerning. Office theme tokens and per-glyph fallback are not resolved to exact native files by these name properties. No runtime provider or open-font mapping changes from this hypothesis, and no reference font is redistributed.

The composition API accepts a `textMeasurement` provider. A provider resolves font faces and returns actual text widths; callers pass the same provider to pagination (as `{ fonts: { textMeasurement } }`), editor geometry, SVG rendering, and PPTX export. Without one, the existing deterministic character-width estimate remains available.

`loadFonts(options)` from `/fonts-node` returns the fonts handle: the same registry measurement (`textMeasurement`), the faces to embed in SVG (`embeddedFonts`) and the explicit raster files (`fontFiles`), with system and bundled fallback disabled for raster calls (`useBundledFonts: false`, `loadSystemFonts: false`). Pass it as `{ fonts }` to every deck-level call: `paginate`, editor geometry, `renderSvg`, `renderSlideSvg`, `toPptx`, `svgToPng` and `svgToPdf`. `pack: 'base'` is the default for authored Roboto decks; `pack: 'office'` adds the six Office substitute families and retains metric policy unless visual substitution is explicitly requested. `fonts.substitutions` records actual substitutions; the loader does not rewrite the authored document or add native embedding.

Renderer 0.8.0 groups static files by their OpenType preferred family while retaining legacy family names and explicit custom namespaces. `Roboto` requests at 500/600/800 now select the actual Medium/SemiBold/ExtraBold files instead of nearby 400/700 faces. Optional `TextStyle.fontFace` carries the physical legacy family and native bold/italic flags independently of CSS numeric weight: SemiBold/ExtraBold are regular within their legacy families. The converter consumes this metadata; providers without it retain their prior behavior. Nine actual base faces pass metadata/measurement/outline checks and offline Chromium advances on Node 20/24. Seven payload slides cover serialized native selectors, deterministic output and source/reimport. These checks do not establish native Office paint, embedding or broader script coverage; see the [Mac candidate evidence](evidence/mac-font-variants/README.md).

Renderer 0.8.0 uses adjacent SVG spans when no measurement provider is supplied. This closes the visible gaps caused by estimated fragment widths while retaining estimated line breaks and all run text/style/source offsets. Supplied providers and accepted placements still use exact fragment origins. Measured SVG requests geometric precision; accepted outline placements also constrain horizontal advances with `textLength`/`spacingAndGlyphs` to avoid browser quantization drift. This can scale glyphs horizontally while retaining nominal font size and baseline. Width-only providers do not receive that constraint, and constrained widths do not certify raw font-metric equivalence. The compatible editor supports both forms. This is a spacing improvement, not evidence that unmeasured wrapping or glyph coverage is accurate; see [candidate evidence](evidence/mac-rich-flow/README.md).

Both Node loaders verify exact package versions, 33 font-file hashes and eight license-notice hashes against the immutable `BUNDLED_FONT_MANIFEST` exported from `/fonts-node`. The office loader also verifies the vendored faces: the Carlito files, the 35 open-family files and the 16 Intos files, with the hashes of their licenses and, for Intos, its provenance notice. Missing/modified resources reject with actionable errors. Default raster loading now includes all nine base faces instead of omitting Roboto semibold, italic and bold italic. Font files must remain available and unchanged between preparation and raster export. Browser loading, actual glyph coverage, variant naming, rich spacing, and native compatibility remain separate requirements. These APIs are available in [renderer 0.8.0](https://github.com/OpenPresentation/opf-render/releases/tag/opf-render-v0.8.0), published against core 0.10.0 with Node 24. Prepared HarfBuzz shaping and variable-instance work remain separate drafts.

The renderer's optional font registry uses [Fontkit](https://github.com/foliojs/fontkit) to shape text and measure glyph advances from local font bytes. It does not discover system fonts or fetch fonts. The Node loader loads the renderer's bundled Roboto and Roboto Mono faces:

```js
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { renderSlideSvg, svgToPng } from '@openpresentation/opf-render';
import { paginate } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts(); // pack: 'base', the bundled Roboto faces
// Use design.fontScheme: 'roboto', or supply the document's actual font files.
const { presentation } = paginate(deck, { fonts });
const svg = renderSlideSvg(presentation, 0, { fonts }); // embeds the faces it draws
const png = await svgToPng(svg, { fonts }); // draws with fonts.fontFiles only
const pptx = await toPptx(presentation, { fonts });
```

`loadFonts({ faces })` (from `/fonts-node` or `/fonts-browser`) accepts `{data: Uint8Array, weight, italic?, family?, postscriptName?, license?}` entries in Node or the browser, and `{path}` entries in Node. Weights are explicit, with 400 as the default. Supply each style that the document uses. Missing font families and unsupported glyphs fail with `OPFFontError`, including the source path where available. Collection fonts require a `postscriptName` selecting one face.

Aliases and fallback families are explicit choices:

```js
const fonts = await loadFonts({
  pack: 'none', faces,
  aliases: { Aptos: 'Roboto', 'Aptos Display': 'Roboto' },
  fallbackFamily: 'Roboto',
});
console.log(fonts.substitutions);
fonts.registry.clearSubstitutions(); // Start a fresh render's diagnostic collection.
```

An available exact family takes precedence over aliases. The registry resolves a requested weight to the closest supplied weight, reports the substitution, and makes the resolved style available to rendering. Missing italic/upright styles fail instead of synthesizing an unmeasured style. `strictGlyphs: false` is an explicit escape hatch for hosts with their own glyph-fallback policy; it is unsuitable for fidelity verification.

SVG embeds supplied fonts using data URIs and includes supplied license notices as metadata. The bundled loader carries the fonts' SIL Open Font License notices. For PNG/PDF, pass the same font files to the rasterizer; its native font loader does not depend on browser CSS font loading. In a browser, wait for `document.fonts.ready` before measuring or taking a screenshot. The editor playground loads and embeds bundled fonts and displays substitutions.

`svgToPdf` in renderers up to 0.11.9 was image-only: each slide was rasterized and embedded as a PNG on a PDF page. From opf-render 0.12.0 (opf-render#90, [roadmap](plans/pdf-export.md)) the default `mode: "vector"` writes PDF text objects in embedded TrueType subsets of the fonts you supply or the bundled open pack (the same files the PNG preview uses; system fonts are rejected, a face whose OS/2 `fsType` forbids embedding is never embedded, the report names requested and resolved faces), with `ToUnicode` maps and `/ActualText` where the glyph map cannot give the text, vector shapes, gradients and images, and no second layout pass. `mode: "raster"` keeps the image-per-slide output as an explicit compatibility mode. Extraction was checked in pdf.js, PDFium and poppler on Latin, CJK, right-to-left and Indic samples and all 805 example slides; PDFium misreads some Thai and Burmese marks, as it does in Chrome's own PDFs. No PDF/UA or PDF/A claim.

## Office compatibility pack

`loadFonts({ pack: 'office' })` from `@openpresentation/opf-render/fonts-node` supplies regular, bold, italic, and bold italic faces of Carlito, Caladea, Arimo, Tinos, Cousine, and Gelasio, plus the base Roboto pack. Package versions are pinned and each face carries its distribution's license notice. `includeBaseFonts: false` omits Roboto. Loading never installs fonts into the operating system or downloads fonts at render time.

```js
const fonts = await loadFonts({
  pack: 'office',
  substitutionPolicy: 'metric', // Default for the office pack; no visual fallback.
});
fonts.registry.resolveFont({fontFamily: 'Calibri', fontWeight: 400});
// requestedFamily: Calibri, resolvedFamily: Carlito, compatibility: metric
```

`loadFonts` defaults to `substitutionPolicy: 'none'` (the office pack to `'metric'`). Policies are `none`, `metric`, and `visual`; visual permits both curated tiers. An explicit `fallbackFamily` is a separate, reported `generic` fallback. Aliases are explicit visual substitutions and never establish metric compatibility. `resolveFont` reports exact resolutions as well; `substitutions` only collects changes. Resolution records include requested/resolved weights, italic, source path, and supporting upstream information where available.

| Requested family | Bundled substitute | Current automatic tier |
| --- | --- | --- |
| Calibri | Carlito | Metric intent, standard 400/700 styles |
| Cambria | Caladea | Visual: advances differ from Cambria 6.99 by a mean of 2.7% (FF-31 measurement). Metric-mode registries still use it, reported as visual (`metricModeFallback`) |
| Arial | Arimo | Metric, standard 400/700 styles |
| Times New Roman | Tinos | Metric, standard 400/700 styles |
| Courier New | Cousine | Metric, standard 400/700 styles |
| Georgia | Gelasio | Metric with `liga` and `clig` off (`disabledFeatures`, applied by opf-render): advances identical on all 300 corpus strings in four styles. With default features, ligature runs differ by up to 1.02% |
| Calibri Light | Carlito | Visual: the bundle has no Carlito Light face |
| Aptos, Aptos Display, Aptos Narrow, Aptos Serif | Intos, Intos Display, Intos Narrow, Intos Serif (office pack) | Metric: 0.000% mean and maximum against Aptos 2.01, all four styles; Roboto and Carlito are visual alternates |

Upstream evidence: [Carlito](https://github.com/googlefonts/carlito), [Fontconfig mappings](https://chromium.googlesource.com/external/fontconfig/+/refs/heads/main/conf.d/30-metric-aliases.conf), [Arimo](https://github.com/google/fonts/blob/main/ofl/arimo/DESCRIPTION.en_us.html), [Tinos](https://github.com/google/fonts/blob/main/ofl/tinos/DESCRIPTION.en_us.html), [Cousine](https://github.com/google/fonts/blob/main/ofl/cousine/DESCRIPTION.en_us.html), and [Gelasio](https://github.com/SorkinType/Gelasio). Metric classification describes compatibility intent within the stated style scope, not universal identical output. Missing matching weights cannot silently qualify for the metric tier.

RR-17: Liberation Sans, Serif and Mono are not bundled (Reserved Font Name, about 4.4 MB); a document that names them previews with Arimo, Tinos and Cousine, the Croscore faces Liberation 2 is built from (metric, 0.0000% in four styles). Each Latin replacement has a per-family qualification (`scripts/qualify-latin-fonts.mjs`) and a fixture in every host; see the [font tracker](programs/font-fidelity-everywhere/font-tracker.md).

The exported `FONT_COMPATIBILITY` list also contains optional visual candidates and CJK families. Listing a candidate does not bundle it or imply complete character coverage. Liberation Sans Narrow is a separate legacy distribution with a different license history; it is not part of this bundle. Wingdings, Webdings, and Symbol require character mapping before substitution; an ordinary fallback fails with `font-encoding-required`. Cambria Math previews with STIX Two Math and Segoe UI Emoji with Noto Color Emoji once opf-render's optional math and emoji packs are loaded (FF-45, [special families: emoji and math](programs/font-fidelity-everywhere/special-families-emoji-math.md)); without the pack a renderer reports `font-unavailable` naming it, like any other routed family (the former `math-font-required` failure is gone). OPF has no equation model: a Cambria Math run is text drawn per character in a math face, not MATH-table layout.

DrawingML tokens such as `+mn-lt` resolve through the registry's explicit `themeFonts` option before substitution. Supply concrete `majorLatin`, `minorLatin`, and, where used, `majorEastAsia`, `minorEastAsia`, `majorComplexScript`, or `minorComplexScript` families. Missing theme mappings fail. This helper does not yet extract theme font records or embedded fonts from imported PPTX files.

### Measured results and experimental fonts

`node --import ./scripts/register-local-opf.mjs scripts/test-office-fonts.mjs --system` compares the bundle to reference fonts already installed in macOS's Supplemental directory. It does not redistribute reference fonts. The report records source-file hashes and individual shaped widths. Across four samples and four styles, Arimo/Arial, Tinos/Times New Roman, and Cousine/Courier New matched exactly on 48 runs. Gelasio/Georgia differed on ligature-containing runs, with a maximum difference of 2.0125%. Individual basic-Latin advances matched; disabling optional ligatures removed the tested difference. Until feature handling is consistent across outputs, the policy conservatively labels Gelasio approximate. Calibri and Cambria reference fonts were not available for this comparison.

Akasia, assessed earlier ([v0.0.2 open-file assessment](evidence/akasia-assessment/README.md)), is dropped: its repository is no longer available, and Intos replaces it. `EXPERIMENTAL_FONT_CANDIDATES` now records Microsoft's Selawik, measured for Segoe UI on 2026-09-29 and rejected: 0.16% mean and 2.5% maximum in regular, no italic faces, 349 code points, lowercase 4.8% shorter. The acceptance rules for replacement fonts are in the [licensing table](programs/font-fidelity-everywhere/font-licensing.md#replacement-font-acceptance-rules).

An original OPF font project is technically feasible: independently designed or suitably open-licensed glyph outlines can be fitted to target advance widths, placement, vertical metrics, and shaping behavior. A successful font needs a reproducible source build, provenance, style/coverage tests, visual review, and cross-renderer conformance. Matching bounding boxes alone is insufficient: [OpenType horizontal metrics](https://learn.microsoft.com/en-us/typography/opentype/spec/hmtx) and [glyph positioning](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos) jointly control text placement. Universal pixel identity across rasterizers is not the acceptance criterion; measured layout preservation over an explicit test matrix is.

## Verification and remaining work

Script fonts (CJK, Arabic, Hebrew, Indic, Thai, Khmer, Myanmar and the rest) have their own shaping corpora and per-family qualification (FF-44, RR-17): see [script-corpora.md](programs/font-fidelity-everywhere/script-corpora.md). It records, per script, glyph coverage, fontkit against HarfBuzz and Chromium, the installed originals measured in place, and the known limits (fontkit has no Myanmar shaper; the PNG path of resvg-js mis-shapes the Indic scripts, Thai, Lao, Khmer and Myanmar).

`pnpm test:fonts` checks that editor and SVG geometry match and that every native PPTX text box has the same coordinates and measured line breaks. With opf-pptx FF-31 (opf-pptx#63), export names the chosen family, not the preview substitute. It writes artifacts to `artifacts/fonts/`. A real-browser check of the same Roboto run measured 324.032 pixels versus the font engine's 324.170 pixels at 25 pixels, a difference of 0.138 pixels. These are measured tolerances, not a promise of pixel identity.

PPTX records the chosen font family (FF-31); it never records a preview replacement and never embeds a proprietary font binary. PowerPoint still needs those fonts installed, through Office, the OS or Microsoft 365 cloud fonts, or it substitutes them. Line height remains the shared 1.22 multiplier, rather than a complete ascent/descent model. Rich-text font overrides, mixed-script fallback and bidi layout, specialized payload internals, and native font embedding remain active fidelity work. Passing a width provider does not remove those limits.
