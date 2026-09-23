# Measured fonts and reproducible previews

For the starter set and delivery priorities, see the [font roadmap](plans/font-roadmap.md).

## Font policy (FF-31)

OPF keeps one machine-readable font policy table, [`spec/reference/font-policy.json`](../spec/reference/font-policy.json). Core exports it as `FONT_POLICY`, `fontPolicyFor()` and `applyFontPolicyDecisions()` from `@openpresentation/opf` or `@openpresentation/opf/font-policy`. Each row gives a family's license class, where viewers get it, whether OPF may ever embed it, and its preview replacement with a measured width difference. It also lists alternates, ending where possible with a face that already ships with opf-render. The [licensing table](programs/font-fidelity-everywhere/font-licensing.md) lists all 153 rows. [`font-policy.schema.json`](../spec/reference/font-policy.schema.json) is its JSON Schema. The [measurement evidence](evidence/font-replacements-20260923/README.md) explains how each replacement was chosen.

**Provisional owner decisions (provisional, owner may revise).** Three choices are pending with the owner. Root resolved them provisionally with the recommended defaults:

| Decision | Families | Replacement |
| --- | --- | --- |
| `aptos-preview` | Aptos (the default `aptos` scheme) | Roboto (visual) |
| `segoe-ui-preview` | Segoe UI, Semibold, Light and Semilight | Red Hat Display (visual) |
| `cambria-tier` | Cambria | Caladea, reclassified from metric to visual. Its `metricModeFallback` keeps metric-mode registries previewing Cambria with Caladea, reported as visual, as they did before FF-31. |

All three live in one block, `provisionalDecisions`, at the top of the JSON. The rows that follow a decision carry no replacement family of their own. A change of decision is therefore a one-line edit. When a decision changes, a stored measurement of the old family is dropped as unmeasured until `scripts/measure-font-replacements.mjs` is run again.

1. **Licensed, non-free fonts are never bundled or embedded.** This covers Aptos, Calibri, Cambria, Segoe UI, Georgia, Tahoma, Grandview, Seaford, Tenorite, Consolas, Times New Roman, Arial, Courier New and the Windows script fonts. Rendering uses the family's designated open replacement instead:
   - **Metric-compatible** where one exists and measures identical: Calibri→Carlito, Arial→Arimo, Times New Roman→Tinos and Courier New→Cousine. A metric row needs an upstream statement and a measurement in all four styles, with a mean width difference below 0.1% and no corpus string more than 0.3% off. Georgia→Gelasio fails that test: ligature runs differ by up to 1.02% as opf-render shapes them. It is therefore visual, even though every basic-Latin advance matches.
   - **Alternates** are tried, in order, when the declared replacement's pack is not loaded. An alternate is always reported as visual, including on a metric row.
   - **Otherwise the closest measured open face**, marked visual. For example, Aptos→Roboto measures a 2.15% mean width difference.
2. **The PPTX always names the chosen family, and no font file is included.** The exporter writes `Aptos` when the document chose Aptos. PowerPoint resolves standard fonts on the viewer's machine: those shipped with Office, Windows or macOS, and Microsoft 365 cloud fonts. The replacement never reaches the package (opf-pptx `test/export-chosen-fonts.mjs`).
3. **Openly licensed fonts render as themselves.** Examples are Roboto, Carlito and the Noto script families. They can reach a PPTX only through an explicit embed path (FF-13), never by default.
4. **Families that are proprietary and non-standard, or missing from the table,** keep their name in the PPTX. `fontAvailabilityDiagnostics()` reports that viewers may lack them. It also flags Microsoft 365 cloud-only fonts (such as Aptos) and families that ship only in an optional Windows language feature.

### Which faces are available

opf-render ships only fonts that it already pins and hash-verifies:
- **Base pack:** Roboto and Roboto Mono.
- **Office pack:** Carlito, Caladea, Arimo, Tinos, Cousine and Gelasio.
- **Optional `scripts` pack (FF-19):** Noto for non-Latin scripts and CJK.

