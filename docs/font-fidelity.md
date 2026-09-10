# Measured fonts and reproducible previews

For the starter set and delivery priorities, see the [font roadmap](plans/font-roadmap.md).

The [Windows reference-font advance study](evidence/shared-metric-native-anchor/font-study-comparison.json) is exploratory source-checkpoint evidence, not an additional compatibility certification. It measures 1,024 cases across regular/bold Calibri, Arial, Times New Roman and Courier New, recording local reference-file versions/hashes and native font-slot names. Disabling optional ligatures and rounding base glyph advances to eighth-point steps predicts 949 observations within 0.02pt; 75 outliers remain, including combining marks, Arabic and Calibri kerning. Office theme tokens and per-glyph fallback are not resolved to exact native files by these name properties. No runtime provider or open-font mapping changes from this hypothesis, and no reference font is redistributed.

The composition API accepts a `textMeasurement` provider. A provider resolves font faces and returns actual text widths; callers pass the same provider to pagination, editor geometry, SVG rendering, and PPTX export. Without one, the existing deterministic character-width estimate remains available.

Unpublished renderer font preparation adds `prepareNodeFonts` from `/fonts-node`. Its returned `options` combine the same registry measurement, embedded SVG fonts and explicit raster files, with system/bundled fallback disabled for raster calls. Pass these options to pagination, editor geometry, SVG, PPTX and PNG/PDF export. `pack: 'base'` is the default for authored Roboto decks; `pack: 'office'` adds the six Office substitute families and retains metric policy unless visual substitution is explicitly requested. `registry.substitutions` records actual substitutions; the helper does not rewrite the authored document or add native embedding.

Both Node loaders verify exact package versions, 33 font-file hashes and eight license-notice hashes against the immutable `BUNDLED_FONT_MANIFEST` exported from `/fonts-node`. Missing/modified resources reject with actionable errors. Default raster loading now includes all nine base faces instead of omitting Roboto semibold, italic and bold italic. Font files must remain available and unchanged between preparation and raster export. Browser loading, actual glyph coverage, variant naming, rich spacing, and native compatibility remain separate requirements. These APIs are source work beyond published renderer 0.7.0; use coordinated candidate packages until a new release is verified.

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
| Cambria | Caladea | Fontconfig metric mapping; reference-version testing remains necessary |
| Arial | Arimo | Metric, standard 400/700 styles |
| Times New Roman | Tinos | Metric, standard 400/700 styles |
| Courier New | Cousine | Metric, standard 400/700 styles |
| Georgia | Gelasio | Visual: optional ligatures changed measured widths |
| Calibri Light | Carlito | Visual: the bundle has no Carlito Light face |
| Aptos / Aptos Display | Carlito, unless Source Sans 3 is supplied | Visual; no Aptos metric claim |

Upstream evidence: [Carlito](https://github.com/googlefonts/carlito), [Fontconfig mappings](https://chromium.googlesource.com/external/fontconfig/+/refs/heads/main/conf.d/30-metric-aliases.conf), [Arimo](https://github.com/google/fonts/blob/main/ofl/arimo/DESCRIPTION.en_us.html), [Tinos](https://github.com/google/fonts/blob/main/ofl/tinos/DESCRIPTION.en_us.html), [Cousine](https://github.com/google/fonts/blob/main/apache/cousine/DESCRIPTION.en_us.html), and [Gelasio](https://github.com/SorkinType/Gelasio). Metric classification describes compatibility intent within the stated style scope, not universal identical output. Missing matching weights cannot silently qualify for the metric tier.

The exported `FONT_COMPATIBILITY` list also contains optional visual candidates and CJK families. Listing a candidate does not bundle it or imply complete character coverage. Liberation Sans Narrow is a separate legacy distribution with a different license history; it is not part of this bundle. Wingdings, Webdings, and Symbol require character mapping before substitution; an ordinary fallback fails with `font-encoding-required`. Missing math fonts require an explicit math-aware choice and fail with `math-font-required` instead of falling through to body text.

DrawingML tokens such as `+mn-lt` resolve through the registry's explicit `themeFonts` option before substitution. Supply concrete `majorLatin`, `minorLatin`, and, where used, `majorEastAsia`, `minorEastAsia`, `majorComplexScript`, or `minorComplexScript` families. Missing theme mappings fail. This helper does not yet extract theme font records or embedded fonts from imported PPTX files.

### Measured results and experimental fonts

`node --import ./scripts/register-local-opf.mjs scripts/test-office-fonts.mjs --system` compares the bundle to reference fonts already installed in macOS's Supplemental directory. It does not redistribute reference fonts. The report records source-file hashes and individual shaped widths. Across four samples and four styles, Arimo/Arial, Tinos/Times New Roman, and Cousine/Courier New matched exactly on 48 runs. Gelasio/Georgia differed on ligature-containing runs, with a maximum difference of 2.0125%. Individual basic-Latin advances matched; disabling optional ligatures removed the tested difference. Until feature handling is consistent across outputs, the policy conservatively labels Gelasio approximate. Calibri and Cambria reference fonts were not available for this comparison.

[Akasia](https://codeberg.org/bloudraad/akasia) is a real upstream project claiming Aptos compatibility across twelve styles using open-licensed donor outlines. Its upstream README was inspected, but OPF has not yet validated its conformance or bundled its files. `EXPERIMENTAL_FONT_CANDIDATES` records it separately. Its claims do not imply compatibility with Aptos Narrow or Aptos Display.

An original OPF font project is technically feasible: independently designed or suitably open-licensed glyph outlines can be fitted to target advance widths, placement, vertical metrics, and shaping behavior. A successful font needs a reproducible source build, provenance, style/coverage tests, visual review, and cross-renderer conformance. Matching bounding boxes alone is insufficient: [OpenType horizontal metrics](https://learn.microsoft.com/en-us/typography/opentype/spec/hmtx) and [glyph positioning](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos) jointly control text placement. Universal pixel identity across rasterizers is not the acceptance criterion; measured layout preservation over an explicit test matrix is.

## Verification and remaining work

`pnpm test:fonts` checks that editor and SVG geometry match, every native PPTX text box has the same coordinates and measured line breaks, and export uses the resolved family. It writes artifacts to `artifacts/fonts/`. A real-browser check of the same Roboto run measured 324.032 pixels versus the font engine's 324.170 pixels at 25 pixels, a difference of 0.138 pixels. These are measured tolerances, not a promise of pixel identity.

PPTX currently records the resolved font family; it does not embed font binaries. PowerPoint still needs those fonts installed or may substitute them. Line height remains the shared 1.22 multiplier, rather than a complete ascent/descent model. Rich-text font overrides, mixed-script fallback and bidi layout, specialized payload internals, and native font embedding remain active fidelity work. Passing a width provider does not remove those limits.
