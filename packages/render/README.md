# OPF Render

Version 0.9.0 requires `@openpresentation/opf` ^0.11.0 and resolves content ColorRef / `variables` through core `resolveColorRef()`. Authored `#RRGGBB` paint stays authored. It retains the existing rendering APIs.

Version 0.8.1 required core 0.10.1, including metric, quote and timeline layout placeholders and the corrected text-bullet contract.

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

Version 0.8.0 and this checkout require Node 24 (`24.x`). Use `.nvmrc` for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.8.0 adds optional font-registry vector outlines and shared heading/scalar/rich line placement. Pass identical `textMeasurement` and `textRasterPadding` options to preview, pagination and export; padding defaults to one scaled reference pixel. SVG consumes accepted origins without remeasuring. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md). Native raster certification remains separate.

Version 0.8.0 requires core 0.10.0 and renders accepted quote and code geometry without fitting it again. Code filename/language/body parts preserve source whitespace, literal tabs and metadata case and expose trace targets for editing. The [43 reviewed code raster changes](docs/evidence/shared-code/raster-review.json) retain the other 762 corpus hashes. Coordinated releases PPTX 0.8.0 and editor 0.7.0 add native source recovery and editing. Glyph containment and separation do not establish native pixel equivalence.

Deterministic local renderer for Open Presentation Format documents. The shared SVG core implements validation, catalog resolution, placeholder binding and text layout. Node APIs additionally convert SVG to PNG and raster-backed PDF.

In version 0.8.0, `design.contentBox` uses core's shared padded geometry. The card renders at `item.frameBox`; its payload uses `item.box` and accepted internals. Card padding participates in composition scoring, strict overflow and pagination. This requires core 0.10.0.

Version 0.8.0 paints plain and rich text, titles, subtitles and tags using composition's accepted fits and resolved styles. Painting does not measure those payloads again. Supply a font registry during composition: reusing an estimated fit cannot correct spacing when the actual drawing font has different advances.

Version 0.8.0 includes `prepareNodeFonts` in `/fonts-node`. It verifies all selected font files and license notices against the versioned `BUNDLED_FONT_MANIFEST`, including exact npm versions and SHA-256 hashes. The returned options configure layout, SVG, editing, PPTX, and Node raster output with the same font inputs:

```js
import { prepareNodeFonts } from '@openpresentation/opf-render/fonts-node';
import { renderSvgDeck, svgToPng } from '@openpresentation/opf-render';
import { paginatePresentation } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const { registry, options } = await prepareNodeFonts({
  pack: 'office', substitutionPolicy: 'visual',
});
const { presentation } = paginatePresentation(opf, options);
const slides = renderSvgDeck(presentation, options);
const png = await svgToPng(slides[0], options);
const pptx = await toPptx(presentation, options);
console.log(registry.substitutions);
```

The default `pack: 'base'` contains nine Roboto/Roboto Mono faces and suits a document using `design.fontScheme: 'roboto'`. The Office pack includes 24 additional faces and defaults to metric substitution policy; visual substitution remains explicit. Neither helper changes the document's authored font scheme or installs system fonts. Missing resources, changed bytes/notices, and unexpected package versions fail with actionable font errors. Requested/resolved substitution records remain on `registry.substitutions`; source paths appear where the caller supplies them. Font coverage, variant naming, shaping, and native fidelity retain their documented limits.

Default PNG/PDF raster loading now uses the same complete nine-face base pack, fixing omitted semibold and italic faces. Custom raster callers may still set `useBundledFonts: false`. Font files must stay available and unchanged for subsequent raster calls. `node scripts/update-font-manifest.mjs` is an explicit maintenance operation requiring review of font bytes, style metadata, licenses and raster changes; builds and installs never regenerate the expected hashes.

