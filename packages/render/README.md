# OPF Render

**Aptos previews with Intos.** The Office pack includes Intos, Intos Display, Intos Narrow and Intos Serif (16 faces, about 12 MB, vendored under `fonts/intos/`, SIL OFL 1.1, pinned to upstream commit fef9315c14da9e4b23b4c3cac8e718998d4e4736 and per-file SHA-256, unmodified from the upstream files). They are the metric-compatible previews for Aptos, Aptos Display, Aptos Narrow and Aptos Serif, the default `aptos` font scheme: 0.000% mean and maximum width difference against Aptos 2.01 in all four styles, with equal vertical metrics. The letter shapes are Intos's own, not Aptos's. The exported PPTX still names Aptos; no Aptos file is bundled or embedded. A registry built without these faces (the base pack) has no Aptos substitute: visual policy falls back to Roboto or Carlito. Like the open families, Intos is `embed: "used"`: it is not in `registry.embeddedFonts` (the 33 eager npm faces), `prepareNodeFonts().options.embeddedFonts` supplies it, and an SVG embeds only the Intos faces its text draws. `registry.lazyFonts` lists the 51 vendored faces (35 open, 16 Intos) with package-relative file and sha256, and `loadBrowserFontRegistry(faces, {lazyFontsBaseUrl})` loads them on demand: `await registry.ensureLazyFonts(presentation)` fetches and verifies only the faces the document draws, by family, weight and style (a plain Aptos deck: Intos Display Bold and Intos Regular, 2 files, 1.5 MB; an italic run adds Intos Italic, a bold run Intos Bold; the code face only when a slide has code), then adds them to the document and the registry together so measurement and painting never disagree. Faces a host serves itself load the same way: `loadBrowserFontRegistry(startup, { extraLazyFonts: [{ family, weight, italic, url, sha256 }] })` adds them to the lazy list (`registry.lazyFonts`, `package: "host"`), so the registry can start with Roboto Regular only (`splitStartupFaces(faces)` splits a manifest into the startup face and the rest) and a document draws, fetches and verifies just the faces it needs, vendored and host faces in one `ensureLazyFonts` call. `sha256` is mandatory, loads are all or nothing, `dispose()` removes the faces, and, like the vendored ones, host faces are `embed: "used"`: they are not in `registry.embeddedFonts` (only the startup faces are), and a standalone SVG embeds one only when passed explicitly through `registry.selectEmbeddedFonts` and the slide's text uses its family. `registry.pendingLazyFonts(presentation)` is the synchronous check hosts gate rendering on, and after an edit it reports just the newly needed faces. The faces are those the renderer itself measures and draws (`presentationFaces(presentation, options, registry)`, one layout-and-paint run with a recording measurement), resolved by the registry's own face selection over the faces it holds plus the vendored ones, so the browser loads exactly what Node draws with every vendored face loaded. A document resolves with the `renderSvg` options the host renders with: pass them as `loadBrowserFontRegistry(entries, { renderOptions: { catalogs } })`, or per call (`pendingLazyFonts(presentation, { catalogs })`, `ensureLazyFonts(presentation, { signal, catalogs })`), so a layout or font scheme id that only the host's catalogs know resolves here too; a document that does not resolve throws (rejects) what `renderSvg` throws for it instead of reporting nothing. Node's `prepareNodeFonts` and `loadOfficeFontRegistry` keep loading the whole open pack and Intos eagerly, so nothing there is face level; with `scripts: 'auto'` they accept `renderOptions: { catalogs }` too. Hosts copy the vendored directories next to the page.