Some replacements are open families that no renderer pack ships yet, such as Red Hat Display for Segoe UI and Red Hat Text for Tahoma. For these, the renderer tries the declared replacement first, then the alternates. The last alternate is the best measured bundled face, so previews stay deterministic without any extra download. `registry.substitutions` records which face was used and its tier. The proposed `catalog` pack (21 OFL `@expo-google-fonts` packages, listed in the opf-render PR) would make the declared replacements and the open catalog families available. Downloading it needs approval, and it is not part of this change.

| Environment | Open catalog families | Proprietary families | When the real font is required |
| --- | --- | --- | --- |
| Local Node, cloud or serverless (`prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'})`) | Exact when a pack ships them (Roboto, Carlito, …, Noto with `scripts`) | Metric replacement: identical widths. Visual replacement: approximate, reported in `registry.substitutions` with the measured delta | Supply licensed files with `prepareNodeFonts({faces: [{path, family, weight, italic}]})`; they resolve as exact faces |
| Strict mode (`substitutionPolicy: 'metric'`) | Exact | Metric replacements only | `font-unavailable` names the license class, the declared replacement and tier, the pack, and the caller hook. There is never a silent wrong-metric fallback |
| Browser (`loadBrowserFontRegistry`) | Exact when the host serves the pack files | Same replacement rules | Same hook: pass the caller's own faces |
| PowerPoint (exported PPTX) | Named; the viewer needs the font or substitutes | Real font on Office, Windows or macOS, or through Microsoft 365 cloud fonts | Named; the viewer substitutes |

**Aptos, the default scheme (provisional, owner may revise).** Aptos is a Microsoft 365 cloud font and is not redistributable. The recommended cloud default previews Aptos with Roboto, the closest measured open face with all four styles, already in the base pack: mean width difference 2.15%, signed +0.1%, maximum 7.4% on a single string. Aptos Display previews with Carlito (1.8%). The exported PPTX still names Aptos and Aptos Display. Deployments that hold an Aptos license can pass the real files through `faces` for exact previews.

The pptx.gallery parity scoreboard counts a family as resolved only when it is the real face or a metric-compatible replacement. A visual replacement, including Aptos→Roboto, is honest about its measured delta but does not pass that check. The default `aptos` scheme therefore stays unresolved there until the owner decides whether a declared, measured visual replacement is acceptable, or supplies licensed Aptos faces.

The [Windows reference-font advance study](evidence/shared-metric-native-anchor/font-study-comparison.json) is exploratory source-checkpoint evidence, not an additional compatibility certification. It measures 1,024 cases across regular/bold Calibri, Arial, Times New Roman and Courier New, recording local reference-file versions/hashes and native font-slot names. Disabling optional ligatures and rounding base glyph advances to eighth-point steps predicts 949 observations within 0.02pt; 75 outliers remain, including combining marks, Arabic and Calibri kerning. Office theme tokens and per-glyph fallback are not resolved to exact native files by these name properties. No runtime provider or open-font mapping changes from this hypothesis, and no reference font is redistributed.

The composition API accepts a `textMeasurement` provider. A provider resolves font faces and returns actual text widths; callers pass the same provider to pagination, editor geometry, SVG rendering, and PPTX export. Without one, the existing deterministic character-width estimate remains available.

Renderer 0.8.0 publishes `prepareNodeFonts` from `/fonts-node`. Its returned `options` combine the same registry measurement, embedded SVG fonts and explicit raster files, with system/bundled fallback disabled for raster calls. Pass these options to pagination, editor geometry, SVG, PPTX and PNG/PDF export. `pack: 'base'` is the default for authored Roboto decks; `pack: 'office'` adds the six Office substitute families and retains metric policy unless visual substitution is explicitly requested. `registry.substitutions` records actual substitutions; the helper does not rewrite the authored document or add native embedding.