Version 0.8.0 resolves OpenType preferred-family groups, so a Roboto request at 500, 600 or 800 selects the installed Medium, SemiBold or ExtraBold face. Explicit caller family renames keep their own namespace; ambiguous grouped faces reject. Resolved styles also carry optional `fontFace` metadata with the physical legacy family and its bold/italic style-link flags. Coordinated PPTX export consumes those flags independently of numeric weight. This prevents requesting a second bold style from an already named ExtraBold/SemiBold family. Browser CSS and native selectors retain their respective family names; no font is synthesized or installed by this lookup. See [exact-weight evidence and limits](docs/evidence/font-variants/README.md).

Code strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets) reject rendering with `invalid-code-text`, the OPF field path and UTF-16 offset. Input JSON stays unchanged. Tabs, line endings and valid supplementary Unicode remain accepted; schema validity and XML serialization do not certify font coverage or native fidelity.

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Public API: `renderSvg(opf, opts)`, `renderSvgDeck(opf, opts)`, `resolvePresentation(opf, opts)`, `svgToPng(svg, opts)`, and `svgToPdf(svgs, opts)`

`renderSvg` renders a single slide selected by `opts.slideIndex` (default `0`). `renderSvgDeck` returns one SVG string per slide. Both validate OPF at the boundary via `@openpresentation/opf`, resolve inline and bundled catalogs locally, and emit byte-stable SVG for the same input.

```js
import { renderSvgDeck } from "@openpresentation/opf-render";
import { loadOfficeFontRegistry } from "@openpresentation/opf-render/fonts-node";

const fonts = await loadOfficeFontRegistry({ substitutionPolicy: "visual" });
const svgs = renderSvgDeck(opf, {
  trace: true,
  textMeasurement: fonts.textMeasurement,
  embeddedFonts: fonts.embeddedFonts,
});
console.log(fonts.substitutions);
```

Set `trace: true` to stamp rendered SVG elements with `data-opf-path` values such as `slides.0.title`; omit it for smaller production SVG.

The installed open font pack works offline. This example explicitly permits visual substitutes such as Carlito for Aptos; the substitution report identifies requested and resolved faces. A visual substitute is not a claim of metric or pixel equivalence. Omit `substitutionPolicy` to restrict the Office loader to its metric mappings, or supply your own licensed faces. Missing fonts/glyphs fail explicitly. Without `textMeasurement`, synchronous SVG APIs use estimated widths; named fonts alone do not make rich-run spacing reliable. Browser hosts should load the same bytes using the loader below.

Unresolved images produce an `unresolved-asset` diagnostic through `onDiagnostic`, including the OPF path, reason and complete description. The fallback shows a bounded status label when it fits above the selected readability floor, otherwise an icon with the full accessible description. It preserves authored opacity, including faint decorative watermarks; a missing image is still missing even when its fallback fits. Use `strictAssets: true` to reject unresolved images. Supply embedded raster data URIs or a synchronous host `imageResolver` to resolve them; the renderer does not fetch URLs or read local paths. Caller descriptions and other metadata override referenced asset metadata through alias chains. These diagnostics identify unresolved sources, not malformed image bytes or native PowerPoint compatibility.

Header/footer images and watermarks fit their complete artwork within their allocated regions. `design.imageFill: "crop"` continues to crop content picture placeholders; background images retain their own fit policy.

PNG and PDF conversion APIs are async because they load the local raster/PDF engines on demand:

```js
import { renderSvgDeck, svgToPdf, svgToPng } from "@openpresentation/opf-render";
import { loadOfficeFontRegistry } from "@openpresentation/opf-render/fonts-node";

const fonts = await loadOfficeFontRegistry({ substitutionPolicy: "visual" });
const svgs = renderSvgDeck(opf, { textMeasurement: fonts.textMeasurement });
const rasterOptions = { scale: 1, fontFiles: fonts.fontFiles, useBundledFonts: false, loadSystemFonts: false };
const png = await svgToPng(svgs[0], rasterOptions);
const pdf = await svgToPdf(svgs, rasterOptions);
```