Version 0.12.0 requires `@openpresentation/opf` ^0.12.0 (composed font sizes on PowerPoint's 0.01 pt grid, hanging wrap whitespace, promoted regions in reading order, right-to-left decks composed mirrored) and draws what that core composes, plus the preview changes listed in the changelog; use it with opf-pptx 0.12.0 and opf-editor 0.11.0 so preview and export resolve one core. Version 0.11.9 requires `@openpresentation/opf` ^0.11.4 and draws the design fields (deck and organization logos on covers and section slides, header and footer `logo` parts, `design.listBullet: image` picture bullets at the size PowerPoint draws them, the accent font, `contentDirection` and `chartPrimary` through core composition), and the slide tag falls back to the text colour when the scheme primary is under 4.5:1 against the background; furniture images sit on their zone edge. Use it with opf-pptx 0.11.7 and opf-editor 0.10.6 so preview and export resolve one core (no API change; the preview of covers, list slides with picture bullets, chart slides with a primary chart and slides with furniture images changes). Version 0.11.8 draws the slide tag in the scheme primary colour, as opf-pptx 0.11.5 writes it (no API change; the preview of slides with a tag changes). Version 0.11.7 lets a browser registry load the host's own faces on demand (`extraLazyFonts`, `splitStartupFaces`: a registry can start with Roboto Regular only; additive, `registry.lazyFonts` still lists the 94 vendored faces plus the host's). Version 0.11.6 makes the category-axis labels of chart previews rotate and skip instead of wrapping mid-word (no API change; the preview of dense-axis chart slides changes) and requires `@openpresentation/opf` ^0.11.3 (the 70 legacy gallery layout ids and their geometry); use it with PPTX 0.11.4 and editor 0.10.4 so preview and export resolve the same core. Version 0.11.5 loads vendored preview fonts by face, not by family, and lets the font loaders resolve documents with the host's render options (`presentationFaces`, `lazyFacesNeeded`; `pendingLazyFonts`, `ensureLazyFonts`, `pendingScripts` and `ensureScripts` take `catalogs` and throw or reject with the `renderSvg` error for a document that does not resolve; `registry.lazyFonts` still lists 94 faces). Version 0.11.4 previews the seven chartex chart types natively (the world map as a non-geographic tile grid), keeps the Latin Noto Sans replacement for script schemes under `scripts: 'auto'` in Node, shapes Noto Sans Mongolian again and bundles Raleway and Playfair Display (`registry.lazyFonts` lists 94 faces; no API change). Version 0.11.3 previews the classic chart types natively, draws deprecated chart ids as their replacement and scales value axes like Office (no API change; the preview of chart slides changes). Version 0.11.2 makes `scripts: 'auto'` load the script faces a font scheme names and adds `details.loadedFaceHasGlyph` to `missing-glyph` (no export change). Version 0.11.1 adds the open replacement font families the policy routes to and complete Red Hat styles (no API change). Version 0.11.0 requires `@openpresentation/opf` ^0.11.2 (cover centering, Intos Aptos previews, lazy font loading, automatic script fonts and glyph fallback); use it with PPTX 0.11.0 and editor 0.10.0 so preview and export resolve the same core. Version 0.10.0 required `@openpresentation/opf` ^0.11.1 (font policy table, script fonts and right-to-left paragraphs, socials, slide-image treatments, formatted slide-number and date furniture with the host `date` option, per-item alignment). See the changelog for the intentional preview-output changes.

Version 0.9.0 required `@openpresentation/opf` ^0.11.0 and resolved content ColorRef / `variables` through core `resolveColorRef()`. Authored `#RRGGBB` paint stays authored. It retains the existing rendering APIs.

Version 0.8.1 required core 0.10.1, including metric, quote and timeline layout placeholders and the corrected text-bullet contract.

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

This checkout supports Node 22 or later (`engines.node` `>=22`; CI tests Node 22, 24 and 26). Versions 0.8.0 to 0.12.0 declared `24.x`, so npm on Node 22 or 26 silently installed an older release instead (RR-20); upgrade past 0.12.0. Use `.nvmrc` (Node 24) for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.8.0 adds optional font-registry vector outlines and shared heading/scalar/rich line placement. Pass identical `textMeasurement` and `textRasterPadding` options to preview, pagination and export; padding defaults to one scaled reference pixel. SVG consumes accepted origins without remeasuring. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md). Native raster certification remains separate.

Version 0.8.0 requires core 0.10.0 and renders accepted quote and code geometry without fitting it again. Code filename/language/body parts preserve source whitespace, literal tabs and metadata case and expose trace targets for editing. The [43 reviewed code raster changes](docs/evidence/shared-code/raster-review.json) retain the other 762 corpus hashes. Coordinated releases PPTX 0.8.0 and editor 0.7.0 add native source recovery and editing. Glyph containment and separation do not establish native pixel equivalence.

Deterministic local renderer for Open Presentation Format documents. The shared SVG core implements validation, catalog resolution, placeholder binding and text layout. Node APIs additionally convert SVG to PNG and to PDF (vector with selectable text by default, or raster-backed).

In version 0.8.0, `design.contentBox` uses core's shared padded geometry. The card renders at `item.frameBox`; its payload uses `item.box` and accepted internals. Card padding participates in composition scoring, strict overflow and pagination. This requires core 0.10.0.

Version 0.8.0 paints plain and rich text, titles, subtitles and tags using composition's accepted fits and resolved styles. Painting does not measure those payloads again. Supply a font registry during composition: reusing an estimated fit cannot correct spacing when the actual drawing font has different advances.

Citations, footnotes and captions (core RR-34 fields `cite`, `footnote`, `references` and `caption`) draw from the same composed geometry: a marker is a superscript segment after its run (traced as `data-opf-segment="marker"` without source offsets), the slide's footnote area is a rule and `<n> <text>` lines in the muted colour above the footer band, and a caption is a band inside its block's region. Decks without those fields render as before.

Version 0.8.0 includes `prepareNodeFonts` in `/fonts-node`. It verifies all selected font files and license notices against the versioned `BUNDLED_FONT_MANIFEST`, including exact npm versions and SHA-256 hashes. Carlito is not an npm dependency: the package ships the unmodified google/fonts Carlito files and their OFL notice in `fonts/carlito`, pinned to a google/fonts commit and verified by the same hashes. The returned options configure layout, SVG, editing, PPTX, and Node raster output with the same font inputs:

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

The default `pack: 'base'` contains nine Roboto/Roboto Mono faces and suits a document using `design.fontScheme: 'roboto'`. The Office pack includes 24 Office-substitute faces plus 70 vendored faces of the open families that font schemes select and the open replacements the font policy routes to (below) and the 16 vendored Intos faces that preview the Aptos family (below), and defaults to metric substitution policy. Its four Carlito faces are the byte-identical upstream release (OFL reserves the name "Carlito", so a subset or conversion could not keep it); visual substitution remains explicit. Neither helper changes the document's authored font scheme or installs system fonts. The authored (selected) font is the source of truth. Licensed fonts are never bundled, so these packs supply open look-alikes for previews and SVG: metric-compatible where one exists (Carlito for Calibri, Intos for Aptos), visual-only where none does yet (a documented fallback and known layout-fidelity gap). The PPTX exporter still writes the selected name; see the [OPF font policy](https://github.com/OpenPresentation/opf/blob/main/docs/font-fidelity.md#font-policy-ff-31). Missing resources, changed bytes/notices, and unexpected package versions fail with actionable font errors. Requested/resolved substitution records remain on `registry.substitutions`; source paths appear where the caller supplies them. Font coverage, variant naming, shaping, and native fidelity retain their documented limits.

Default PNG/PDF raster loading now uses the same complete nine-face base pack, fixing omitted semibold and italic faces. Custom raster callers may still set `useBundledFonts: false`. Font files must stay available and unchanged for subsequent raster calls. `node scripts/update-font-manifest.mjs` is an explicit maintenance operation requiring review of font bytes, style metadata, licenses and raster changes; builds and installs never regenerate the expected hashes.

Version 0.8.0 resolves OpenType preferred-family groups, so a Roboto request at 500, 600 or 800 selects the installed Medium, SemiBold or ExtraBold face. Explicit caller family renames keep their own namespace; ambiguous grouped faces reject. Resolved styles also carry optional `fontFace` metadata with the physical legacy family and its bold/italic style-link flags. Coordinated PPTX export consumes those flags independently of numeric weight. This prevents requesting a second bold style from an already named ExtraBold/SemiBold family. Browser CSS and native selectors retain their respective family names; no font is synthesized or installed by this lookup. See [exact-weight evidence and limits](docs/evidence/font-variants/README.md).

Code strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets) reject rendering with `invalid-code-text`, the OPF field path and UTF-16 offset. Input JSON stays unchanged. Tabs, line endings and valid supplementary Unicode remain accepted; schema validity and XML serialization do not certify font coverage or native fidelity.

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Public API: `renderSvg(opf, opts)`, `renderSvgDeck(opf, opts)`, `resolvePresentation(opf, opts)`, `svgToPng(svg, opts)`, and `svgToPdf(svgs, opts)`
- Player and embedding (RR-28): `<opf-deck>` and a slideshow with a speaker view, see [Player and `<opf-deck>`](#player-and-opf-deck-rr-28)

`renderSvg` renders a single slide selected by `opts.slideIndex` (default `0`). `renderSvgDeck` returns one SVG string per slide. Both validate OPF at the boundary via `@openpresentation/opf`, resolve inline and bundled catalogs locally, and emit byte-stable SVG for the same input. A catalog `source` may be one string or an ordered array (first match wins, the bundled default is appended); the renderer never fetches, so non-bundled sources resolve only from `catalogSources`. Slide background colours (solid, gradient stops, pattern colours) accept the same colour references as text and table colours: a hex value, a `var:` variable, or a colour scheme slot or role such as `accent2` or `primary`.

The preview draws three accepted spec fields from tables shared with opf-pptx through core (`@openpresentation/opf`): `code.language` colours code (comments, strings, numbers, keywords, names and types, in theme-derived colours kept at 4.5:1 or more on the code panel; an unknown language stays plain and the text is never changed), `metric.trend` draws an arrow beside the trend word (green up, red down, neutral flat, with "Trend: up" as its text alternative) and colours the delta and trend text, and every one of the 54 DrawingML preset pattern backgrounds draws from its 8 x 8 bitmap (one pixel per 1/96 inch from the slide's top-left). With a core that lacks these exports the preview draws plain, without a new diagnostic. `scripts/derive-pattern-bitmaps.mjs` compares a PowerPoint export of the pattern slides with core's tiles (ECMA-376 names the presets without defining their pixels; core's tiles were measured with it from desktop PowerPoint, Office 365, Windows, 2026-10-01).

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

The installed open font pack works offline. The Aptos family previews with the metric-compatible Intos even under the default metric policy; this example additionally permits visual-only look-alikes for families with no metric replacement yet (a documented fallback), and the substitution report identifies requested and resolved faces. A visual substitute is not a claim of metric or pixel equivalence, and it is a known layout-fidelity gap rather than the end state. Replacements apply to rendering only; the document keeps the selected font name. Omit `substitutionPolicy` to restrict the Office loader to its metric mappings, or supply your own licensed faces. Missing fonts/glyphs fail explicitly. Without `textMeasurement`, synchronous SVG APIs use estimated widths; named fonts alone do not make rich-run spacing reliable. Browser hosts should load the same bytes using the loader below.

Unresolved images produce an `unresolved-asset` diagnostic through `onDiagnostic`, including the OPF path, reason and complete description. The fallback shows a bounded status label when it fits above the selected readability floor, otherwise an icon with the full accessible description. The label is `Image unavailable` over the description (alt, else title, else `Image`) in semibold at 20 px on a 1280 x 720 canvas, and opf-pptx exports the same placeholder as native shapes. It preserves authored opacity, including faint decorative watermarks; a missing image is still missing even when its fallback fits. Use `strictAssets: true` to reject unresolved images. Supply embedded raster data URIs or a synchronous host `imageResolver` to resolve them; the renderer does not fetch URLs or read local paths. Caller descriptions and other metadata override referenced asset metadata through alias chains. These diagnostics identify unresolved sources, not malformed image bytes or native PowerPoint compatibility.

Header/footer images and watermarks fit their complete artwork within their allocated regions. `design.imageFill: "crop"` continues to crop content picture placeholders; background images retain their own fit policy.

An `image/svg+xml` data URI (base64 or text) is drawn as an image wherever a raster is (content, header/footer, watermark, logo, slide image, background, picture bullet), with the raster's box and fit, when it is an `<svg>` in the SVG namespace with an intrinsic size (`width` and `height`, or a `viewBox`); anything else keeps the `Image unavailable` placeholder. opf-pptx exports the same picture as a native SVG picture over a PNG fallback. An SVG used as an image never runs script or loads anything outside its own document, in a browser or in PNG/PDF output; PNG and PDF output draw it with resvg, and its text uses the same bundled fonts.

A slide-level image (`design.slideImage`, composed by core as `geometry.slideImage`) is drawn at the shared composition frame, beneath branding and content. `crop` (the slide image default) covers the frame from the center and `fit` centers the whole image, matching the coordinated PPTX `a:srcRect` export. With `trace: true`, `data-opf-slide-image` names the configuring design path and the `<image>` carries the asset's source path. Unresolved slide images use the ordinary placeholder and `unresolved-asset` diagnostic.

Slide-image treatments render from core's normalized geometry in the native picture's paint order:

1. The image, clipped by the preset outline that core computes from the DrawingML formula. `recolor` is applied as an sRGB `feColorMatrix` with Rec. 601 luminance weights (grayscale, or duotone from dark to light). `opacity` applies to the image only.
2. The centered border stroke on the same outline.
3. The overlay scrim.

Unresolved sources draw no treatments. See core `docs/image-treatments.md` for the vocabulary and the unsupported effects: blur, shadows, soft edges and background removal.

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

`svgToPng` returns PNG bytes for one SVG. `svgToPdf` accepts one SVG or an array of SVGs and returns PDF bytes with one slide per page. The SVG page `width`/`height` or `viewBox` determines the PDF page size. **Units: one SVG pixel is one PDF point (1/72 inch), in both modes**, so a 1280 x 720 slide is a 1280 x 720 pt page (17.8 x 10 in, not the 13.33 x 7.5 in PowerPoint prints); a viewer or printer scales it to the paper; `scale` controls raster density only. `svgToPdf` has two modes: `"vector"` (the default, see below) and `"raster"` (each slide an image, the output of earlier releases): pass `{ mode: "raster" }` for the image-only compatibility output.

### Vector PDF with selectable text

`svgToPdf(svgs, { mode: "vector" })` converts the same SVG the preview draws, without a second layout pass: every line, position and width comes from the SVG.

- Shapes, lines, polylines, paths and rounded rectangles are PDF paths; linear and radial gradients are PDF shadings and hatch/tile `<pattern>`s are tiling patterns; `clip-path`, stroke dashes, group `opacity` (a transparency-group form) and per-element opacity are native. Pictures are image XObjects (PNG with alpha as an SMask, unoriented JPEG passed through, WebP and oriented JPEG decoded as in raster mode; identical pictures are stored once).
- Text is real text: TrueType subsets (the font program, a `ToUnicode` map and a `CIDToGIDMap`) of the same font files the PNG preview draws with, positioned glyph by glyph (kerning, ligatures, combining marks and mixed scripts as fontkit shapes them), with the SVG's `textLength` and `text-anchor`, underline and strike-through. The Unicode bidirectional algorithm orders right-to-left and mixed-direction lines. Text is selectable, searchable and copies as the authored text. The encoding is the one Chromium writes, so PDFium (Chrome, Edge), poppler and pdf.js read it back the way they read a Chrome-printed page: runs are drawn in visual order, right-to-left runs are marked `/ReversedChars`, and a glyph or cluster the glyph map cannot give (an Arabic ligature or mirrored bracket, a reordered Indic or Khmer syllable, a no-break space) carries its logical text as `/ActualText`, one span per glyph or cluster. A mark the font split off a letter (Arabic dots) is drawn as a filled outline, so no extractor sees an extra character. There is no hidden text layer and no outline-only text. Known reader limits, shared with Chrome's own PDFs: PDFium duplicates some Thai and Burmese marks, PDFium reorders the runs of a mixed-direction line, and pdf.js ignores `/ActualText` (it reports reordered Indic and Khmer clusters in drawing order).
- Fonts: only the bundled pack (unless `useBundledFonts: false`), `fontFiles`, `fontDirs` and the SVG's own `@font-face` data are used; `loadSystemFonts: true` is rejected in vector mode because system fonts could be proprietary. A face whose OS/2 `fsType` forbids embedding is never embedded (a diagnostic says so); one that forbids subsetting is embedded whole. A requested family that has no face is drawn with the family the PNG preview draws (`defaultFontFamily`, `sansSerifFamily`, `monospaceFamily`, `serifFamily`) and reported.
- Document metadata: `metadata: { title, author, subject, keywords, language, creator, creationDate }`. The language defaults to the first SVG's `lang`. No date is written unless you supply one, there is no random data, and the file identifier is a hash of the content, so identical input gives identical bytes on every machine.
- Accessibility basics (not a conformance claim): the catalog carries `/Lang`, `/MarkInfo`, `/DisplayDocTitle` (with a title) and XMP metadata; with `tagged` (default) the structure tree lists, per slide in source order, headings (the `.title` placeholder), paragraphs, figures with their `aria-label` as `/Alt` and link elements bound to their link annotations, and decoration (backgrounds, rules, bullets) is marked as an artifact. Not done: PDF/UA or PDF/A claims, list and table structure, per-span languages; text inside a translucent group is not in the structure tree.
- Links: `<a href>` with an http, https, mailto or tel target becomes a link annotation on each run of its text (other schemes are refused with a diagnostic).
- Arbitrary SVG is accepted, not only the renderer's: CSS named colours, `hsl()`, `rgb()`, `style=` attributes, `<style>` rules with type, class and id selectors, percentage geometry, `<symbol>` through `<use>`, nested `<svg>`, `<switch>`, gradient and pattern fills on text, `clip-rule` are drawn; features that are not drawn (`rotate`, `dominant-baseline`, `baseline-shift`, `text-transform`, `font-variant`, `paint-order`, `mix-blend-mode`, `writing-mode`, markers, `spreadMethod` reflect/repeat, `textPath`, CSS combinators) are reported as `pdf-unsupported-feature`, `pdf-unsupported-paint` or `pdf-unsupported-css`, and a character no supplied font has is reported as `pdf-glyph-missing`; with `strict: true` each of these throws. Input is bounded: at most 50,000 elements per page (a `<use>` expansion counts every copy; `pdf-expansion-limit`), group nesting of 256, XML nesting of 1,000, and 40 megapixels per picture.
- Effects with no PDF form (SVG `filter`, `mask`, nested SVG pictures) rasterize that one element, at `rasterFallbackScale` (default 2), and say so through `onDiagnostic` (`pdf-raster-fallback`, with the `data-opf-path` of the element). With `strict: true` the export throws instead. A vector export never turns a whole slide into an image silently.

`onDiagnostic` also reports each embedded face (`pdf-font-embedded`: family, weight, glyph count, size, subset or full, `fsType`, license text), font substitution and per-character fallback. Output is byte-identical across runs and operating systems for the same SVG, font files and options.

```js
const pdf = await svgToPdf(svgs, {
  fontFiles: fonts.fontFiles, useBundledFonts: false,
  metadata: { title: "Quarterly review", author: "Finance", language: "en-GB" },
  onDiagnostic: (d) => d.code === "pdf-raster-fallback" && console.warn(d.path, d.reason),
});
```

The default changed from raster to vector in the release that added this section; callers that need the previous output pass `mode: "raster"`. Vector mode ignores `scale` and `dpi`. The page is painted white by default, as raster mode composites on white; `background: "none"` leaves it unpainted and any other colour paints that.

## PNG and PDF in a browser

`@openpresentation/opf-render/export-browser` exports `svgToPdf(svgs, options)` and `svgToPng(svg, options)` for a page. They take the SVG the preview draws and need no Node module, no network and no system font (a bundle of this entry contains no sharp, resvg, fs or crypto, and the vector converter's SHA-256 is plain JavaScript).

- **Vector PDF** (default) is the same converter the Node export uses (selectable real text in embedded font subsets, paths, gradients, patterns, clips, opacity, links, tagged structure, byte-identical output for the same SVG). Fonts come from the SVG's own `@font-face` data (pass `embeddedFonts` to `renderSvg`, for example `registry.selectEmbeddedFonts(() => true)` marked `embed: "used"` so each slide embeds only the faces it draws) or from `fontData: [{ data, family? }]`; `useBundledFonts`, `fontFiles` and `fontDirs` do not exist here and `loadSystemFonts: true` is rejected. A face the registry never loaded is never embedded.
- **Pictures** are decoded by the browser (PNG, JPEG, WebP, GIF through `createImageBitmap`, EXIF orientation applied); an upright JPEG is passed through compressed, as in Node. An effect with no PDF form (filter, mask, a nested SVG picture) rasterizes only that element on a canvas and reports `pdf-raster-fallback`.
- **Raster PDF** (`mode: "raster"`, `scale` default 2) draws each slide on a canvas as an image.
- **PNG** is drawn by the browser's SVG renderer on a canvas (`scale`, `background`, up to 40 megapixels). With the fonts embedded in the SVG it agrees with the Node (resvg) PNG to anti-aliasing (mean channel error 0.43 of 255 on a text slide).
- `signal` (an `AbortSignal`, checked between pages) and `onProgress({ page, pages })` serve large decks; the same two options also work in the Node `svgToPdf`. The browser export yields to the page between slides.

Verified in Chromium by `test/export-browser.mjs` (`npm run test:export-browser`), which also checks the text pdf.js extracts, the eight JPEG orientations, offline operation and determinism. Safari and Firefox are not exercised by this repository's CI.
Complex scripts in raster output: resvg draws a HarfBuzz cluster with the advance of its widest glyph, so Indic, Thai, Lao, Khmer and Myanmar text lost the advance of vowel signs and ran together, and it ignores the SVG `lang` (Korean spacing). The raster path therefore rewrites its private copy of such text cluster by cluster at fontkit's positions (`src/raster-text.js`): Devanagari, Gujarati, Oriya, Tamil, Kannada and Sinhala as fontkit glyph outlines, the other scripts and Korean as single clusters resvg shapes in isolation. The emitted SVG is unchanged, text in other scripts is rasterized exactly as before, and `test/script-corpora-raster.mjs` holds every script to a HarfBuzz outline reference (the fixture's `rasterLimits` records what still differs: the KOR punctuation forms).

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

## Player and `<opf-deck>` (RR-28)

A slideshow player and an embeddable web component, both built on `renderSvg`: the slide a page shows is the slide the preview, the editor and the PDF show, with no second layout engine. They are plain ES modules, typed, framework-free and tree-shakeable, and importing them touches no DOM, so they are safe in Next.js and other server renderers.

```html
<script type="module">
  import '@openpresentation/opf-render/element/define';   // registers <opf-deck>
</script>
<opf-deck src="/deck.opf.json" fonts="/opf-fonts/" thumbnails present></opf-deck>
```

```js
// A framework page: register on the client, when you choose.
import { defineOpfDeck } from '@openpresentation/opf-render/element';
useEffect(() => { defineOpfDeck(); }, []);
// ...and render <opf-deck src="/deck.opf.json" fonts="/opf-fonts/" />.
```

Entry points (package `exports`): `/element` (`defineOpfDeck`, `getOpfDeckElement`, `renderDeckHtml`, `loadPreviewFonts`), `/element/define` (importing it registers the tag; the only file with a side effect), `/player` (`present`), `/preview-fonts` (the font root layout and `loadPreviewFonts`) and `/preview-fonts-node` (`copyPreviewFonts`, also the `opf-preview-fonts` command). The element loads the player on first use, so a page that only embeds decks does not carry slideshow code.

### Fonts: one self-hosted directory

Layout is estimated and text uses the visitor's system sans-serif until you give the element a font root, a directory you serve from your own origin. Nothing is ever requested from a font CDN, and the only requests an `<opf-deck>` makes are its `src` and the font files below.

```sh
npx opf-preview-fonts public/opf-fonts                  # base and vendored faces (about 34 MiB), every SHA-256 verified
npx opf-preview-fonts public/opf-fonts --scripts Jpan,Arab   # plus Noto script faces (large; `all` for every script)
```

```
<root>/base/<package>/<file>       the eager Office and base faces (Roboto Regular loads at startup, the rest on demand)
<root>/lazy/fonts/<family>/<file>  the vendored faces (Intos for the default Aptos scheme, the open families)
<root>/scripts/<package>/<file>    the Noto script faces
<root>/LICENSES.txt                every license notice
```

It is the layout the editor playground and the OpenPresentation sites serve, and `fonts="/opf-fonts/"` (or `fontRegistry`, a registry the page already has) loads faces on demand like the renderer's browser host: face level (a plain Aptos deck fetches Roboto Regular, Intos Display Bold and Intos Regular, about 1.5 MB), hash-verified, and one registry per root on a page. If the font root cannot be read the deck still draws, with estimated layout, and the element fires a non-fatal `error` event. A face that is not in the root (a script you did not copy) falls back to a system font.

### `<opf-deck>`

Attributes: `src` (OPF JSON; the other request the element makes), `slide` (1-based; counts the slides that play), `fonts`, `thumbnails` (a strip of slide thumbnails), `controls="none"`, `present` (a Present button), `include-hidden`, `label`, `keyboard="off"`. Instead of `src` set the `document` property (an object or JSON text), or put the document in a child `<script type="application/opf+json">`. Properties and methods: `document`, `slide`, `total`, `fontRegistry`, `renderOptions` (extra `renderSvg` options such as `catalogs` and `imageResolver`), `currentSlide` (`{ slide, total, index, id, title, notes, section }`; `notes` is plain text), `ready`, `next()`, `previous()`, `first()`, `last()`, `goto(n)`, `reload()` and `present(options)`.

Events: `ready`, `slidechange` (the same detail as `currentSlide`; bubbles and is composed), `error` (`{ code, message, fatal }`, not bubbling), `presentstart` and `presentend`. Style it with custom properties (`--opf-deck-fg`, `--opf-deck-border`, `--opf-deck-radius`, `--opf-deck-focus`, `--opf-deck-accent`, `--opf-deck-stage`) and the parts `deck`, `viewport`, `slide`, `bar`, `button`, `previous`, `next`, `present`, `counter`, `thumbnails` and `thumbnail`.

Hidden slides (`hidden: true`) are skipped everywhere, so the counter, the `slide` attribute and the player's number-then-Enter all count the sequence that plays; `include-hidden` plays them all. Navigation: the buttons, ArrowLeft, ArrowRight, Page Up, Page Down, Home and End while the slide has focus (Up, Down and Space are left to the page), a horizontal swipe on touch, and the thumbnails. A deck whose `language` is right to left (and a page that sets `dir` or CSS `direction`) turns the controls and the Left and Right keys around.

Accessibility: the element is a labelled region (the deck name) holding a focusable group named `Slide 3 of 8: Revenue grew`; slide text is live SVG text in the order the renderer paints it (title, then content, then furniture), not an image, so a screen reader reads it; slide changes made by keyboard or thumbnail are announced through a polite live region; thumbnails are a list of buttons (one tab stop, arrow keys inside, `aria-current`) whose drawings are hidden from assistive technology; the buttons keep their focus ring and `forced-colors` support; and animation is limited to a hover colour that `prefers-reduced-motion: reduce` removes. The test suite runs axe-core (WCAG 2.0 to 2.2 A and AA plus best practice) over the element, the player and the speaker view with no violations. There are no transitions or builds (deferred, opf#250).

### Server markup

`renderDeckHtml(deck, options)` returns the tag with the deck's slides as inline SVG inside it. A visitor without JavaScript, a crawler or a reader sees the slides; when the element upgrades its shadow DOM replaces them. `slides: 'first'` (default: the first slide and a list of titles), `'all'` or slide numbers; `embed: true` adds the document as an `application/opf+json` child so the upgrade needs no request (it includes hidden slides and notes, as the `src` file does); `renderOptions` takes a `textMeasurement` for exact widths. In Next.js, render the string from a server component with `dangerouslySetInnerHTML` and call `defineOpfDeck()` from a client component. A strict `style-src` Content-Security-Policy needs `style-src-attr 'unsafe-inline'` for the renderer's `style="white-space:pre"` attributes; the element's own styles use constructable stylesheets.

### The slideshow

`present(source, options)` takes an OPF document, its URL or an `<opf-deck>` element and covers the page with a full-screen player (call it from a click or key handler; full screen and the speaker view need a user gesture). It resolves with a `PlayerSession` (`slide`, `total`, `next()`, `previous()`, `first()`, `last()`, `goto(n)`, `blank('black' | 'white' | 'none')`, `openPresenterView()`, `close()`; events `slidechange`, `blank`, `presenterview`, `close`). One show per document: a second call returns the running one.

Keys: Right, Down, Page Down, Space, Enter and `N` are next; Left, Up, Page Up, Backspace, Shift+Space and `P` are previous; Home and End; a slide number then Enter (Escape clears it); `B` and `W` toggle a black or white screen (any navigation key brings the slide back first); `S` opens the speaker view; `F` toggles full screen; Escape leaves (leaving full screen any other way ends the show too). Click or tap advances (the left third goes back) and a horizontal swipe navigates. The player is a modal dialog: the rest of the page is inert, focus stays inside it and returns to where it was when the show ends, and an element that started it follows the show and fires `slidechange`.

The speaker view opens in a second window (`S`, the button, or `presenterView: true`): the current and next slide (the last slide says so), the speaker notes, the section, a timer (against the deck's `duration` in minutes, with pause and reset) and the clock, previous, next and blank buttons, the same keys, and a notes size control. Notes are the OPF `notes` string and are shown as plain text only (rich notes are deferred, opf#251). The windows follow each other over a `BroadcastChannel` named from the deck, so any number of windows of one deck on one origin stay in step (a logical clock settles two changes that cross), and `present(deck, { role: 'presenter' })` makes a second tab or window the speaker view. Pass `channel` to name the channel yourself or `false` for none. The audience window and the popup are driven by this page, so closing or navigating the page ends both.

Not in v1: transitions and builds, links between slides, rich notes, translated interface strings (the controls are English) and a Window Management (multi-screen) placement of the two windows.

## Open font-scheme families (FF-31)

Font schemes select openly licensed Latin families that no Office substitute covers, and the font policy routes proprietary families to open replacements (Red Hat for Segoe UI and Tahoma and, since FF-43, Barlow, Anton, Figtree, Work Sans, EB Garamond, Archivo Narrow, Libre Caslon Text and Bitter). The office pack vendors them as static faces (`fonts/<family>/`: only the used faces, the upstream OFL notice as `OFL.txt` and a generated `PROVENANCE.json`), so `loadOfficeFontRegistry()` and `prepareNodeFonts({ pack: 'office' })` resolve each to its own face, and a strict registry no longer throws `font-unavailable` for them:

| Family | Vendored from | Faces |
|---|---|---|
| Open Sans | `@expo-google-fonts/open-sans@0.4.2` (instanced statics; no Reserved Font Name) | 400, 700, italics |
| Montserrat | `@expo-google-fonts/montserrat@0.4.2` (same) | 400, 700, italics, 900 (named by the Arial Black policy row) |
| Poppins | `@expo-google-fonts/poppins@0.4.1` (same) | 400, 700, italics |
| Bebas Neue | `@expo-google-fonts/bebas-neue@0.4.1` (same) | 400 (the family has no other style) |
| PT Serif | google/fonts `ofl/ptserif` at a pinned commit (ParaType's release, byte-identical) | 400, 700, italics |
| Lora | cyrealtype/Lora-Cyrillic v3.021, pinned commit, `fonts/ttf` | 400, 700, italics |
| Merriweather Sans | SorkinType/Merriweather-Sans, pinned commit, `fonts/ttf` | 400, 700, italics |
| Source Sans 3 (also answers to Source Sans Pro) | adobe-fonts/source-sans tag 3.052R, pinned commit, `TTF` | 400, 700, italics |
| Red Hat Display | `@expo-google-fonts/red-hat-display@0.4.1` (instanced statics; no Reserved Font Name) | 300, 400, 600, 700, italics (FF-43) |
| Red Hat Text | `@expo-google-fonts/red-hat-text@0.4.1` (same) | 400, 700, italics (FF-43) |
| Barlow | google/fonts `ofl/barlow` at a pinned commit (byte-identical statics) | 400, 700, italics (Grandview, Franklin Gothic) |
| Anton | google/fonts `ofl/anton` at a pinned commit (byte-identical) | 400 (Impact; the family has no other style) |
| Figtree | `@expo-google-fonts/figtree@0.4.1` (instanced statics) | 400, 700, italics (Tenorite, Trebuchet MS) |
| Work Sans | `@expo-google-fonts/work-sans@0.4.2` (same) | 400, 700, italics (Century Gothic, Lucida Sans) |
| EB Garamond | `@expo-google-fonts/eb-garamond@0.4.3` (same) | 400, 700, italics (Garamond) |
| Archivo Narrow | `@expo-google-fonts/archivo-narrow@0.4.2` (same) | 400, 700, italics (Arial Narrow) |
| Libre Caslon Text | `@expo-google-fonts/libre-caslon-text@0.4.0` (same) | 400, 400 italic, 700 (Baskerville Old Face, Bookman Old Style) |
| Bitter | `@expo-google-fonts/bitter@0.4.2` (instanced statics named "Bitter"; the OFL reserves "Bitter Pro") | 400, 700, italics (Rockwell) |

All are SIL OFL 1.1, and each manifest entry records the SPDX id read from the shipped notice, its Reserved Font Names, the upstream project and copyright line. An OFL Reserved Font Name stops a modified version from using the reserved name, so the families that have one (PT Serif, Lora, Merriweather Sans, Source Sans 3, Raleway, Playfair Display) are the copyright holder's byte-identical files: every face records `upstreamFile { url, sha256 }` with a commit-pinned URL and a sha256 equal to the face's own, and `test/font-licenses.mjs` enforces it. The other families have none, except Bitter (Reserved Font Name "Bitter Pro"); their files are either google/fonts statics (Barlow and Anton: byte-identical, also pinned by `upstreamFile`) or the instanced statics of the `@expo-google-fonts` packages, whose notice and version `PROVENANCE.json` records.

**Raleway** and **Playfair Display** reserve their own names, and Google Fonts serves them only as variable fonts, which the Node raster engine (resvg 2.6.2) draws at one weight (400 and 700 rendered byte-identically, and Raleway's default instance is Thin). Instancing them would be a modified version under the reserved name, so they are bundled as the copyright holders' unmodified static files instead: googlefonts/Raleway at commit `7e0be84` and clauseggers/Playfair at `6e115d7` (tag 1.202), `fonts/TTF`, four styles each, byte-identical with `upstreamFile` pins. **Bitter** (the Rockwell replacement) reserves the name "Bitter Pro". OFL only stops a modified font from carrying its Reserved Font Name in its family or file name, so the instanced statics, named "Bitter", are allowed; `test/font-licenses.mjs` implements exactly that name-contains rule for instanced faces (an instanced face named Carlito, Raleway, Lora or Playfair Display still fails, and a family that must keep its reserved name ships the unmodified upstream file). **Libre Caslon Text** has no bold italic (its static releases and the Google Fonts instances stop at Regular, Italic and Bold): a bold italic request draws the real italic and reports `visual`; bold is never synthesized.

Source Sans Pro was renamed Source Sans 3. A request for the old name draws the Source Sans 3 faces through a built-in alias (`renamedFrom` in the manifest) and is reported `visual`, in any substitution policy, because the releases differ (bold advances by about 0.7%). Source Sans 3 itself resolves exact and is also the declared replacement for Candara, Corbel, Gill Sans MT and Seaford. Red Hat Display and Text are the declared replacements for Segoe UI and Tahoma. The RedHatFont repository's own static files cannot be used: the Regular, Light and SemiBold italics (and Red Hat Text Italic) do not set the OS/2 italic bit (only the Bold Italic files do), Red Hat Display SemiBold declares weight 707 and Bold 799 (Red Hat Text Bold declares 700), so in resvg a 600 request paints as Bold and the regular and bold italics paint as one face (probed). The vendored Red Hat faces are therefore the correctly labelled instanced statics of `@expo-google-fonts` (Red Hat has no Reserved Font Name): Segoe UI Semibold draws a real 600 (and 600 italic), and Segoe UI, Segoe UI Light and Tahoma draw real italics, none synthesized. Trade-off: the shipped Red Hat Display Bold (Google Fonts weight 700 instance) is about 2.5% narrower than the RedHatFont Bold it replaces, so the Segoe UI Bold preview moves from +0.6% to -1.8% mean width against Segoe UI Bold 5.71 (mean absolute 0.95% to 1.86%, max 6.0% to 5.5%); the regular widths are identical. A style a family lacks is not synthesized: Bebas Neue and Anton bold draw the regular face and report `visual`, and an italic request throws `font-style-unavailable`, as for Roboto Mono. A test renders every vendored face through resvg and checks that exactly that face paints.

The 70 vendored faces are 12.0 MiB (FF-43 added 35 faces, 4.6 MiB uncompressed and about 2.4 MB in the tarball; the first 35 were 7.4 MiB) and are the only bytes added; there are no new dependencies. Browser hosts fetch them lazily by family, so the eager list stays the 33 Office and base faces. Every face and notice is checked against its manifest sha256 when loaded (`font-integrity-mismatch`, `font-resource-unavailable`), and `npm run test:packed` verifies the packed copies. `node scripts/update-font-manifest.mjs --vendor` re-downloads each recorded commit (or npm version), reads the license from the shipped notice, refuses a non-permissive one (only OFL-1.1, Apache-2.0, MIT and UFL-1.0 are allowed), copies only the listed faces and rewrites the hashes and provenance; `.gitattributes` keeps the binaries byte-exact.

Embedding: open faces are flagged `embed: "used"`. `registry.embeddedFonts` stays the 33 Office and base faces, while `prepareNodeFonts().options.embeddedFonts` (or `registry.selectEmbeddedFonts`) supplies every face and `renderSvg` embeds an open face only when the slide's text names its family, so a Montserrat slide carries Montserrat and not the whole pack. Raster output reads the files from `fontFiles`. `includeOpenFonts: false` leaves the open families out of the office pack entirely.

## Script fonts, lang and right-to-left text (FF-19)

Previews itemize text by Unicode script. Each run uses the OOXML script slot its script belongs to (`latin`, `eastAsian` or `complexScript`), as resolved by core `resolveScriptFonts` from the document's language and font scheme. Latin, Greek and Cyrillic text stays in the design font. The text's role picks the major (heading) or minor (body) slots: title, subtitle and tag text is heading, as in the exporter's heading shapes, and all other text is body. Licensed script fonts are never bundled. With a measured registry, a proprietary family (for example Meiryo, Microsoft YaHei, Malgun Gothic, Arabic Typesetting, David, Mangal or Angsana New) is previewed with its designated open replacement from `SCRIPT_FONT_REPLACEMENTS`, and each replacement is recorded in `registry.substitutions` as `visual`. The PPTX keeps the chosen family. If the slot's face has no glyph for a run, the run falls back by coverage to the designated OFL Noto family for its script.

The replacement faces are an optional, hash-pinned font pack: 70 static faces from 37 `@expo-google-fonts/*` packages (SIL OFL 1.1): 63 regular and bold Noto script faces from 31 packages, plus the FF-45 symbol packs (`noto-sans-symbols`, `noto-sans-symbols-2` and `noto-sans-math`, under `Zsym`: the Symbol, Wingdings and Webdings code tables draw with them), the FF-45 emoji pack (`noto-color-emoji`: Noto Color Emoji, COLRv1 and OT-SVG colour glyphs, 24.0 MiB; `noto-emoji`: the monochrome face the raster path draws) under the pseudo-script `Zsye` and the math pack (`stix-two-math`, `noto-sans-math`) under `Zmth` (Noto Sans Math serves both Zmth and Zsym). The pinned script faces total 66.9 MiB, of which 55.9 MiB is CJK; the emoji and math faces add 27.5 MiB and the symbol faces another 1.3 MiB. Installing all 37 packages takes about 361 MiB, because they also ship weights the manifest does not pin. Thirty-six of the 37 are exact optional peer dependencies, so the renderer install does not grow. The exception is `@expo-google-fonts/noto-sans` (Latin, Cyrillic and Greek; regular, bold, italic and bold italic, about 14 MiB installed), which is a pinned runtime dependency because it is the default glyph-fallback face: `loadOfficeFontRegistry` and `prepareNodeFonts({pack: 'office'})` always load it, marked fallback-only (it serves glyph fallback and requests for Noto Sans, never stands in for another family, and is embedded in a standalone SVG only when its text draws it, like the open families (embed "used"); raster output reads it from `fontFiles`). Install only the other scripts you need, then load them. Segoe UI Emoji previews with Noto Color Emoji and Cambria Math with STIX Two Math once their packs are loaded (`scripts: 'auto'` loads them for text with emoji-presentation clusters or mathematical notation, or a scheme that names the family); emoji sequences stay one run and one glyph, browsers draw them in colour, and PNG/PDF output draws the monochrome Noto Emoji because resvg has no colour-glyph support. The emoji pack is opt-in by use: `scripts: 'auto'` (Node) and `ensureScripts` (browsers) load Noto Color Emoji (24 MiB) only for a deck with emoji-presentation text or a scheme that names Segoe UI Emoji, and it is an optional peer dependency, so it is not in the npm tarball; `scripts: 'all'` loads it too, so pass an explicit script list when memory or download size matters. The PPTX keeps the chosen family either way:

```js
import { prepareNodeFonts } from '@openpresentation/opf-render/fonts-node';
import { renderSvgDeck, svgToPng } from '@openpresentation/opf-render';

// npm install @expo-google-fonts/noto-sans-jp@0.4.3 @expo-google-fonts/noto-naskh-arabic@0.4.5
const { options } = await prepareNodeFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: ['Jpan', 'Arab'] });
const slides = renderSvgDeck(presentation, options);
const png = await svgToPng(slides[0], options);
```

`scripts` accepts ISO 15924 codes (`Jpan`, `Hans`, `Hant`, `Kore`, `Arab`, `Hebr`, `Deva`, `Beng`, `Thai` and others; see `scriptFontPackages('all')`) or `'all'`. `detectScripts(presentation)` from `/fonts` lists the scripts a document's text needs. Every face and license notice is checked against `BUNDLED_FONT_MANIFEST`. A missing package fails with `font-resource-unavailable` and names the exact version to install. Script faces are left out of `options.embeddedFonts` unless you pass `embedScriptFonts: true`, because a CJK face is 5 to 10 MB. Raster output reads them from `fontFiles`. In a browser, serve the installed packages and load `scriptFontEntries(scripts, { baseUrl })` from `/fonts-browser` with `loadBrowserFontRegistry`. The loader verifies each entry's SHA-256 with Web Crypto before use.

### Load only the script faces a document uses (`scripts: 'auto'`)

Hosts do not need to detect scripts themselves. `scripts: 'auto'` reads the presentation's drawn text and loads only the faces for the scripts it uses: a Latin, Greek or Cyrillic deck loads none, a Japanese deck loads Noto Sans JP, an Arabic deck the three Arabic packages. Text decides, so a deck whose `language` is `ja` but whose text is Latin still loads nothing. The one exception is a font scheme that names a script font (Yu Gothic, Meiryo, Malgun Gothic, Microsoft YaHei, Arabic Typesetting, Mangal or a pinned Noto family, on the deck or on a slide's `design`): its Latin text previews with that font's open replacement, so its face loads whatever the text, and Han-only text in such a deck draws with the scheme's CJK face. `detected` still lists only what the text draws; `scripts` is what to load. The document language only tells Han text apart (through core `resolveScriptFonts`, the same profile the renderer plans with; a core without it treats Han as Simplified Chinese, as the renderer does). Only drawn text counts (titles, text, list items, runs, table cells, chart labels, code, quotes, metrics, furniture); ids, image alt text and sources, URLs, assets, catalogs, speaker notes, `extensions`, a slide's `beat` and the deck's own name, description, filename, author, speaker, audience, purpose, tone, takeaway, duration, tags and narrative are ignored. The organization and a slide's `section` count only when a design turns on that generated header or footer field. Detection itemizes text exactly as drawing does, so with an East Asian language the curly quotes, dashes and ellipsis count as East Asian. `detectPresentationScripts(presentation)` and `autoScriptSelection(presentation)` (from `/fonts-node` and `/fonts-browser`) return the decision.

```js
// Node: pass the presentation with scripts: 'auto'. Auto never fails on a package that is not installed
// or a script no pinned font serves; it reports them through onDiagnostic and registry.scriptSelection.
const { options, registry } = await prepareNodeFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation });
registry.scriptSelection; // { detected, scripts, unavailable, packages, notInstalled }

// Browser: script faces are fetched lazily, once each, hash-verified, from where the host serves the
// installed @expo-google-fonts packages. Call ensureScripts after every edit and render again afterwards.
const fonts = await loadBrowserFontRegistry(baseEntries, { substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scriptBaseUrl: '/script-fonts/' });
if (fonts.pendingScripts(presentation).length) await fonts.ensureScripts(presentation); // resolves { detected, scripts, unavailable, loaded }
// pendingScripts is synchronous: empty means nothing is missing, so render at once.
// Text decides, so the analysis does not resolve layouts or catalogs. Pass the render options (renderOptions: { catalogs } to
// loadBrowserFontRegistry, or per call) so a font scheme only the host's catalogs have and that names a script font (Yu Gothic) counts.
```

Where the renderer has per-character glyph fallback (`glyphFallbackFamilies`), auto also loads Noto Sans when the text has Greek or Cyrillic (the chosen Latin face may lack it), and the next CJK face of the fallback chain when a drawn Han, kana or Hangul character is missing from the loaded ones (a Simplified-only hanzi in Japanese text, hanja). That is capped at one fallback package beyond the packages the text's own scripts need: a character no CJK face covers never pulls in all four (10 to 20 MiB each); it is listed in `ensureScripts().uncovered` (Node: `script-glyph-uncovered`, `registry.scriptSelection.uncovered`) and the renderer reports `missing-glyph`. Browser loads are all or nothing per package: a failed fetch, hash check or `FontFace.load()` leaves the registry, the document and `loadedScriptPackages` unchanged and the package pending. One failing package does not lose the others: `ensureScripts` loads every package it can, then rejects with an `OPFFontError` whose `details` are `{ loaded, failed: [{package, code, message}] }`, and the next call retries only the failures. `ensureScripts(presentation, { signal })` and `loadScripts(scripts, { signal })` take a per-call `AbortSignal` (the creation signal is not reused), and `dispose()` during a load leaves no face behind and rejects with `font-registry-disposed`. Script faces carry `embed: "used"`, like the open families: the eager `registry.embeddedFonts` leaves them out, and when you pass them explicitly (`registry.selectEmbeddedFonts(face => face.scripts)`) an SVG embeds one only when the slide's text uses its family, so a Latin slide never carries a CJK face.

`loadBrowserFontRegistry` also accepts `scripts: 'auto'` with `presentation` (loads on creation), and `fonts.loadScripts(['Arab'])` for explicit scripts. A registry grows in place: `registry.addFaces(entries)` registers faces atomically, refreshes the script aliases (Meiryo resolves to Noto Sans JP once its face exists) and drops `registry.substitutions` recorded before the face existed, so hosts keep one `textMeasurement`. Faces are never unloaded before `dispose()`. Measurements planned before a face was added (for example a long-lived `createScriptTextMeasurement` wrapper) do not know it; call `ensureScripts` before creating them. Sizes: one CJK package is 10.4 (Japanese), 20.1 (Simplified Chinese), 13.6 (Traditional Chinese) or 11.8 MiB (Korean); the three Arabic packages total 1.8 MiB and each other script under 1.5 MiB. A Latin-only deck downloads nothing extra.

The renderer measures and paints with the same runs. A line whose runs use different families is drawn as positioned tspans, each with its own measured advance. For consistent line breaks, pass the same measurement to pagination and editing: `createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(presentation))`. Without a registry, the SVG names every candidate family in order (for example `Meiryo, Noto Sans JP, sans-serif`), and the host resolves glyphs itself.

The SVG root carries `lang` and `xml:lang` from the document's `language`. Measurement applies the same OpenType language system that a browser selects for that `lang`; Noto Sans KR spacing, for example, differs under `KOR`. Direction is set per paragraph, meaning the text between hard line breaks. The rule is core's `paragraphDirection(text, deckDirection)`, the same function the exporter uses for `a:pPr rtl`. A paragraph is right to left when the deck language is right to left and its first strong character is right to left, or it has none. Strong characters follow UAX #9 P2: isolates are skipped, LRM/RLM/ALM count, and the letters of every right-to-left script, historic ones included, are right to left. The renderer does not keep its own copy of the rule. With a core that lacks the function, every paragraph is left to right, as in export, and a right-to-left deck reports `paragraph-direction-unavailable`. Every wrapped line of a right-to-left paragraph is laid out as a right-to-left isolate (U+2067 ... U+2069), so lines of one paragraph never differ. Measured rich-text fragments are placed from the right edge.

When the installed core has no `resolveScriptFonts` (core 0.11.0 and earlier, which this release no longer accepts by default) and the document names a `language`, the renderer reports `language-preview-unavailable` once through `onDiagnostic`. The preview then uses the design font for every script, sets no `lang` and lays out every paragraph left to right. If the resolver throws, the renderer falls back the same way and reports `language-preview-unresolved`.

A face that lacks a character never fails a preview. As in a browser or PowerPoint font linking, each character the resolved face lacks is measured and drawn with the first loaded face that has it, along a fixed chain (`glyphFallbackFamilies(character, profile)`): the character's own script face, the deck language's script face, Noto Sans (Latin, Cyrillic and Greek), the other CJK faces (Japanese, Simplified, Traditional, Korean), then every other Noto script face. A Greek or Cyrillic word under Georgia (Gelasio) or a script scheme's face (Constantia previews with the open PT Serif, which has Cyrillic, so only its Greek text falls back), Greek under Meiryo, Yu Gothic, Microsoft YaHei or Malgun Gothic, Japanese-only kanji beside Hangul, and Simplified-only hanzi in a Japanese deck therefore draw with Noto Sans or the CJK face that has them, and each word stays in one face when one has all of it. Each substitution is reported once per family pair and path as a `font-glyph-fallback` diagnostic through `onDiagnostic` (`fontFamily`, `fallbackFamily`, `scripts`, `characters`); it is a note, not an error. Pass `glyphFallback: 'none'` to `renderSvg` or `createScriptTextMeasurement` to keep exact faces, so a missing glyph raises `missing-glyph` again. Coverage is checked per grapheme cluster and per word: a base letter and the combining marks after it (NFD Vietnamese, Cyrillic U+0306) move together to the first face that has the whole cluster, and only their word moves, not the sentence. Without a registry, a Greek or Cyrillic run names `Noto Sans` after the design font in its font stack. With `scripts: 'auto'`, the CJK fallback faces are loaded for you: the language's face plus at most one fallback face (opf-render#55's cap). Greek and Cyrillic need no package, because the office registry always carries Noto Sans. Serif decks prefer the serif face of each script where one is pinned (Noto Serif Hebrew, Tibetan); no Noto Serif is bundled for Latin, Cyrillic, Greek or CJK, so their fallback text draws in the sans face. A character that no loaded face has still raises `missing-glyph`. The PPTX export is unchanged: it names the chosen font and PowerPoint links its own fallback fonts.

Characters are assigned to slots following PowerPoint where its rules are known:

- Letters take their script's slot.
- CJK symbols and punctuation (U+3000-303F), kana, enclosed and compatibility CJK, and halfwidth and fullwidth forms (U+FF00-FFEF) always use the East Asian slot, even at the start of a text.
- With an East Asian document language (ja, zh, ko), curly quotes, dashes, the ellipsis, daggers, primes and the reference mark also use the East Asian slot.
- ASCII spaces, digits and punctuation use the latin slot next to East Asian text. They stay with complex-script text, and leading ones join a following complex-script run.
- Other common characters and combining marks join the preceding run.

Limits:

- Alignment is logical for right-to-left text (RR-05, needs the core release that composes right-to-left decks): `left` is the start edge, so a right-to-left paragraph is drawn against the right edge, its list markers sit at the right (`text-anchor="end"`), the composition is mirrored (the `left` region and the first table column at the right, cover logo and header/footer zones swapped), tables run right to left and column, line and area charts reverse their categories with the value axis at the right. Every wrapped line takes its paragraph's direction from core (`fit.directions`). A left-to-right deck is drawn exactly as before.
- Known differences from PowerPoint: the character tables above are approximations, not PowerPoint's full per-character table. Non-ASCII common characters, such as Latin-1 symbols and other general punctuation, join the neighbouring run instead of following PowerPoint's per-character slot, and PowerPoint's `hint="eastAsia"` run property is not modelled.
- Per-run language (`lang` on individual runs) is not modelled. Han text uses kana or Hangul context, then the document language, and defaults to Simplified Chinese.
- Faces have no italics, so italic script text uses upright advances. Browsers may slant it synthetically.
- Serif CJK replacements (Noto Serif JP/SC/TC/KR) are designated but not pinned; serif CJK requests, and serif Latin, Cyrillic and Greek fallback text, use the sans face unless you supply a serif face (a loaded designated serif family is preferred automatically).
- Shaping uses fontkit. An offline Chromium check keeps 37 runs across 28 cases within 0.1 px of HarfBuzz advances (`npm run test:script-fonts-browser`). Other texts, fonts and PowerPoint's own shaping are not certified.
- Estimated (unmeasured) rich text keeps logical fragment order and relies on the browser's bidi algorithm.

These browser entrypoints are included in the published package. For coordinated development, the sibling OPF repository's `pnpm pack:ecosystem` prepares local npm tarballs. See the core repository's [live editor guide](https://github.com/OpenPresentation/opf/blob/main/docs/live-editor.md) for installation and the fidelity contract. Identical SVG geometry does not guarantee identical raster pixels across browser engines or PowerPoint.

## Templates and variables (RR-32)

A deck that declares content variables, or is marked `"template": true`, is resolved by core `resolveVariables` before it is composed, so the preview and the PPTX exporter agree. Pass the values as `variables`:

```js
import { renderSvgDeck } from '@openpresentation/opf-render';

renderSvgDeck(template, { variables: { client: 'Globex', revenue: 1250000 } });
```

A template previews with each unfilled variable's `example` and reports `variable-example-used` through `onDiagnostic`; a variable with no example keeps its `{{id}}` text. A normal deck with an unfilled required variable throws `OPFRenderError` with code `unfilled-variables`, and a value of the wrong kind throws `invalid-variables`. `resolvePresentation(...).presentation` is the concrete deck. `variables: false` draws the document as authored, with tokens and `var:` references visible (the editor canvas's view of a template, so inline edits never overwrite a token). Decks without content variables are untouched. Needs the core release that ships `resolveVariables`; with an older core the option is ignored. See [templates and variables](https://github.com/OpenPresentation/opf/blob/main/docs/templates-and-variables.md).

### Symbol-encoded families: Symbol, Wingdings, Webdings (FF-45)

Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings keep their glyphs at the 224 codes 0x20..0xFF of a Microsoft Symbol cmap, not at Unicode code points, and none of them may be bundled. A run or design font in one of them no longer fails with `font-encoding-required`: each character is normalised to its code (the private-use character U+F0xx that Office writes for Insert > Symbol and `a:sym` runs, or the Windows-1252 character of the code, so "l" and U+F06C are the same Wingdings bullet) and mapped through core's reversible, version-specific tables (`@openpresentation/opf` `spec/reference/symbol-font-encodings.json`, snapshot `src/symbol-encodings.js`; `mapSymbolText('Wingdings', 'l')` gives U+26AB) to the Unicode equivalent, which the first loaded face of the family's chain draws: `SYMBOL_PREVIEW_FACES` is Noto Sans Symbols 2, Noto Sans Symbols, Noto Sans Math, Noto Sans for the dingbat fonts and Noto Sans (Greek letters, digits, punctuation) first for Symbol. The three symbol packages are optional peers of the script pack under the key `Zsym` (`scripts: ['Zsym']`; `scripts: 'auto'` selects it when a run, `design.fonts` or a font scheme names one of the families; `registry.ensureScripts(presentation)` in a browser): `@expo-google-fonts/noto-sans-symbols-2`, `noto-sans-symbols` and `noto-sans-math`, OFL-1.1, together about 1.2 MiB. Every code the tables map (1059 of 1120: Symbol 189, Wingdings 222, Wingdings 2 217, Wingdings 3 208, Webdings 223) draws a real glyph when the pack is loaded; the 61 codes without a Unicode equivalent (the Wingdings 0xFF Windows logo, unassigned codes) draw the placeholder U+25A1. Each glyph is one positioned tspan at the advance of the verified Windows font (Wingdings 5.01, Wingdings 2 and 3 1.55, Webdings 5.01, Symbol 5.01), in measurement and drawing alike, so line breaks and bullet gaps follow PowerPoint; the open glyph keeps its shape and is compressed to its code's advance only when wider, never stretched. Characters that are not codes (a CJK letter in a Wingdings run) draw as themselves. Without the pack, Symbol's Greek letters, digits and punctuation draw with the office pack's Noto Sans, the other codes draw U+FFFD, and the `font-glyph-fallback` diagnostic (`codes`, `placeholder`) names the pack; a registry with no chain face and no `fallbackFamily` throws `font-encoding-required`, naming it too. `resolveFont` and `resolveStyle` report `symbolEncoding` with the substitute face, so exporters keep writing the chosen family and the original characters, and the PPTX names Wingdings with its codes. The symbol faces also end the glyph fallback chain. Appearance is the open face's, not Microsoft's; native PowerPoint verification of the exported runs is separate (FF-46).

## Numbered lists (RR-33)

An `items` or `bullets` payload with a `numbering` field draws numbers instead of bullets: `{ "items": ["Define", "Build", "Ship"], "numbering": "roman-lower" }` previews as `i.`, `ii.`, `iii.`. The number is core's composed marker (`ListEntryLayout.marker.text`), drawn at core's marker position, baseline and size with the weight and slant core measured it at (a native PowerPoint auto-number takes the first run's bold and italic), at the wider hanging indent core composes for wide markers (`viii.`, `10.`). Bullet lists, picture bullets and every deck without `numbering` draw exactly as before. Needs a core release that composes `numbering`; an older core ignores the field and draws bullets. See core's [numbered lists](https://github.com/OpenPresentation/opf/blob/main/docs/numbered-lists.md).

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
- `pdf-lib` assembles raster-mode PDF bytes locally. Metadata timestamps are disabled so repeated PDF output is byte-stable for the same SVG input and options.
- Vector PDF output is written by a small deterministic PDF writer in this package, with `pako` for Flate compression (pure JavaScript, so independent of the platform zlib build), `fontkit` for shaping and font metrics and `bidi-js` for the Unicode bidirectional algorithm. No hosted service, network call or system font is involved.
- Bundled OFL Roboto and Roboto Mono TTF files provide the default deterministic font fallback.
- `svgToPng` and `svgToPdf` disable system-font loading by default. Hosts that require branded fonts should pass explicit `fontFiles` or `fontDirs`; `loadSystemFonts: true` is an opt-in escape hatch for PNG and raster-mode PDF output and can make it environment-dependent. Vector-mode PDF rejects it (`pdf-system-fonts-unsupported`): it embeds only fonts you supply, so a system font can never be embedded by accident.

Browser support boundary: `renderSvg`, `renderSvgDeck`, and `resolvePresentation` are browser-importable pure JavaScript APIs. The root `svgToPng` and `svgToPdf` are Node APIs because they depend on the Node builds of resvg and sharp. For a page, `@openpresentation/opf-render/export-browser` has the same two names (see below).

Chartex chart previews (FF-22b) draw the constructs opf-pptx exports as Office 2016 chartex parts: `treemap` (squarified tiles of the first series, one colour per tile, category labels), `histogram` (a lone value column binned like PowerPoint with Scott's rule count and right-closed bins, or one column per category), `pareto` (columns sorted descending with the cumulative-percentage line on a 0-100% axis), `box-and-whisker` (rows grouped by category, one box per series, exclusive quartiles, whiskers within 1.5 IQR, mean markers, outlier points), `waterfall` (floating bars from the running total, increases and decreases in the first two palette colours, connector lines) and `funnel` (centred bars with value labels). `world` is an honest non-geographic preview: one tile per region shaded by value with its name and value. No geography data is shipped; PowerPoint draws the real map from Bing geodata it fetches itself, so the preview and the native map agree on labels, values and the series colour, not on shapes. Each chartex kind also accepts a lone value column (row numbers as categories; histogram and pareto bin the values). Every mark and label keeps a `data-opf-path` (bins and boxes trace to their value column).

Chart options (RR-35): a chart's optional `axisTitles`, `legend` and `dataLabels` (core `docs/chart-options.md`) are drawn. A named legend position is carved from the chart box before the plot is laid out, axis titles sit beside the axes (the value title rotated 270 degrees), and data labels follow the content (category, value, percent), position and separator the chart type supports. An option a type cannot show is dropped with a `chart-option-adapted` diagnostic; a chart without the fields draws as before.

Classic chart previews keep finite axis coordinates for subnormal values and values up to `Number.MAX_VALUE`, including mixed positive/negative ranges. At these limits, available numeric precision can merge adjacent axis ticks or prevent extra headroom. Authored values are unchanged. Stacked, percentage or pie/doughnut totals that overflow the finite numeric range are still unsupported: rendering throws a `RangeError` naming the chart path and asking the caller to rescale the values. It does not substitute an empty chart or silently discard the overflowing values.

Category-axis labels follow PowerPoint's automatic labelling instead of wrapping inside a band (column, bar, line and area charts, including stacked and 100%, and the chartex histogram, pareto, waterfall, funnel and box-and-whisker previews). A label is never broken inside a word: it stays on one line, or splits at its spaces onto two lines when a band is too narrow, so `Category 1` cannot become `Ca` over `t 1`. When the labels do not fit horizontally they turn to -45 degrees, then -90 degrees (the plot area shrinks to make room, by at most 40% of the chart height, and a slanted first label must stay inside the chart), and when even that collides the axis draws every n-th label (Office's automatic `tickLblSkip`): n is the smallest interval that leaves no two drawn labels overlapping, the first label is always drawn, and ties go to the less rotated arrangement. In horizontal bar charts and funnels, where the category axis is vertical, rows shorter than a line of text are skipped the same way, and the label gutter grows with the longest label up to 30% of the chart width. Only a label wider than that gutter (or wider than the whole chart on a horizontal axis) is ellipsized, and then the renderer reports one `chart-label-truncated` diagnostic per chart with the affected label paths in `labels`; nothing is shortened silently, and no arrangement raises `text-overflow` for an axis label. Radar spoke labels use the same one-line, two-line or ellipsis rule and leave out a spoke label that would collide with one already drawn. Rotated labels are wrapped in a `<g transform="rotate(...)">` around their usual text group, so the traced `data-opf-box-*` attributes describe the unrotated box. PowerPoint applies its own automatic rotation and skip to the exported chart: opf-pptx writes an automatic axis text body (`<a:bodyPr/>`, no `rot`) and no `tickLblSkip` for these axes, so nothing forces a wrap, and the preview and the export make the same kind of choice, not identical ones (the export uses 9 pt labels, the preview the readability floor).

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

Public npm package publication is handled by `.github/workflows/npm-publish.yml` through npm Trusted Publishing (GitHub Actions OIDC) with npm provenance; no npm token is stored. The owner authorized agents to prepare and publish npm releases whenever a release is required (2026-09-29). This authorization does not waive any gate.

1. Open a release-prep PR containing only the version bump, `CHANGELOG.md` (assembled from `changes/` with `node scripts/changelog-fragments.mjs assemble --version X.Y.Z`), dependency ranges, lockfile and current-instruction docs. Publish in dependency order (core, then renderer and PPTX, then editor): refresh this repo's lockfile only after the required `@openpresentation/opf` version is on the registry (`npm install --package-lock-only`), then run `npm run test:packed` against it.
2. Merge after CI is green, then publish by pushing the git tag `opf-render-v<version>` (or `@openpresentation/opf-render@v<version>`) at the merge commit. The workflow verifies that the tag matches `package.json` and reruns audit, typecheck, validate, tests, packed and browser checks before `npm publish --access public --provenance`. A manual `workflow_dispatch` runs the same job without the tag check and is a fallback only.
3. Verify with `npm view @openpresentation/opf-render@<version> version gitHead dist.attestations` and, from the core repo, `node scripts/test-renderer-publication.mjs <version> <release-commit> <this-checkout>`. Never republish an existing version.

## Shared dynamic composition (local development)

The current checkout uses `@openpresentation/opf/composition` for portable geometry. Slides can select `auto`, `row`, `column`, or `grid`, set weighted tracks, and request path-specific overflow diagnostics. See the sibling OPF repo's `docs/dynamic-composition.md` for the complete contract.

Version 0.3.0 requires core 0.5.0 and renders rich table cells and headers using canonical `TextRun[]`, including editor trace geometry.

Version 0.2.x requires the published `@openpresentation/opf@^0.4.1` for composition, pagination and measured text. A clean `npm ci && npm test` uses registry packages and runs the full raster corpus without sibling checkouts. For coordinated source development, build OPF and run `node scripts/link-ecosystem.mjs` there; `pnpm test:ecosystem` checks editing, rendering, editable PowerPoint geometry and import together.

For actual font measurement, load `loadBundledFontRegistry()` from `@openpresentation/opf-render/fonts-node`, then pass its `textMeasurement` to rendering and its `embeddedFonts` to SVG export. Pass its `fontFiles` to PNG/PDF conversion. The browser-safe `@openpresentation/opf-render/fonts` entry accepts local font bytes. Missing fonts/glyphs fail explicitly; aliases and fallback are opt-in and recorded in `registry.substitutions`. Bundled font license notices travel with embedded SVG fonts.

Raster updates produce an HTML gallery and `artifacts/golden/candidate.json`; they never overwrite the approved baseline automatically (baselines are directories with one file per deck; `npm run golden:promote` writes only the decks that moved). See [baseline review and known limitations](test/golden/README.md).

Version 0.1.1 adds rich-text line offsets and measured boxes to opt-in SVG tracing, including blank lines, for editor caret placement. Normal SVG/PNG output is unchanged.

## Embedded WebP in PNG/PDF output (since 0.2.0)

PNG and PDF conversion now decode embedded WebP image data URIs to static PNG before rasterization. This preserves fit/crop, transparency, EXIF orientation and the first animation frame. The source SVG and OPF document remain unchanged; browser SVG output keeps the original embedded image. Both href and legacy xlink:href are supported, including base64 and percent-encoded data. This step does not resolve local filenames, download remote images or change the existing host imageResolver contract.

The Node-only raster path lazily loads pinned Sharp 0.35.4, requiring Node 22 or later for this package and normal installation of its optional platform binaries. Browser exports do not include the decoder. Malformed embedded WebP produces image-conversion-failed with its data-opf-path when present, otherwise svg.images.N. Decoding has a 40-megapixel limit. PNG/PDF are static outputs; animation beyond the first frame and original image metadata are not retained.

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