Renderer 0.8.0 groups static files by their OpenType preferred family while retaining legacy family names and explicit custom namespaces. `Roboto` requests at 500/600/800 now select the actual Medium/SemiBold/ExtraBold files instead of nearby 400/700 faces. Optional `TextStyle.fontFace` carries the physical legacy family and native bold/italic flags independently of CSS numeric weight: SemiBold/ExtraBold are regular within their legacy families. The converter consumes this metadata; providers without it retain their prior behavior. Nine actual base faces pass metadata/measurement/outline checks and offline Chromium advances on Node 20/24. Seven payload slides cover serialized native selectors, deterministic output and source/reimport. These checks do not establish native Office paint, embedding or broader script coverage; see the [Mac candidate evidence](evidence/mac-font-variants/README.md).

Renderer 0.8.0 uses adjacent SVG spans when no measurement provider is supplied. This closes the visible gaps caused by estimated fragment widths while retaining estimated line breaks and all run text/style/source offsets. Supplied providers and accepted placements still use exact fragment origins. Measured SVG requests geometric precision; accepted outline placements also constrain horizontal advances with `textLength`/`spacingAndGlyphs` to avoid browser quantization drift. This can scale glyphs horizontally while retaining nominal font size and baseline. Width-only providers do not receive that constraint, and constrained widths do not certify raw font-metric equivalence. The compatible editor supports both forms. This is a spacing improvement, not evidence that unmeasured wrapping or glyph coverage is accurate; see [candidate evidence](evidence/mac-rich-flow/README.md).