`svgToPng` returns PNG bytes for one SVG. `svgToPdf` accepts one SVG or an array of SVGs and returns PDF bytes with one slide per page. The SVG page `width`/`height` or `viewBox` determines the PDF page size; `scale` controls raster density only.

## Browser preview and fonts

Use `@openpresentation/opf-render/svg` for browser rendering without Node dependencies. Browser-aware bundlers also select this shared SVG implementation for the root import; Node's root import retains PNG/PDF conversion.

```js
import { renderSvg } from '@openpresentation/opf-render/svg';
import { loadBrowserFontRegistry } from '@openpresentation/opf-render/fonts-browser';

const fonts = await loadBrowserFontRegistry(fontFileEntries);
container.innerHTML = renderSvg(presentation, {
  textMeasurement: fonts.textMeasurement,
});
// fonts.dispose() when its canvases are unmounted.
```

Each entry contains `url` or `data: Uint8Array`, with optional `family`, `weight`, `italic` and `license`. The loader registers browser FontFaces using the same bytes used for measurement. It fetches only URLs supplied by the host, supports an AbortSignal and custom fetch, and awaits font loading. Use pinned static faces and retain their licenses. For standalone SVG export also pass `embeddedFonts: fonts.embeddedFonts`; embedding is unnecessary for each live draft after browser fonts are loaded.

## Script fonts, lang and right-to-left text (FF-19)

Previews itemize text by Unicode script. Each run uses the OOXML script slot its script belongs to (`latin`, `eastAsian` or `complexScript`), as resolved by core `resolveScriptFonts` from the document's language and font scheme. Latin, Greek and Cyrillic text stays in the design font. The text's role picks the major (heading) or minor (body) slots: title, subtitle and tag text is heading, as in the exporter's heading shapes, and all other text is body. Licensed script fonts are never bundled. With a measured registry, a proprietary family (for example Meiryo, Microsoft YaHei, Malgun Gothic, Arabic Typesetting, David, Mangal or Angsana New) is previewed with its designated open replacement from `SCRIPT_FONT_REPLACEMENTS`, and each replacement is recorded in `registry.substitutions` as `visual`. The PPTX keeps the chosen family. If the slot's face has no glyph for a run, the run falls back by coverage to the designated OFL Noto family for its script.

The replacement faces are an optional, hash-pinned font pack: 63 static regular and bold faces from 31 `@expo-google-fonts/noto-*` packages (SIL OFL 1.1). The pinned faces total 66.9 MiB, of which 55.9 MiB is CJK. Installing all 31 packages takes about 325.8 MiB, because they also ship weights the manifest does not pin. They are exact optional peer dependencies, so the renderer install does not grow. Install only the scripts you need, then load them:

```js
import { prepareNodeFonts } from '@openpresentation/opf-render/fonts-node';
import { renderSvgDeck, svgToPng } from '@openpresentation/opf-render';

// npm install @expo-google-fonts/noto-sans-jp@0.4.3 @expo-google-fonts/noto-naskh-arabic@0.4.5
const { options } = await prepareNodeFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: ['Jpan', 'Arab'] });
const slides = renderSvgDeck(presentation, options);
const png = await svgToPng(slides[0], options);
```

`scripts` accepts ISO 15924 codes (`Jpan`, `Hans`, `Hant`, `Kore`, `Arab`, `Hebr`, `Deva`, `Beng`, `Thai` and others; see `scriptFontPackages('all')`) or `'all'`. `detectScripts(presentation)` from `/fonts` lists the scripts a document's text needs. Every face and license notice is checked against `BUNDLED_FONT_MANIFEST`. A missing package fails with `font-resource-unavailable` and names the exact version to install. Script faces are left out of `options.embeddedFonts` unless you pass `embedScriptFonts: true`, because a CJK face is 5 to 10 MB. Raster output reads them from `fontFiles`. In a browser, serve the installed packages and load `scriptFontEntries(scripts, { baseUrl })` from `/fonts-browser` with `loadBrowserFontRegistry`. The loader verifies each entry's SHA-256 with Web Crypto before use.

The renderer measures and paints with the same runs. A line whose runs use different families is drawn as positioned tspans, each with its own measured advance. For consistent line breaks, pass the same measurement to pagination and editing: `createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(presentation))`. Without a registry, the SVG names every candidate family in order (for example `Meiryo, Noto Sans JP, sans-serif`), and the host resolves glyphs itself.

The SVG root carries `lang` and `xml:lang` from the document's `language`. Measurement applies the same OpenType language system that a browser selects for that `lang`; Noto Sans KR spacing, for example, differs under `KOR`. Direction is set per paragraph, meaning the text between hard line breaks. The rule is core's `paragraphDirection(text, deckDirection)`, the same function the exporter uses for `a:pPr rtl`. A paragraph is right to left when the deck language is right to left and its first strong character is right to left, or it has none. Strong characters follow UAX #9 P2: isolates are skipped, LRM/RLM/ALM count, and the letters of every right-to-left script, historic ones included, are right to left. The renderer does not keep its own copy of the rule. With a core that lacks the function, every paragraph is left to right, as in export, and a right-to-left deck reports `paragraph-direction-unavailable`. Every wrapped line of a right-to-left paragraph is laid out as a right-to-left isolate (U+2067 ... U+2069), so lines of one paragraph never differ. Measured rich-text fragments are placed from the right edge.

When the installed core has no `resolveScriptFonts` (published core 0.11.0 and earlier) and the document names a `language`, the renderer reports `language-preview-unavailable` once through `onDiagnostic`. The preview then uses the design font for every script, sets no `lang` and lays out every paragraph left to right. If the resolver throws, the renderer falls back the same way and reports `language-preview-unresolved`.

Characters are assigned to slots following PowerPoint where its rules are known:

- Letters take their script's slot.
- CJK symbols and punctuation (U+3000-303F), kana, enclosed and compatibility CJK, and halfwidth and fullwidth forms (U+FF00-FFEF) always use the East Asian slot, even at the start of a text.
- With an East Asian document language (ja, zh, ko), curly quotes, dashes, the ellipsis, daggers, primes and the reference mark also use the East Asian slot.
- ASCII spaces, digits and punctuation use the latin slot next to East Asian text. They stay with complex-script text, and leading ones join a following complex-script run.
- Other common characters and combining marks join the preceding run.

Limits:

- Alignment stays absolute, as authored or composed. RTL decks are not right-aligned automatically.
- Known differences from PowerPoint: the character tables above are approximations, not PowerPoint's full per-character table. Non-ASCII common characters, such as Latin-1 symbols and other general punctuation, join the neighbouring run instead of following PowerPoint's per-character slot, and PowerPoint's `hint="eastAsia"` run property is not modelled.
- Per-run language (`lang` on individual runs) is not modelled. Han text uses kana or Hangul context, then the document language, and defaults to Simplified Chinese.
- Faces have no italics, so italic script text uses upright advances. Browsers may slant it synthetically.
- Serif CJK replacements (Noto Serif JP/SC/TC/KR) are designated but not pinned; serif CJK requests use the sans face unless you supply the serif face.
- Shaping uses fontkit. An offline Chromium check keeps 27 runs across 26 scripts within 0.1 px of HarfBuzz advances (`npm run test:script-fonts-browser`). Other texts, fonts and PowerPoint's own shaping are not certified.
- Estimated (unmeasured) rich text keeps logical fragment order and relies on the browser's bidi algorithm.