Both Node loaders verify exact package versions, 33 font-file hashes and eight license-notice hashes against the immutable `BUNDLED_FONT_MANIFEST` exported from `/fonts-node`. Missing/modified resources reject with actionable errors. Default raster loading now includes all nine base faces instead of omitting Roboto semibold, italic and bold italic. Font files must remain available and unchanged between preparation and raster export. Browser loading, actual glyph coverage, variant naming, rich spacing, and native compatibility remain separate requirements. These APIs are available in [renderer 0.8.0](https://github.com/OpenPresentation/opf-render/releases/tag/opf-render-v0.8.0), published against core 0.10.0 with Node 24. Prepared HarfBuzz shaping and variable-instance work remain separate drafts.

The renderer's optional font registry uses [Fontkit](https://github.com/foliojs/fontkit) to shape text and measure glyph advances from local font bytes. It does not discover system fonts or fetch fonts. The Node helper loads the renderer's bundled Roboto and Roboto Mono faces:

```js
import { loadBundledFontRegistry } from '@openpresentation/opf-render/fonts-node';
import { renderSvg, svgToPng } from '@openpresentation/opf-render';
import { paginatePresentation } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const registry = await loadBundledFontRegistry();
const options = { textMeasurement: registry.textMeasurement };
// Use design.fontScheme: 'roboto', or supply the document's actual font files.
const { presentation } = paginatePresentation(deck, options);
const svg = renderSvg(presentation, {
  ...options,
  embeddedFonts: registry.embeddedFonts,
});
const png = await svgToPng(svg, {
  fontFiles: registry.fontFiles,
  useBundledFonts: false,
  loadSystemFonts: false,
});
const pptx = await toPptx(presentation, options);
```

`createFontRegistry` from `@openpresentation/opf-render/fonts` accepts `{data: Uint8Array, weight, italic?, family?, postscriptName?, license?}` entries in Node or the browser. Weights are explicit, with 400 as the default. Supply each style that the document uses. Missing font families and unsupported glyphs fail with `OPFFontError`, including the source path where available. Collection fonts require a `postscriptName` selecting one face.

Aliases and fallback families are explicit choices:

```js
const registry = createFontRegistry(faces, {
  aliases: { Aptos: 'Roboto', 'Aptos Display': 'Roboto' },
  fallbackFamily: 'Roboto',
});
console.log(registry.substitutions);
registry.clearSubstitutions(); // Start a fresh render's diagnostic collection.
```

An available exact family takes precedence over aliases. The registry resolves a requested weight to the closest supplied weight, reports the substitution, and makes the resolved style available to rendering. Missing italic/upright styles fail instead of synthesizing an unmeasured style. `strictGlyphs: false` is an explicit escape hatch for hosts with their own glyph-fallback policy; it is unsuitable for fidelity verification.

SVG embeds supplied fonts using data URIs and includes supplied license notices as metadata. The bundled loader carries the fonts' SIL Open Font License notices. For PNG/PDF, pass the same font files to the rasterizer; its native font loader does not depend on browser CSS font loading. In a browser, wait for `document.fonts.ready` before measuring or taking a screenshot. The editor playground loads and embeds bundled fonts and displays substitutions.

Current `svgToPdf` output is image-only: each slide is rasterized and embedded as a PNG on a PDF page. Text is not selectable or searchable through PDF text objects, and shapes are not preserved as vectors. The accepted [selectable/vector PDF roadmap](plans/pdf-export.md) adds a separate backend and verification requirement, including permitted font embedding, Unicode extraction and shared placement. Raster PDF will remain an explicit compatibility mode when the verified vector mode becomes the default; no vector mode has shipped yet.

## Office compatibility pack

`loadOfficeFontRegistry` from `@openpresentation/opf-render/fonts-node` supplies regular, bold, italic, and bold italic faces of Carlito, Caladea, Arimo, Tinos, Cousine, and Gelasio, plus the base Roboto pack. Package versions are pinned and each face carries its distribution's license notice. `includeBaseFonts: false` omits Roboto. Loading never installs fonts into the operating system or downloads fonts at render time.

```js
const registry = await loadOfficeFontRegistry({
  substitutionPolicy: 'metric', // Default for this loader; no visual fallback.
});
registry.resolveFont({fontFamily: 'Calibri', fontWeight: 400});
// requestedFamily: Calibri, resolvedFamily: Carlito, compatibility: metric
```

`createFontRegistry` defaults to `substitutionPolicy: 'none'`. Policies are `none`, `metric`, and `visual`; visual permits both curated tiers. An explicit `fallbackFamily` is a separate, reported `generic` fallback. Aliases are explicit visual substitutions and never establish metric compatibility. `resolveFont` reports exact resolutions as well; `substitutions` only collects changes. Resolution records include requested/resolved weights, italic, source path, and supporting upstream information where available.

| Requested family | Bundled substitute | Current automatic tier |
| --- | --- | --- |
| Calibri | Carlito | Metric intent, standard 400/700 styles |
| Cambria | Caladea | Visual: advances differ from Cambria 6.99 by a mean of 2.7% (FF-31 measurement). Metric-mode registries still use it, reported as visual (`metricModeFallback`) |
| Arial | Arimo | Metric, standard 400/700 styles |
| Times New Roman | Tinos | Metric, standard 400/700 styles |
| Courier New | Cousine | Metric, standard 400/700 styles |
| Georgia | Gelasio | Visual: basic-Latin advances identical, but ligature runs differ by up to 1.02% as opf-render shapes them |
| Calibri Light | Carlito | Visual: the bundle has no Carlito Light face |
| Aptos / Aptos Display | Roboto / Carlito (FF-31 policy) | Visual; no Aptos metric claim |

Upstream evidence: [Carlito](https://github.com/googlefonts/carlito), [Fontconfig mappings](https://chromium.googlesource.com/external/fontconfig/+/refs/heads/main/conf.d/30-metric-aliases.conf), [Arimo](https://github.com/google/fonts/blob/main/ofl/arimo/DESCRIPTION.en_us.html), [Tinos](https://github.com/google/fonts/blob/main/ofl/tinos/DESCRIPTION.en_us.html), [Cousine](https://github.com/google/fonts/blob/main/apache/cousine/DESCRIPTION.en_us.html), and [Gelasio](https://github.com/SorkinType/Gelasio). Metric classification describes compatibility intent within the stated style scope, not universal identical output. Missing matching weights cannot silently qualify for the metric tier.

The exported `FONT_COMPATIBILITY` list also contains optional visual candidates and CJK families. Listing a candidate does not bundle it or imply complete character coverage. Liberation Sans Narrow is a separate legacy distribution with a different license history; it is not part of this bundle. Wingdings, Webdings, and Symbol require character mapping before substitution; an ordinary fallback fails with `font-encoding-required`. Missing math fonts require an explicit math-aware choice and fail with `math-font-required` instead of falling through to body text.

DrawingML tokens such as `+mn-lt` resolve through the registry's explicit `themeFonts` option before substitution. Supply concrete `majorLatin`, `minorLatin`, and, where used, `majorEastAsia`, `minorEastAsia`, `majorComplexScript`, or `minorComplexScript` families. Missing theme mappings fail. This helper does not yet extract theme font records or embedded fonts from imported PPTX files.

### Measured results and experimental fonts

`node --import ./scripts/register-local-opf.mjs scripts/test-office-fonts.mjs --system` compares the bundle to reference fonts already installed in macOS's Supplemental directory. It does not redistribute reference fonts. The report records source-file hashes and individual shaped widths. Across four samples and four styles, Arimo/Arial, Tinos/Times New Roman, and Cousine/Courier New matched exactly on 48 runs. Gelasio/Georgia differed on ligature-containing runs, with a maximum difference of 2.0125%. Individual basic-Latin advances matched; disabling optional ligatures removed the tested difference. Until feature handling is consistent across outputs, the policy conservatively labels Gelasio approximate. Calibri and Cambria reference fonts were not available for this comparison.

[Akasia](https://codeberg.org/bloudraad/akasia) remains experimental after the [v0.0.2 open-file assessment](evidence/akasia-assessment/README.md). All twelve styles match public upstream advance/kerning/ligature data, but 14 reference codepoints are missing and Black Italic decomposed accents expose a 0.421875px Fontkit/Chromium advance difference at size 32. Both Node runtimes retain the failure. This is not independent Aptos-binary or native Office verification; no mapping or bundled pack changes. `EXPERIMENTAL_FONT_CANDIDATES` records it separately. Aptos Narrow and Display remain outside that evidence.

An original OPF font project is technically feasible: independently designed or suitably open-licensed glyph outlines can be fitted to target advance widths, placement, vertical metrics, and shaping behavior. A successful font needs a reproducible source build, provenance, style/coverage tests, visual review, and cross-renderer conformance. Matching bounding boxes alone is insufficient: [OpenType horizontal metrics](https://learn.microsoft.com/en-us/typography/opentype/spec/hmtx) and [glyph positioning](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos) jointly control text placement. Universal pixel identity across rasterizers is not the acceptance criterion; measured layout preservation over an explicit test matrix is.

## Verification and remaining work

`pnpm test:fonts` checks that editor and SVG geometry match and that every native PPTX text box has the same coordinates and measured line breaks. With opf-pptx FF-31 (opf-pptx#63), export names the chosen family, not the preview substitute. It writes artifacts to `artifacts/fonts/`. A real-browser check of the same Roboto run measured 324.032 pixels versus the font engine's 324.170 pixels at 25 pixels, a difference of 0.138 pixels. These are measured tolerances, not a promise of pixel identity.

PPTX records the chosen font family (FF-31); it never records a preview replacement and never embeds a proprietary font binary. PowerPoint still needs those fonts installed, through Office, the OS or Microsoft 365 cloud fonts, or it substitutes them. Line height remains the shared 1.22 multiplier, rather than a complete ascent/descent model. Rich-text font overrides, mixed-script fallback and bidi layout, specialized payload internals, and native font embedding remain active fidelity work. Passing a width provider does not remove those limits.