These browser entrypoints are included in the published package. For coordinated development, the sibling OPF repository's `pnpm pack:ecosystem` prepares local npm tarballs. See the core repository's [live editor guide](https://github.com/OpenPresentation/opf/blob/main/docs/live-editor.md) for installation and the fidelity contract. Identical SVG geometry does not guarantee identical raster pixels across browser engines or PowerPoint.

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- No clock, locale, random, or system-font fallback drift in render output
- Host applications own auth, storage, queues, analytics, collaboration, and product workflow

Dependency policy:

- `@openpresentation/opf` is the compatibility source for schemas, validation, and bundled catalogs.
- `@resvg/resvg-js` is used only for local SVG rasterization in Node; it makes no network calls and does not require a browser.
- `pdf-lib` assembles PDF bytes locally. Metadata timestamps are disabled so repeated PDF output is byte-stable for the same SVG input and options.
- Bundled OFL Roboto and Roboto Mono TTF files provide the default deterministic font fallback.
- `svgToPng` and `svgToPdf` disable system-font loading by default. Hosts that require branded fonts should pass explicit `fontFiles` or `fontDirs`; `loadSystemFonts: true` is an opt-in escape hatch and can make output environment-dependent.

Browser support boundary: `renderSvg`, `renderSvgDeck`, and `resolvePresentation` are browser-importable pure JavaScript APIs. `svgToPng` and `svgToPdf` are Node APIs in this package version because they depend on the Node build of resvg.

## Development

```sh
npm ci
npm run build
npm run typecheck
npm run validate
npm test
```

The accepted-text regression `npm run test:text` checks 24 combinations of dimensions, alignment, cards and formatting, including exact accepted positions/styles and strict overflow. `npm run test:rich-spacing-browser -- <new-output-directory>` compares two unchanged gallery slides with identical open font bytes. `npm run test:text-browser -- <new-output-directory>` also checks actual text paint: it currently exits 1 for four portrait/right title cases with one painted pixel beyond the 0.1-pixel cell tolerance in the recorded Windows Edge environment. Its advance/origin checks pass. Font text rectangles, painted-pixel containment, source whitespace and native fidelity are separate results; that historical plain fitting normalized whitespace. Later source-whitespace evidence below supersedes that behavior and has its own reviewed corpus checkpoint.

When this repo is checked out beside `openpresentation/opf`, `npm test` also renders every `examples/**/*.opf.json` deck twice and asserts byte-identical SVG output. Golden PNG drift is checked on every run against all 805 slides from the installed core package, identified by a content digest. Changed or missing corpora fail; Git history cannot skip the gate. To generate a review candidate after an intentional visual change:

```sh
npm run golden:update
```

## Release Lane

Public npm package publication is handled by `.github/workflows/npm-publish.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-render` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-render` and workflow `.github/workflows/npm-publish.yml`.
3. Publish by pushing a git tag matching `opf-render-v<version>` or `@openpresentation/opf-render@v<version>` (the tag must match the `package.json` version), or by manually running the workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.

## Shared dynamic composition (local development)

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.3.0 requires core 0.5.0 and renders rich table cells and headers using canonical `TextRun[]`, including editor trace geometry.

Version 0.2.x requires the published `@openpresentation/opf@^0.4.1` for composition, pagination and measured text. A clean `npm ci && npm test` uses registry packages and runs the full raster corpus without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` checks editing, rendering, editable PowerPoint geometry and import together.

For actual font measurement, load `loadBundledFontRegistry()` from `@openpresentation/opf-render/fonts-node`, then pass its `textMeasurement` to rendering and its `embeddedFonts` to SVG export. Pass its `fontFiles` to PNG/PDF conversion. The browser-safe `@openpresentation/opf-render/fonts` entry accepts local font bytes. Missing fonts/glyphs fail explicitly; aliases and fallback are opt-in and recorded in `registry.substitutions`. Bundled font license notices travel with embedded SVG fonts.

Raster updates produce an HTML gallery and `artifacts/golden/candidate.json`; they never overwrite the approved baseline automatically. See [baseline review and known limitations](test/golden/README.md).

Version 0.1.1 adds rich-text line offsets and measured boxes to opt-in SVG tracing, including blank lines, for editor caret placement. Normal SVG/PNG output is unchanged.

## Embedded WebP in PNG/PDF output (since 0.2.0)

PNG and PDF conversion now decode embedded WebP image data URIs to static PNG before rasterization. This preserves fit/crop, transparency, EXIF orientation and the first animation frame. The source SVG and OPF document remain unchanged; browser SVG output keeps the original embedded image. Both href and legacy xlink:href are supported, including base64 and percent-encoded data. This step does not resolve local filenames, download remote images or change the existing host imageResolver contract.

The Node-only raster path lazily loads pinned Sharp 0.35.4, requiring Node 24 for this package and normal installation of its optional platform binaries. Browser exports do not include the decoder. Malformed embedded WebP produces image-conversion-failed with its data-opf-path when present, otherwise svg.images.N. Decoding has a 40-megapixel limit. PNG/PDF are static outputs; animation beyond the first frame and original image metadata are not retained.

Regression checks compare six fixtures against independent Pillow pixels, verify fit/crop, inspect actual PDF image streams and transparency masks, and exercise input encodings and diagnostics. All 805 existing raster baselines remain unchanged. Test fixtures are project-authored and MIT licensed; the decoder and its bundled codecs retain their upstream licenses.

## JPEG EXIF orientation in raster output (since 0.2.0)

PNG/PDF raster preparation now honors all eight JPEG EXIF orientations. JPEGs with orientation 2–8 are decoded to oriented PNG pixels for rasterization; JPEGs with orientation 1 or no orientation keep their original SVG attribute spelling and compressed bytes. This does not modify the source document or the browser SVG output. The Node path reads JPEG metadata through the same lazy Sharp dependency used for WebP.

Twenty-four cases verify fit/crop, PNG pixels and actual PDF image streams against independent Pillow references (maximum two channel values of decoder difference). Sixteen browser OPF-SVG checks verify orientation and fit/crop with an explicitly incorrect-orientation control. Browser JPEG/PNG scaling differs around high-contrast edges: measured average channel error is below 0.62, but individual differences reach 49. These checks therefore establish geometry/orientation agreement, not pixel-identical output across engines.

`npm test` also builds the browser comparison and rejects native raster modules in browser output. Serve this repository and open `/artifacts/jpeg/browser/index.html` to run it. The harness permits mean channel error up to 1 and at most 2% of channels differing by more than 10; a deliberately unrotated image must fail that criterion.

Version 0.2.0 requires Node 20.9 or later for native image decoding. Browser bundles continue using browser-safe entrypoints.

## Styled and merged table cells

Renderer 0.5.0 requires core 0.7.0 and uses its shared styled-cell geometry. A cell may wrap a scalar or rich value with styles and spans:

```json
{"rows":[[{"value":"Merged heading","colSpan":2,"style":{"fill":"#DBEAFE","align":"center","padding":{"top":12},"borders":{"bottom":{"color":"#445566","width":2,"dash":"dot"}}}},null],["Left","Right"]]}
```

Every covered position is explicit `null`. Each merged anchor renders once; traced text uses its `.value` path for editing. Styles support RGB/RGBA fills and text colors, horizontal and vertical alignment, reference-pixel padding and per-edge solid/dashed/dotted borders. Rich-run colors override the cell text color. Columns remain equal width; rows grow from measured text, padding and span constraints. Pagination preserves connected vertical merge groups.

The Node20/24 renderer suite retains all 805 existing raster baselines. Browser fixtures verify merged text containment and styled-cell typing, formatting, cancellation and undo with actual loaded fonts. Native PowerPoint appearance remains a separate converter verification boundary.

Version 0.8.0 preserves scalar spaces, literal tabs and exact hard-line source ranges across core layout and SVG. Explicit tab positions and whitespace-preserving SVG text prevent source collapse. Its separate 805-slide checkpoint follows review of all 279 changed slides in 35 paired sheets and six full-size pairs; historical baselines remain retained. See [the review and bounds](docs/evidence/source-whitespace-corpus-review/README.md). Estimated wrapping/advances, multilingual shaping and native Office remain separate gates.
