# OPF Render

**OPF 0.18 (RR-73, RR-74, unreleased; requires core 0.18).** One shape for every engine: `toX(deck, slides?, options?)`. The second argument is a slide number (one result), a selection (`"1-3"`, `"1,3-5"`, `"2-"`, `[1, 3]`; a list of results) or the options, told apart by type, and slides count from 1. Renamed and removed outright (no aliases); an old option fails with `invalid-render-options` or `invalid-conversion-option` and names its replacement:

| 0.17 | 0.18 |
| --- | --- |
| `renderSvg(deck, options)` | `toSvg(deck, options)` |
| `renderSlideSvg(deck, index, options)` (from 0) | `toSvg(deck, index + 1, options)` (from 1; `slide-out-of-range`) |
| `svgToPng(svg, options)`, `svgToPdf(svgs, options)` | `toPng` and `toPdf`: they take a deck (and draw it with `toSvg`) or SVG |
| `renderDeckHtml(deck, { slides })` | `toHtml(deck, slides?, options?)` (`"1-"` for every slide) |
| `embedFonts: false`, `textAsPaths: true` | `text: "system"`, `text: "paths"` (default `"fonts"`) |
| `mode: "raster"` | `raster: true` (vector is the default) |
| `fontDirs` | `fonts`: the handle, or font folders (a path or a list) for SVG input |

**OPF 0.15 (FA-23, unreleased; requires core 0.15).** Catalogs are registered by the host, and every picture is an image background or an image block. The breaking changes are listed in `changes/fa-23-opf-0-15.md` (the next CHANGELOG section); the [0.15 design](https://github.com/OpenPresentation/opf/blob/main/docs/programs/format-audit/0.15-design.md) explains them.

- The renderer bundles, looks up and fetches no catalog. Every entry point (`toSvg`, `resolvePresentation`, the font loaders' `renderOptions`, `/player`, `<opf-deck>`) takes core's `catalogs: Catalog[]` and passes it unchanged to core resolution. Register the gallery snapshot yourself: `import { defaultCatalog } from '@openpresentation/opf/catalog'` and `toSvg(deck, { catalogs: [defaultCatalog] })`. `strictReferences: true` fails with `unresolved-reference` instead of falling back.
- What resolves nowhere draws with core's engine defaults (`engineDefaults` is `{ theme, colorScheme, fontScheme, chartType }`: core's `ENGINE_DEFAULT_THEME`, `ENGINE_DEFAULT_COLOR_SCHEME`, `ENGINE_DEFAULT_FONT_SCHEME`) and is reported once per reference as `unresolved-reference`.
- An image background (`design.background: { type: "image", src, alt, fit, focus, opacity, recolor, overlay }`, or an image source string) draws from core's `geometry.backgroundImage`: the canvas colour, the picture (cover, contain, stretch or tile; recolor and opacity on the pixels only), then the overlay (the whole slide or an edge band). `alt` is the picture's accessible name; without it the picture is decorative.
- Every content picture is an image block drawn from `item.image`: frame, fit (`cover`, `contain`, `stretch`; default `design.imageFit`, else `cover`), focus, shape mask, border, opacity, recolor and overlay, and a placed block (`placement`) at its edge band.

**Lighter install (RR-63, unreleased, 0.16.0).** `pdf-lib`, `@resvg/resvg-js`, `sharp` and every `@expo-google-fonts/*` font package are optional peer dependencies, loaded on first use: an SVG-only install holds none of them. Add what you export (see [Install](#install-what-to-add-for-what-rr-63)); a missing converter rejects with `converter-missing`. New `/png` and `/pdf` entries beside `/svg`. Rendered output is unchanged.

**0.14.0 (RR-55, with core 0.14.0, opf-pptx 0.14.0 and opf-editor 0.14.0).** One fonts handle, whole-deck and one-slide render functions, and core's slide context. This release renames and deletes outright (no aliases; the CHANGELOG has the old-to-new table):

- `renderSvg(deck, options)` returns `string[]`, one SVG per slide; `renderSlideSvg(deck, index, options)` returns the SVG of one slide.
- `loadFonts(options)` from `/fonts-node` or `/fonts-browser` (the environment is the subpath) returns the one fonts handle: `{ textMeasurement, embeddedFonts, fontFiles, useBundledFonts, loadSystemFonts, registry, manifest, substitutions, ensure, pending }` (a browser handle also has `dispose`). `createFontRegistry` is an internal building block, not an export.
- Every deck-level function takes `{ fonts }` (the handle, or any object with a `textMeasurement`) instead of separate `textMeasurement`, `embeddedFonts`, `fontFiles`, `useBundledFonts` and `loadSystemFonts` options: `renderSvg`, `renderSlideSvg`, `svgToPng`, `svgToPdf`, `/export-browser`, `/player`, `<opf-deck>` and `renderDeckHtml`.
- `OPFRenderError` `invalid-opf` carries `findings`: the error findings of core `validate(deck, { only: ['format'] })`.
- The layout engine is read from `@openpresentation/opf/composition`; `/fonts` re-exports core's `FONT_POLICY` (the table: `.families`, `.provisionalDecisions`), `fontPolicyFor`, `isSymbolEncodedFamily`, `symbolCodeOf`, `mapSymbolText` and `scriptFontRole` rather than keeping copies.

```js
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toSvg, toPng, toPdf } from '@openpresentation/opf-render';
import { paginate } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
const { presentation } = paginate(opf, { fonts });
const slides = toSvg(presentation, { fonts });          // every slide
const first = toSvg(presentation, 1, { fonts });   // one slide
const png = await toPng(slides[0], { fonts });
const pdf = await toPdf(slides, { fonts });
const pptx = await toPptx(presentation, { fonts });
```

A slide's canvas, layout, theme, colour scheme and font scheme come from core's `resolveSlideContext` (slide design, then deck design, then theme, then the engine default), from the records the document embeds and the catalogs the host registers (`catalogs`), so preview, pagination, validation and export resolve them one way. A slide with no `layout` composes automatically. A reference that resolves nowhere never throws: the slide composes automatically or draws with core's engine defaults, and the render reports `unresolved-reference` (naming the reference and the catalog's source) through `onDiagnostic`; with `strictReferences: true` it throws `OPFRenderError` `unresolved-reference` instead.

An option a function does not know is not read: a top-level `textMeasurement` or `embeddedFonts` is ignored, so pass `{ fonts }`.

**Aptos previews with Intos.** The Office pack includes Intos, Intos Display, Intos Narrow and Intos Serif (16 faces, about 12 MB, vendored under `fonts/intos/`, SIL OFL 1.1, pinned to upstream commit fef9315c14da9e4b23b4c3cac8e718998d4e4736 and per-file SHA-256, unmodified from the upstream files). They are the metric-compatible previews for Aptos, Aptos Display, Aptos Narrow and Aptos Serif, the default `aptos` font scheme: 0.000% mean and maximum width difference against Aptos 2.01 in all four styles, with equal vertical metrics. The letter shapes are Intos's own, not Aptos's. The exported PPTX still names Aptos; no Aptos file is bundled or embedded. A registry built without these faces (the base pack) has no Aptos substitute: visual policy falls back to Roboto or Carlito. Like the open families, Intos is `embed: "used"`: it is not in `registry.embeddedFonts` (the 33 eager npm faces), the `loadFonts()` handle's `embeddedFonts` supplies it, and an SVG embeds only the Intos faces its text draws. `registry.lazyFonts` lists the 51 vendored faces (35 open, 16 Intos) with package-relative file and sha256, and `loadFonts({ faces, lazyFontsBaseUrl })` from `/fonts-browser` loads them on demand: `await fonts.ensure(presentation)` (the registry's `ensureLazyFonts` and `ensureScripts` are the lower-level calls) fetches and verifies only the faces the document draws, by family, weight and style (a plain Aptos deck: Intos Display Bold and Intos Regular, 2 files, 1.5 MB; an italic run adds Intos Italic, a bold run Intos Bold; the code face only when a slide has code), then adds them to the document and the registry together so measurement and painting never disagree. Faces a host serves itself load the same way: `loadFonts({ faces: startup, extraLazyFonts: [{ family, weight, italic, url, sha256 }] })` adds them to the lazy list (`registry.lazyFonts`, `package: "host"`), so the registry can start with Roboto Regular only (`splitStartupFaces(faces)` splits a manifest into the startup face and the rest) and a document draws, fetches and verifies just the faces it needs, vendored and host faces in one `ensureLazyFonts` call. `sha256` is mandatory, loads are all or nothing, `dispose()` removes the faces, and, like the vendored ones, host faces are `embed: "used"`: they are not in `registry.embeddedFonts` (only the startup faces are), and a standalone SVG embeds one only when passed explicitly through `registry.selectEmbeddedFonts` and the slide's text uses its family. `fonts.pending(presentation)` (and the registry's `pendingLazyFonts`) is the synchronous check hosts gate rendering on, and after an edit it reports just the newly needed faces. The faces are those the renderer itself measures and draws (`presentationFaces(presentation, options, registry)`, one layout-and-paint run with a recording measurement), resolved by the registry's own face selection over the faces it holds plus the vendored ones, so the browser loads exactly what Node draws with every vendored face loaded. A document resolves with the `toSvg` options the host renders with: pass them as `loadFonts({ faces, renderOptions: { catalogs } })`, or per call (`pendingLazyFonts(presentation, { catalogs })`, `ensureLazyFonts(presentation, { signal, catalogs })`), so a layout or font scheme id that only the host's catalogs know resolves here too; a document that does not resolve throws (rejects) what `toSvg` throws for it instead of reporting nothing. Node's `loadFonts` keeps loading the whole open pack and Intos eagerly, so nothing there is face level; with `scripts: 'auto'` they accept `renderOptions: { catalogs }` too. Hosts copy the vendored directories next to the page.

Version 0.12.0 requires `@openpresentation/opf` ^0.12.0 (composed font sizes on PowerPoint's 0.01 pt grid, hanging wrap whitespace, promoted regions in reading order, right-to-left decks composed mirrored) and draws what that core composes, plus the preview changes listed in the changelog; use it with opf-pptx 0.12.0 and opf-editor 0.11.0 so preview and export resolve one core. Version 0.11.9 requires `@openpresentation/opf` ^0.11.4 and draws the design fields (deck and organization logos on covers and section slides, header and footer `logo` parts, `design.listBullet: image` picture bullets at the size PowerPoint draws them, the accent font, `contentDirection` and `chartPrimary` through core composition), and the slide tag falls back to the text colour when the scheme primary is under 4.5:1 against the background; furniture images sit on their zone edge. Use it with opf-pptx 0.11.7 and opf-editor 0.10.6 so preview and export resolve one core (no API change; the preview of covers, list slides with picture bullets, chart slides with a primary chart and slides with furniture images changes). Version 0.11.8 draws the slide tag in the scheme primary colour, as opf-pptx 0.11.5 writes it (no API change; the preview of slides with a tag changes). Version 0.11.7 lets a browser registry load the host's own faces on demand (`extraLazyFonts`, `splitStartupFaces`: a registry can start with Roboto Regular only; additive, `registry.lazyFonts` still lists the 94 vendored faces plus the host's). Version 0.11.6 makes the category-axis labels of chart previews rotate and skip instead of wrapping mid-word (no API change; the preview of dense-axis chart slides changes) and requires `@openpresentation/opf` ^0.11.3 (the 70 legacy gallery layout ids and their geometry); use it with PPTX 0.11.4 and editor 0.10.4 so preview and export resolve the same core. Version 0.11.5 loads vendored preview fonts by face, not by family, and lets the font loaders resolve documents with the host's render options (`presentationFaces`, `lazyFacesNeeded`; `pendingLazyFonts`, `ensureLazyFonts`, `pendingScripts` and `ensureScripts` take `catalogs` and throw or reject with the `toSvg` error for a document that does not resolve; `registry.lazyFonts` still lists 94 faces). Version 0.11.4 previews the seven chartex chart types natively (the world map as a non-geographic tile grid), keeps the Latin Noto Sans replacement for script schemes under `scripts: 'auto'` in Node, shapes Noto Sans Mongolian again and bundles Raleway and Playfair Display (`registry.lazyFonts` lists 94 faces; no API change). Version 0.11.3 previews the classic chart types natively, draws deprecated chart ids as their replacement and scales value axes like Office (no API change; the preview of chart slides changes). Version 0.11.2 makes `scripts: 'auto'` load the script faces a font scheme names and adds `details.loadedFaceHasGlyph` to `missing-glyph` (no export change). Version 0.11.1 adds the open replacement font families the policy routes to and complete Red Hat styles (no API change). Version 0.11.0 requires `@openpresentation/opf` ^0.11.2 (cover centering, Intos Aptos previews, lazy font loading, automatic script fonts and glyph fallback); use it with PPTX 0.11.0 and editor 0.10.0 so preview and export resolve the same core. Version 0.10.0 required `@openpresentation/opf` ^0.11.1 (font policy table, script fonts and right-to-left paragraphs, socials, image treatments, formatted slide-number and date furniture with the host `date` option, per-item alignment). See the changelog for the intentional preview-output changes.

Version 0.9.0 required `@openpresentation/opf` ^0.11.0 and resolved content ColorRef / `variables` through core `resolveColorRef()`. Authored `#RRGGBB` paint stays authored. It retains the existing rendering APIs.

Version 0.8.1 required core 0.10.1, including metric, quote and timeline layout placeholders and the corrected text-bullet contract.

Unfinished prepared shaping work is preserved in the [September 15 roadmap](docs/roadmap-shaping-20260915.md); it is not part of the published runtime.

This checkout supports Node 22 or later (`engines.node` `>=22`; CI tests Node 22, 24 and 26). Versions 0.8.0 to 0.12.0 declared `24.x`, so npm on Node 22 or 26 silently installed an older release instead (RR-20); upgrade past 0.12.0. Use `.nvmrc` (Node 24) for local development. Earlier published versions retain their original engine declarations. Browser entrypoints remain browser-safe; native application compatibility is verified separately.

Version 0.8.0 adds optional font-registry vector outlines and shared heading/scalar/rich line placement. Pass the same `fonts` handle and `textRasterPadding` option to preview, pagination and export; padding defaults to one scaled reference pixel. SVG consumes accepted origins without remeasuring. See the [source contract and limits](https://github.com/OpenPresentation/opf/blob/f94125a1ff95bf0974a055fe1c081d348dad54f2/docs/plans/text-placement.md). Native raster certification remains separate.

Version 0.8.0 requires core 0.10.0 and renders accepted quote and code geometry without fitting it again. Code filename/language/body parts preserve source whitespace, literal tabs and metadata case and expose trace targets for editing. The [43 reviewed code raster changes](docs/evidence/shared-code/raster-review.json) retain the other 762 corpus hashes. Coordinated releases PPTX 0.8.0 and editor 0.7.0 add native source recovery and editing. Glyph containment and separation do not establish native pixel equivalence.

Deterministic local renderer for Open Presentation Format documents. The shared SVG core implements validation, reference resolution (through core, against the catalogs the host registers), placeholder binding and text layout. Node APIs additionally convert SVG to PNG and to PDF (vector with selectable text by default, or raster-backed).

In version 0.8.0, `design.contentBox` uses core's shared padded geometry. The card renders at `item.frameBox`; its payload uses `item.box` and accepted internals. Card padding participates in composition scoring, strict overflow and pagination. This requires core 0.10.0.

Version 0.8.0 paints plain and rich text, titles, subtitles and tags using composition's accepted fits and resolved styles. A `TextRun[]` title, subtitle, tag or quote text (FA-10) is painted the same way, through the rich-line painter used for body text. Painting does not measure those payloads again. Supply a font registry during composition: reusing an estimated fit cannot correct spacing when the actual drawing font has different advances.

Citations, footnotes and captions (core RR-34 fields `cite`, `footnote`, `references` and `caption`) draw from the same composed geometry: a marker is a superscript segment after its run (traced as `data-opf-segment="marker"` without source offsets), the slide's footnote area is a rule and `<n> <text>` lines in the muted colour above the footer band, and a caption is a band inside its block's region. Decks without those fields render as before.

`loadFonts` in `/fonts-node` prepares the fonts. It verifies all selected font files and license notices against the versioned `BUNDLED_FONT_MANIFEST`, including exact npm versions and SHA-256 hashes. Carlito is not an npm dependency: the package ships the unmodified google/fonts Carlito files and their OFL notice in `fonts/carlito`, pinned to a google/fonts commit and verified by the same hashes. The returned handle configures layout, SVG, editing, PPTX, and Node raster output with the same font inputs (`textMeasurement`, `embeddedFonts`, `fontFiles`, `useBundledFonts: false`, `loadSystemFonts: false`, plus `registry`, `manifest`, `substitutions`, `ensure(presentation)` and `pending(presentation)`):

```js
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toSvg, toPng } from '@openpresentation/opf-render';
import { paginate } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts({
  pack: 'office', substitutionPolicy: 'visual',
});
const { presentation } = paginate(opf, { fonts });
const slides = toSvg(presentation, { fonts });
const png = await toPng(slides[0], { fonts });
const pptx = await toPptx(presentation, { fonts });
console.log(fonts.substitutions);
```

`pack` is `base` (default), `office` or `none` (only the `faces` you supply). The `base` pack contains nine Roboto/Roboto Mono faces and suits a document using `design.fontScheme: 'roboto'`. The Office pack includes 24 Office-substitute faces plus 70 vendored faces of the open families that font schemes select and the open replacements the font policy routes to (below) and the 16 vendored Intos faces that preview the Aptos family (below), and defaults to metric substitution policy. Its four Carlito faces are the byte-identical upstream release (OFL reserves the name "Carlito", so a subset or conversion could not keep it); visual substitution remains explicit. Neither helper changes the document's authored font scheme or installs system fonts. The authored (selected) font is the source of truth. Licensed fonts are never bundled, so these packs supply open look-alikes for previews and SVG: metric-compatible where one exists (Carlito for Calibri, Intos for Aptos), visual-only where none does yet (a documented fallback and known layout-fidelity gap). The PPTX exporter still writes the selected name; see the [OPF font policy](https://github.com/OpenPresentation/opf/blob/main/docs/font-fidelity.md#font-policy-ff-31). Missing resources, changed bytes/notices, and unexpected package versions fail with actionable font errors. Requested/resolved substitution records remain on `registry.substitutions`; source paths appear where the caller supplies them. Font coverage, variant naming, shaping, and native fidelity retain their documented limits.

Default PNG/PDF raster loading now uses the same complete nine-face base pack, fixing omitted semibold and italic faces. A handle says `useBundledFonts: false` because it already holds its files; a plain `fonts: { useBundledFonts: false }` draws with no bundled face. Font files must stay available and unchanged for subsequent raster calls. `node scripts/update-font-manifest.mjs` is an explicit maintenance operation requiring review of font bytes, style metadata, licenses and raster changes; builds and installs never regenerate the expected hashes.

Version 0.8.0 resolves OpenType preferred-family groups, so a Roboto request at 500, 600 or 800 selects the installed Medium, SemiBold or ExtraBold face. Explicit caller family renames keep their own namespace; ambiguous grouped faces reject. Resolved styles also carry optional `fontFace` metadata with the physical legacy family and its bold/italic style-link flags. Coordinated PPTX export consumes those flags independently of numeric weight. This prevents requesting a second bold style from an already named ExtraBold/SemiBold family. Browser CSS and native selectors retain their respective family names; no font is synthesized or installed by this lookup. See [exact-weight evidence and limits](docs/evidence/font-variants/README.md).

Code strings that [XML 1.0 cannot represent](https://www.w3.org/TR/xml/#charsets) reject rendering with `invalid-code-text`, the OPF field path and UTF-16 offset. Input JSON stays unchanged. Tabs, line endings and valid supplementary Unicode remain accepted; schema validity and XML serialization do not certify font coverage or native fidelity.

## Pass `fonts`, otherwise the estimate

Text measurement comes from one place: the `fonts` handle that `loadFonts()` (from `/fonts-node` or `/fonts-browser`) returns. Pass the same handle to preview, validation, pagination and export, so that every step measures with the faces the preview draws:

```js
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toSvg, toPng, toPdf } from '@openpresentation/opf-render';
import { validate } from '@openpresentation/opf';
import { paginate } from '@openpresentation/opf/pagination';
import { toPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts({ pack: 'office' });
const report = validate(deck, { fonts });                 // overflow findings use the real widths
const { presentation } = paginate(deck, { fonts });        // page breaks use the real widths
const svgs = toSvg(presentation, { fonts });              // line breaks use the real widths
const png = await toPng(presentation, 1, { fonts });
const pdf = await toPdf(presentation, { fonts });
const pptx = await toPptx(presentation, { fonts });        // the same lines in editable PowerPoint text
```

One handle carries the measurement for core's `validate`, `paginate` and slide context, for `toSvg`, `toPng` and `toPdf`, and for opf-pptx's `toPptx`. The same handle gives identical text geometry across those engines: every engine reads core's one composition, so the measurement decides the lines. [opf-pptx's `layout-parity` test](https://github.com/OpenPresentation/opf-pptx/blob/main/test/layout-parity.mjs) checks that the exported PowerPoint paragraphs agree with this renderer's SVG and with core's composed items, with and without `fonts`.

A call without `fonts` is not an error. It uses core's built-in estimate instead of measured widths: 0.54 em per character, 0.62 em for capitals and digits, 0.32 em for a space, 1 em for CJK characters and zero for combining marks. The estimate is deterministic and needs no font files, but it is too narrow for some scripts (opf#566 tracks improving it), so line breaks, overflow findings and page breaks from an estimated run can differ from what the faces actually draw. Treat an estimated preview as a draft. Core's Node `convert` and the `opf` CLI prepare an office-pack handle for you; a library call to `toSvg`, `toPng` or `toPdf` never loads fonts on its own, so pass the handle you want. Compare [opf#364](https://github.com/OpenPresentation/opf/issues/364).


## Install: what to add for what (RR-63)

`npm install @openpresentation/opf-render` brings the SVG renderer, layout and text measurement (`@openpresentation/opf`, `fontkit`, `bidi-js`, `pako`) and the vendored font files under `fonts/`. The heavy pieces are **optional peer dependencies**, so you install only what your output needs. npm 7+ and pnpm do not install optional peers; add them yourself:

| You want | Import | Also install |
| --- | --- | --- |
| SVG in a browser (the host serves its own font files) | `@openpresentation/opf-render/svg` (+ `/fonts-browser`) | nothing |
| SVG in Node, no fonts handle (estimated widths) | `@openpresentation/opf-render/svg` | nothing |
| SVG in Node with exact text measurement | `/svg` and `loadFonts` from `/fonts-node` | the font packages of the pack (below) |
| PNG in Node | `/png` (or the root) | `npm install @resvg/resvg-js` (`sharp` too for WebP and rotated JPEG pictures) and the fonts of the pack |
| PDF in Node (vector, the default) | `/pdf` (or the root) | the fonts of the pack; `sharp` for pictures; `@resvg/resvg-js` for the rare element drawn as an image (a filter, a mask) |
| PDF in Node, `raster: true` | `/pdf` (or the root) | `pdf-lib`, `@resvg/resvg-js`, `sharp` and the fonts of the pack |
| PNG and PDF in a browser | `/export-browser` | nothing (`raster: true` needs `pdf-lib`, see below) |
| Slideshow, `<opf-deck>`, server markup | `/player`, `/element`, `/element/define` | nothing |

The font packages are pinned exactly (`@expo-google-fonts/*`, each a pinned optional peer; what each pack holds is described under `pack` above and in [Script fonts](#script-fonts-lang-and-right-to-left-text-ff-19)). `loadFonts()` (pack `base`) needs `@expo-google-fonts/roboto@0.4.3` and `roboto-mono@0.4.2`; `loadFonts({ pack: 'office' })` also needs `arimo`, `caladea`, `cousine`, `gelasio`, `tinos` and `noto-sans`. A script face (`scripts: ['Jpan']`, `scripts: 'auto'`) needs its own `@expo-google-fonts/noto-*` package. The `fonts/` directory (the vendored Carlito, Intos and open families, about 28 MB) ships inside the package.

Converter ranges: `@resvg/resvg-js@^2.6.2`, `sharp@^0.35.5`, `pdf-lib@^1.17.1`.

### The format entries

| Entry | What it is | Runs in |
| --- | --- | --- |
| `@openpresentation/opf-render/svg` | `toSvg`, `resolvePresentation`, `OPFRenderError` and the types. No converter, no Node module. | browser and Node |
| `@openpresentation/opf-render/png` | `toPng` | Node |
| `@openpresentation/opf-render/pdf` | `toPdf` | Node |
| `@openpresentation/opf-render/export-browser` | `toPng` and `toPdf` for a page (canvas) | browser |
| `@openpresentation/opf-render/element`, `/element/define`, `/player` | `toHtml`, `<opf-deck>`, `present` (the HTML output) | browser (`toHtml` also on a server) |
| `@openpresentation/opf-render` | all of `/svg`, plus `toPng` and `toPdf` | Node (a browser bundler picks `/svg`) |

There is no `/html` entry: it would only repeat `/element` (`toHtml`, `defineOpfDeck`) and `/player` (`present`) under a second name. A bundler that bundles Node code (a server framework) sees the converters' dynamic `import()` in the root and in `/png` and `/pdf`; an app that only draws SVG should import `/svg`, which has none, and an app that exports should list the converters as installed (or external) in its bundler.

A server bundle needs no bundler config for `/fonts-node` and `/preview-fonts-node` either: a Next.js app (Turbopack or webpack) that imports them builds and renders what plain Node renders (`npm run test:next-bundle` checks this against Next.js 16). They read harfbuzzjs's `.wasm` files, the installed `@expo-google-fonts/*` packages and this package's `fonts/` directory from disk at run time, through Node's own resolution, so a bundler does not trace them. A deployment that ships only traced files (Next.js `output: "standalone"`, serverless functions) must include those packages, for example with `outputFileTracingIncludes`. Without harfbuzzjs, `loadFonts` still loads the fonts and reports `harfbuzz-unavailable` through `onDiagnostic`: an SVG then embeds whole faces, and outlines are shaped with fontkit.

### A missing converter or font package

An export that needs a converter that is not installed rejects with `OPFRenderError` code `converter-missing`. `details` holds `package`, `range`, `install` (the command), `purpose` and `installed` (`false` when the package is absent; `true` when it is installed but cannot load, for example a native binary missing for the platform):

```js
try { await toPng(svg); }
catch (error) {
  // error.code === 'converter-missing'
  // error.message: '@resvg/resvg-js is not installed. It is an optional peer dependency of @openpresentation/opf-render, used for PNG output, ...: run `npm install @resvg/resvg-js@^2.6.2`.'
}
```

`toPng` needs `@resvg/resvg-js`; a WebP or rotated JPEG picture in it also needs `sharp`. `toPdf` (vector) needs no converter for text and shapes, `sharp` for pictures and `@resvg/resvg-js` for an element it has to draw as an image (reported as `pdf-raster-fallback`); `raster: true` needs `pdf-lib` and `@resvg/resvg-js`. A picture is never silently dropped from a PDF because `sharp` is absent: the export rejects instead.

A font pack whose `@expo-google-fonts/*` packages are not all installed rejects `loadFonts` with `OPFFontError` code `font-resource-unavailable`; `details.packages` and the message name every missing package with the `npm install` command. `scripts: 'auto'` still reports a missing script package as the `script-font-not-installed` diagnostic instead of failing. In a browser, `export-browser` imports no converter: a raster PDF takes the module as an option (`toPdf(svgs, { raster: true, pdfLib })` with `import * as pdfLib from 'pdf-lib'`), so a bundle of the entry holds no PDF library; without it a raster PDF rejects with `converter-missing`.

Installed size, measured on Windows with `npm install --ignore-scripts`, unpacked. sharp brings its 19 MiB libvips build on each platform; of the SVG-only install, 28 MiB is the vendored font files under `fonts/`, 13 MiB core and 6 MiB fontkit:

| Install | 0.15.0 | with RR-63 |
| --- | --- | --- |
| SVG only, in a browser (`/svg` + `/fonts-browser`) | 135 MiB | **56 MiB** |
| Node SVG and PNG (base pack) | 135 MiB | **89 MiB** |
| Everything (office pack, all converters) | 135 MiB | 135 MiB |

## Scope

- Package: `@openpresentation/opf-render`
- Repository: `OpenPresentation/opf-render`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Entry points: root, `/svg`, `/png`, `/pdf`, `/export-browser`, `/fonts-node`, `/fonts-browser`, `/fonts`, `/player`, `/element`, `/element/define`, `/preview-fonts`, `/preview-fonts-node` (see [Install](#install-what-to-add-for-what-rr-63))
- Public API: `toSvg(opf, slides?, opts)` (every slide, one slide or a selection), `resolvePresentation(opf, opts)`, `toPng(opf or svg, slides?, opts)`, `toPdf(opf or svgs, slides?, opts)` and `loadFonts(opts)` (`/fonts-node`, `/fonts-browser`)
- Player and embedding (RR-28): `<opf-deck>` and a slideshow with a speaker view, see [Player and `<opf-deck>`](#player-and-opf-deck-rr-28)

`toSvg(deck)` returns one SVG string per slide (`skipHidden: true` leaves out slides marked `hidden`, the player's sequence, so the result is then shorter than the deck); `toSvg(deck, 3)` returns the SVG of the third slide (slides count from 1; out of range throws `slide-out-of-range`), and `toSvg(deck, "1-3")` or `toSvg(deck, [1, 3])` the selected slides, hidden or not (`invalid-slide-selection` for a malformed one). Every form checks the format at the boundary (core `validate(deck, { only: ['format'] })`; a failure throws `OPFRenderError` `invalid-opf` whose `findings` are the error findings), resolve references from the document's embedded records and the host's `catalogs` (core `Catalog[]`, never fetched), and emit byte-stable SVG for the same input. With a `fonts` handle, each SVG embeds as `@font-face` data only the faces of `embeddedFonts` that its own text draws (by family, weight and style; a face flagged `embed: "always"` goes into every SVG), so the handle is safe to pass to every preview: over the 127 core example decks, an office-pack slide carries 2.4 MB on average (4.1 MB at most) instead of every eager face (15 MB), a base-pack slide 0.53 MB instead of 1.76 MB. Each embedded face is also cut to the glyphs the slide draws (RR-65): the Node handle (and a browser handle given `subsetWasm`, the URL of `harfbuzzjs/dist/harfbuzz-subset.wasm` the host serves, or its bytes or compiled module) subsets each face with HarfBuzz's own subsetter (hb-subset from the pinned harfbuzzjs, MIT), keeping every layout feature, so the browser shapes and draws it exactly like the whole face (147 example slides with 384 embedded faces are pixel-identical in a browser) and the bytes are the same for the same slide. Over the 127 core example decks an office-pack slide falls from 2.4 MB to 59 KB on average (2.85 MB to 59 KB at the median, 1.95 GB to 48 MB for all 807 slides), a base-pack slide from 530 KB to 73 KB. Only a face whose license allows a modified version is cut: a bundled face (by sha256 against the pinned manifest) under a permitted license whose family and file names do not contain a Reserved Font Name of its package (a subset is a modified version, owner decision 2026-09-29) and whose OS/2 fsType allows subsetting; Carlito, Raleway, Lora, Playfair Display, PT Serif, Merriweather Sans, Source Sans 3 and every face a host supplies are embedded whole. `subsetFonts: false` embeds whole faces (for an SVG whose text will be edited outside the renderer). A face whose OS/2 fsType forbids embedding (Restricted License 0x0002, or bitmap-only 0x0200, since an SVG carries outlines) is never embedded (RR-76): the SVG names its family without the data, so a viewer without the font draws the generic family, and a `font-embedding-restricted` diagnostic lists the faces left out. `renderDeckHtml` with `fontMode: "shared"` embeds each face once for the page, cut to the characters all of its slides draw (a three-slide Roboto page: 53 KB, against 101 KB with per-slide subsets and 442 KB with whole shared faces). `text: "system"` writes no `@font-face` data at all (the handle still measures), for a browser host whose `loadFonts` handle already added the faces to the page; keep the default where an SVG must stand alone (a file, the browser PDF export). Slide background colours (solid, gradient stops, pattern colours) accept the same colour references as text and table colours: a hex value, a `var:` variable, or a colour scheme slot or role such as `accent2` or `primary`.

Accessibility of the SVG (FA-30): the slide root is a labelled container, `role="group"` with `aria-roledescription="slide"` and `aria-label` set to the slide title, never `role="img"`, which would make every text node inside presentational. Titles, body text, list entries, quotes, metrics, table cells, captions, footnotes and header or footer text stay live text a screen reader reaches, in the order the renderer paints them. Purely decorative drawing (the background and its overlay, card frames, table cell fills and borders, dividers, timeline markers, watermarks, and an image whose `alt` is `""`) carries `aria-hidden="true"`. A picture with `alt` is `role="img"` with that label (a header or footer picture without `alt` is hidden); a chart with `alt` is a `role="img"` group, and one with `alt: ""` is hidden. `<opf-deck>`, the player and `toHtml` remove the root's `role`, `aria-roledescription` and `aria-label` (the slide section or figure around the drawing carries the one name), so a slide is announced once.

Text as outlines (RR-64): `toSvg(deck, { fonts, text: "paths" })` draws every `<text>` as glyph outlines, so the SVG needs no font and looks the same in every browser, image viewer and design tool. Each glyph is a `<use>` of an outline kept once per slide in `<defs>` (in font units, under an id made of the face's content hash and the glyph id, so SVGs inlined on one page never mix up glyphs); positions and widths are the vector PDF's layout of the renderer's pinned lines, and the glyphs are shaped by HarfBuzz, the shaper browsers use (the Node handle always; a browser handle given `shapeWasm`, the host's copy of `harfbuzzjs/dist/harfbuzz.wasm`; fontkit otherwise). Over the 30 script corpora every outlined glyph has HarfBuzz's id and position (fontkit, which the layout measures with, picks other glyphs on 10 samples: Bengali, Thai, Lao, Khmer, Myanmar, Syriac and Japanese combining marks); a run inside a pinned width is scaled to it, as the browser scales text. Over the core example decks resvg draws an outlined slide like its text (mean channel difference at most 0.006 of 255) and an outlined slide is about 40 KB at the median (60 KB at p90, 106 KB at most) against 0.5 to 4 MB with whole embedded faces. It needs the fonts handle `loadFonts()` returns, which carries the outline engine as `fonts.outlines` (`text-as-paths-needs-fonts` otherwise); the handle's faces are parsed for outlining once, on the first outlined slide. Each outlined element is a group that keeps the element's attributes and `data-opf-*` trace (a tspan's trace stays on a nested group); its glyphs are hidden from assistive technology and each outlined line is also real text, invisible (`fill="none"`, the generic family, so no face is embedded for it) and pinned to the drawn width, in reading order: a screen reader reads the words as text (the FA-30 tree, checked with axe), and selection, copy and find-in-page work. Links stay `<a>`; underline and line-through are rectangles from the font's own metrics. A run stays text where outlines would not be faithful, reported as `text-as-paths-fallback` with its `reason`: a colour or bitmap font (`colour-font`, emoji), a face whose fsType restricts embedding (`restricted`), or a run with no pinned width on which HarfBuzz and the layout's measurement disagree by more than 0.1 px (`shaping`); the SVG embeds just those runs' faces. The trade-offs, which make it the choice for thumbnails, previews and portable SVG files and not for an editing surface: the drawn text is not editable (a caret and an input method need live text in its own font); a vector PDF made from an outlined SVG has paths instead of selectable text, so `toPdf` should get the `<text>` SVG; browsers draw outlines without the hinting they give text, so small text looks a little lighter than browser text (resvg already draws text as outlines); and in `/fonts-browser` the outline engine adds about 85 KB (minified) to the bundle. Plan and later phases: [opf-render#164](https://github.com/OpenPresentation/opf-render/issues/164).

The preview draws three accepted spec fields from tables shared with opf-pptx through core (`@openpresentation/opf`): `code.language` colours code (comments, strings, numbers, keywords, names and types, in theme-derived colours kept at 4.5:1 or more on the code panel; an unknown language stays plain and the text is never changed), `metric.trend` draws an arrow beside the trend word (green up, red down, neutral flat, with "Trend: up" as its text alternative) and colours the delta and trend text, and every one of the 54 DrawingML preset pattern backgrounds draws from its 8 x 8 bitmap (one pixel per 1/96 inch from the slide's top-left). With a core that lacks these exports the preview draws plain, without a new diagnostic. `scripts/derive-pattern-bitmaps.mjs` compares a PowerPoint export of the pattern slides with core's tiles (ECMA-376 names the presets without defining their pixels; core's tiles were measured with it from desktop PowerPoint, Office 365, Windows, 2026-10-01).

```js
import { toSvg } from "@openpresentation/opf-render";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";

const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual" });
const svgs = toSvg(opf, { trace: true, fonts });
console.log(fonts.substitutions);
```

Set `trace: true` to stamp rendered SVG elements with `data-opf-path` values such as `slides.0.title`; omit it for smaller production SVG.

The installed open font pack works offline. The Aptos family previews with the metric-compatible Intos even under the default metric policy; this example additionally permits visual-only look-alikes for families with no metric replacement yet (a documented fallback), and the substitution report identifies requested and resolved faces. A visual substitute is not a claim of metric or pixel equivalence, and it is a known layout-fidelity gap rather than the end state. Replacements apply to rendering only; the document keeps the selected font name. Omit `substitutionPolicy` to restrict the Office pack to its metric mappings, or supply your own licensed faces (`faces`). Missing fonts/glyphs fail explicitly. Without `fonts`, synchronous SVG APIs use estimated widths; named fonts alone do not make rich-run spacing reliable. Browser hosts should load the same bytes using the loader below.

Unresolved images produce an `unresolved-asset` diagnostic through `onDiagnostic`, including the OPF path, reason and complete description. The fallback shows a bounded status label when it fits above the selected readability floor, otherwise an icon with the full accessible description. The label is `Image unavailable` over the description (alt, else title, else `Image`) in semibold at 20 px on a 1280 x 720 canvas, and opf-pptx exports the same placeholder as native shapes. It preserves authored opacity, including faint decorative watermarks; a missing image is still missing even when its fallback fits. Use `strictAssets: true` to reject unresolved images. Supply embedded raster data URIs or a synchronous host `imageResolver` to resolve them; the renderer does not fetch URLs or read local paths. Caller descriptions and other metadata override referenced asset metadata through alias chains. These diagnostics identify unresolved sources, not malformed image bytes or native PowerPoint compatibility.

Header/footer images and watermarks fit their complete artwork within their allocated regions. Image blocks use their own `fit`, else `design.imageFit` (default `cover`), as core resolves it into `item.image.fit`.

An `image/svg+xml` data URI (base64 or text) is drawn as an image wherever a raster is (image block, header/footer, watermark, logo, background, picture bullet), with the raster's box and fit, when it is an `<svg>` in the SVG namespace with an intrinsic size (`width` and `height`, or a `viewBox`); anything else keeps the `Image unavailable` placeholder. opf-pptx exports the same picture as a native SVG picture over a PNG fallback. An SVG used as an image never runs script or loads anything outside its own document, in a browser or in PNG/PDF output; PNG and PDF output draw it with resvg, and its text uses the same bundled fonts.

Image backgrounds (core `geometry.backgroundImage`, FA-22) never move content. They paint in this order: the canvas colour (the colour scheme's default slide background), the picture, the overlay, then watermark, logo and content. `cover` (the default, and what an image source string means) covers the slide and keeps the `focus` point in view, `contain` centers the whole picture, `stretch` fills the slide, and `tile` repeats the picture at its intrinsic size (one picture pixel per reference pixel) from the top-left. `opacity` applies to the picture only. With `trace: true` the picture carries the background's path (`slides.N.design.background`, `design.background` or `theme`).

Image blocks (core `item.image`, FA-22) draw from core's normalized geometry in the native picture's paint order:

1. The picture in `item.image.box` with `fit` and `focus` (a centered cover is the native center crop; another focus uses core's `fitImage` placement), clipped by the preset outline core computes from the DrawingML formula (`imageShape()`). `recolor` is applied as an sRGB `feColorMatrix` with Rec. 601 luminance weights (grayscale, or duotone from dark to light). `opacity` applies to the picture only.
2. The centered border stroke on the same outline.
3. The overlay, over the frame's shape or an edge band (`data-opf-image-overlay` names its path with `trace: true`).

A placed block (`placement`) arrives with its edge band as its region, and headings and body compose in the rest of the slide; with `trace: true` its group carries `data-opf-image-placement`. The 15 pptx.gallery image treatments, written this way, draw the same pixels as the 0.14 renderer drew them (`test/image-treatments.mjs`). Unresolved sources draw the ordinary placeholder and no treatments. See core `docs/image-treatments.md` for the vocabulary and the unsupported effects: blur, shadows, soft edges and background removal.

PNG and PDF conversion APIs are async because they load the local raster/PDF engines on demand:

```js
import { toSvg, toPdf, toPng } from "@openpresentation/opf-render";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";

const fonts = await loadFonts({ pack: "office", substitutionPolicy: "visual" });
const svgs = toSvg(opf, { fonts });
const png = await toPng(svgs[0], { fonts, scale: 1 });
const pdf = await toPdf(svgs, { fonts });
```

`toPng` returns PNG bytes for one slide or one SVG, and a list for a deck, a selection or a list of SVGs. `toPdf` takes a deck (every slide, or a selection: `toPdf(deck, "2-4")`), one SVG or a list of SVGs and returns PDF bytes with one slide per page. Given a deck, both draw it with `toSvg` and the same options (the fonts handle measures it); SVG input takes no selection. The SVG page `width`/`height` or `viewBox` determines the PDF page size. **Units: one SVG pixel is one PDF point (1/72 inch), in both modes**, so a 1280 x 720 slide is a 1280 x 720 pt page (17.8 x 10 in, not the 13.33 x 7.5 in PowerPoint prints); a viewer or printer scales it to the paper; `scale` controls raster density only. `toPdf` is vector by default (see below); `raster: true` draws each slide as an image, the output of earlier releases.

### Vector PDF with selectable text

`toPdf(svgs)` converts the same SVG the preview draws, without a second layout pass: every line, position and width comes from the SVG.

- Shapes, lines, polylines, paths and rounded rectangles are PDF paths; linear and radial gradients are PDF shadings and hatch/tile `<pattern>`s are tiling patterns; `clip-path`, stroke dashes, group `opacity` (a transparency-group form) and per-element opacity are native. Pictures are image XObjects (PNG with alpha as an SMask, unoriented JPEG passed through, WebP and oriented JPEG decoded as in raster mode; identical pictures are stored once).
- Text is real text: TrueType subsets (the font program, a `ToUnicode` map and a `CIDToGIDMap`) of the same font files the PNG preview draws with, positioned glyph by glyph (kerning, ligatures, combining marks and mixed scripts as fontkit shapes them), with the SVG's `textLength` and `text-anchor`, underline and strike-through. The Unicode bidirectional algorithm orders right-to-left and mixed-direction lines. Text is selectable, searchable and copies as the authored text. The encoding is the one Chromium writes, so PDFium (Chrome, Edge), poppler and pdf.js read it back the way they read a Chrome-printed page: runs are drawn in visual order, right-to-left runs are marked `/ReversedChars`, and a glyph or cluster the glyph map cannot give (an Arabic ligature or mirrored bracket, a reordered Indic or Khmer syllable, a no-break space) carries its logical text as `/ActualText`, one span per glyph or cluster. A mark the font split off a letter (Arabic dots) is drawn as a filled outline, so no extractor sees an extra character. There is no hidden text layer and no outline-only text. Known reader limits, shared with Chrome's own PDFs: PDFium duplicates some Thai and Burmese marks, PDFium reorders the runs of a mixed-direction line, and pdf.js ignores `/ActualText` (it reports reordered Indic and Khmer clusters in drawing order).
- Fonts: only the bundled pack (unless the handle says `useBundledFonts: false`), the handle's `fontFiles` (or the font folders given as `fonts`) and the SVG's own `@font-face` data are used; a handle with `loadSystemFonts: true` is rejected for a vector PDF because system fonts could be proprietary. A face whose OS/2 `fsType` forbids embedding is never embedded (a diagnostic says so); one that forbids subsetting is embedded whole. A requested family that has no face is drawn with the family the PNG preview draws (`defaultFontFamily`, `sansSerifFamily`, `monospaceFamily`, `serifFamily`) and reported.
- Document metadata: `metadata: { title, author, subject, keywords, language, creator, creationDate }`. The language defaults to the first SVG's `lang`. No date is written unless you supply one, there is no random data, and the file identifier is a hash of the content, so identical input gives identical bytes on every machine.
- Accessibility basics (not a conformance claim): the catalog carries `/Lang`, `/MarkInfo`, `/DisplayDocTitle` (with a title) and XMP metadata; with `tagged` (default) the structure tree lists, per slide in source order, headings (the `.title` placeholder), paragraphs, figures with their `aria-label` as `/Alt` and link elements bound to their link annotations, and decoration (backgrounds, rules, bullets) is marked as an artifact. Not done: PDF/UA or PDF/A claims, list and table structure, per-span languages; text inside a translucent group is not in the structure tree.
- Links: `<a href>` with an http, https, mailto or tel target becomes a link annotation on each run of its text (other schemes are refused with a diagnostic).
- Arbitrary SVG is accepted, not only the renderer's: CSS named colours, `hsl()`, `rgb()`, `style=` attributes, `<style>` rules with type, class and id selectors, percentage geometry, `<symbol>` through `<use>`, nested `<svg>`, `<switch>`, gradient and pattern fills on text, `clip-rule` are drawn; features that are not drawn (`rotate`, `dominant-baseline`, `baseline-shift`, `text-transform`, `font-variant`, `paint-order`, `mix-blend-mode`, `writing-mode`, markers, `spreadMethod` reflect/repeat, `textPath`, CSS combinators) are reported as `pdf-unsupported-feature`, `pdf-unsupported-paint` or `pdf-unsupported-css`, and a character no supplied font has is reported as `pdf-glyph-missing`; with `strict: true` each of these throws. Input is bounded: at most 50,000 elements per page (a `<use>` expansion counts every copy; `pdf-expansion-limit`), group nesting of 256, XML nesting of 1,000, and 40 megapixels per picture.
- Effects with no PDF form (SVG `filter`, `mask`, nested SVG pictures) rasterize that one element, at `rasterFallbackScale` (default 2), and say so through `onDiagnostic` (`pdf-raster-fallback`, with the `data-opf-path` of the element). With `strict: true` the export throws instead. A vector export never turns a whole slide into an image silently.

`onDiagnostic` also reports each embedded face (`pdf-font-embedded`: family, weight, glyph count, size, subset or full, `fsType`, license text), font substitution and per-character fallback. Output is byte-identical across runs and operating systems for the same SVG, font files and options.

```js
const pdf = await toPdf(svgs, {
  fontFiles: fonts.fontFiles, useBundledFonts: false,
  metadata: { title: "Quarterly review", author: "Finance", language: "en-GB" },
  onDiagnostic: (d) => d.code === "pdf-raster-fallback" && console.warn(d.path, d.reason),
});
```

The default changed from raster to vector in the release that added this section; callers that need the previous output pass `raster: true`. A vector PDF ignores `scale` and `dpi`. The page is painted white by default, as a raster PDF composites on white; `background: "none"` leaves it unpainted and any other colour paints that.

## PNG and PDF in a browser

`@openpresentation/opf-render/export-browser` exports `toPdf` and `toPng` for a page, with the arguments of the Node functions. They take a deck (drawn with the browser fonts handle) or the SVG the preview draws, and need no Node module, no network and no system font (a bundle of this entry contains no sharp, resvg, fs or crypto, and the vector converter's SHA-256 is plain JavaScript).

- **Vector PDF** (default) is the same converter the Node export uses (selectable real text in embedded font subsets, paths, gradients, patterns, clips, opacity, links, tagged structure, byte-identical output for the same SVG). Fonts come from the SVG's own `@font-face` data (pass a `fonts` handle with `embeddedFonts` to `toSvg`; each face is embedded only on the slides that draw it, so the PDF gets every face its pages draw), from the faces of the `fonts` handle you pass to `toPdf` (script faces an SVG does not carry reach the PDF too) or from `fontData: [{ data, family? }]`; `fontFiles` and font folders do not exist here and system fonts cannot be loaded. A face the handle never loaded is never embedded.
- **Pictures** are decoded by the browser (PNG, JPEG, WebP, GIF through `createImageBitmap`, EXIF orientation applied); an upright JPEG is passed through compressed, as in Node. An effect with no PDF form (filter, mask, a nested SVG picture) rasterizes only that element on a canvas and reports `pdf-raster-fallback`.
- **Raster PDF** (`raster: true`, `scale` default 2) draws each slide on a canvas as an image.
- **PNG** is drawn by the browser's SVG renderer on a canvas (`scale`, `background`, up to 40 megapixels). With the fonts embedded in the SVG it agrees with the Node (resvg) PNG to anti-aliasing (mean channel error 0.43 of 255 on a text slide).
- `signal` (an `AbortSignal`, checked between pages) and `onProgress({ page, pages })` serve large decks; the same two options also work in the Node `toPdf`. The browser export yields to the page between slides.

Verified in Chromium by `test/export-browser.mjs` (`npm run test:export-browser`), which also checks the text pdf.js extracts, the eight JPEG orientations, offline operation and determinism. Safari and Firefox are not exercised by this repository's CI.
Complex scripts in raster output: resvg draws a HarfBuzz cluster with the advance of its widest glyph, so Indic, Thai, Lao, Khmer and Myanmar text lost the advance of vowel signs and ran together, and it ignores the SVG `lang` (Korean spacing). The raster path therefore rewrites its private copy of such text cluster by cluster at fontkit's positions (`src/raster-text.js`): Devanagari, Gujarati, Oriya, Tamil, Kannada and Sinhala as fontkit glyph outlines, the other scripts and Korean as single clusters resvg shapes in isolation. The emitted SVG is unchanged, text in other scripts is rasterized exactly as before, and `test/script-corpora-raster.mjs` holds every script to a HarfBuzz outline reference (the fixture's `rasterLimits` records what still differs: the KOR punctuation forms).

## Browser preview and fonts

Use `@openpresentation/opf-render/svg` for browser rendering without Node dependencies. Browser-aware bundlers also select this shared SVG implementation for the root import; Node's root import retains PNG/PDF conversion.

```js
import { toSvg } from '@openpresentation/opf-render/svg';
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';

const fonts = await loadFonts({ faces: fontFileEntries });
container.innerHTML = toSvg(presentation, 1, { fonts });
// fonts.dispose() when its canvases are unmounted.
```

Each entry of `faces` contains `url` or `data: Uint8Array`, with optional `family`, `weight`, `italic` and `license`. The loader registers browser FontFaces using the same bytes used for measurement. It fetches only URLs supplied by the host, supports an AbortSignal and custom fetch, and awaits font loading. Use pinned static faces and retain their licenses. A standalone SVG embeds the faces of the handle's `embeddedFonts` that its text draws (the same `{ fonts }` option); embedding is unnecessary for each live draft after browser fonts are loaded.

Subset embedded faces in the browser (RR-65): pass `subsetWasm` to `loadFonts` to cut each face a standalone SVG embeds to the glyphs its slide draws, as the Node handle always does. It is the `harfbuzz-subset.wasm` file of the `harfbuzzjs` dependency (`harfbuzzjs/dist/harfbuzz-subset.wasm`, MIT), served by the host like the font files: its URL, its bytes or a compiled `WebAssembly.Module`. The loader instantiates it asynchronously and fetches nothing else; without it a browser handle embeds whole faces. Live previews in a page that already holds the faces should use `text: "system"` instead, which embeds nothing.

```js
const fonts = await loadFonts({ faces: fontFileEntries, subsetWasm: '/vendor/harfbuzz-subset.wasm' });
const standalone = toSvg(presentation, 1, { fonts }); // each @font-face is a glyph subset
```

### Safari and WebKit: no kerning in SVG text (known limitation)

WebKit (Safari, and Playwright's WebKit) applies no kerning to SVG `<text>`, and neither `font-kerning` nor `font-feature-settings` changes that. Its canvas and HTML text do kern, and they match the renderer's metrics.

The effect is small:

- **Natural width:** a line's natural width in WebKit is up to about 1% wider than the renderer's layout (8 px on a long Arabic line, about 3 px on a title). Chromium is within 0.015 px.
- **Line ends:** the renderer pins each line with `textLength`, so line ends stay where the layout put them. WebKit compresses the unkerned glyphs a little to fit, and one title ends about 3 px short.

Measured on 2026-10-02 on a Mac (opf-render#118, `docs/evidence/mac-checks-20261002/` in the core repository).

- **When this matters:** a host that needs WebKit to place every glyph exactly as Chromium and PowerPoint do should draw with `text: "paths"` (see [Text as outlines](#scope)). The renderer positions each glyph itself, with HarfBuzz's kerned advances, so no browser text layout is involved. The invisible text layer still serves selection, copy and screen readers. The editing canvas stays on real text.
- **Default output:** the renderer does not write per-glyph `x` or `dx` positions into `<text>` to work around WebKit. It would make every SVG larger and change the selection and editing paths of every browser, for a difference `textLength` already holds to the line.

## Player and `<opf-deck>` (RR-28)

A slideshow player and an embeddable web component, both built on `toSvg`: the slide a page shows is the slide the preview, the editor and the PDF show, with no second layout engine. They are plain ES modules, typed, framework-free and tree-shakeable, and importing them touches no DOM, so they are safe in Next.js and other server renderers.

```html
<script type="module">
  import '@openpresentation/opf-render/element/define';   // registers <opf-deck>
</script>
<opf-deck src="/deck.opf.json" fonts="/opf-fonts/" thumbnails present></opf-deck>
```

This HTML must be processed by a bundler (for example Vite); ordinary static HTML cannot resolve a bare npm import. Serve your own `/deck.opf.json` and the font root copied below.

```js
// A framework page: register on the client, when you choose.
import { defineOpfDeck } from '@openpresentation/opf-render/element';
useEffect(() => { defineOpfDeck(); }, []);
// ...and render <opf-deck src="/deck.opf.json" fonts="/opf-fonts/" />.
```

Entry points (package `exports`): `/element` (`defineOpfDeck`, `getOpfDeckElement`, `toHtml`, `loadPreviewFonts`), `/element/define` (importing it registers the tag; the only file with a side effect), `/player` (`present`), `/preview-fonts` (the font root layout and `loadPreviewFonts`) and `/preview-fonts-node` (`copyPreviewFonts`, also the `opf-preview-fonts` command). The element loads the player on first use, so a page that only embeds decks does not carry slideshow code.

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

It is the layout the editor playground and the OpenPresentation sites serve, and `fonts="/opf-fonts/"` (or a fonts handle the page already has, set as the `fonts` property) loads faces on demand like the renderer's browser host: face level (a plain Aptos deck fetches Roboto Regular, Intos Display Bold and Intos Regular, about 1.5 MB), hash-verified, and one registry per root on a page. If the font root cannot be read the deck still draws, with estimated layout, and the element fires a non-fatal `error` event. A face that is not in the root (a script you did not copy) falls back to a system font.

### `<opf-deck>`

Attributes: `src` (OPF JSON; the other request the element makes), `slide` (1-based; counts the slides that play), `fonts`, `thumbnails` (a strip of slide thumbnails), `controls="none"`, `present` (a Present button), `include-hidden`, `label`, `keyboard="off"`. Instead of `src` set the `document` property (an object or JSON text), or put the document in a child `<script type="application/opf+json">`. Properties and methods: `document`, `slide`, `total`, `fonts` (the font root URL, or a handle that wins over the attribute), `renderOptions` (extra `toSvg` options such as `catalogs` and `imageResolver`), `currentSlide` (`{ slide, total, index, id, title, notes, section }`; `notes` is plain text), `ready`, `next()`, `previous()`, `first()`, `last()`, `goto(n)`, `reload()` and `present(options)`.

Events: `ready`, `slidechange` (the same detail as `currentSlide`; bubbles and is composed), `error` (`{ code, message, fatal }`, not bubbling), `presentstart` and `presentend`. Style it with custom properties (`--opf-deck-fg`, `--opf-deck-border`, `--opf-deck-radius`, `--opf-deck-focus`, `--opf-deck-accent`, `--opf-deck-stage`) and the parts `deck`, `viewport`, `slide`, `bar`, `button`, `previous`, `next`, `present`, `counter`, `thumbnails` and `thumbnail`.

Hidden slides (`hidden: true`) are skipped everywhere, so the counter, the `slide` attribute and the player's number-then-Enter all count the sequence that plays; `include-hidden` plays them all. Navigation: the buttons, ArrowLeft, ArrowRight, Page Up, Page Down, Home and End while the slide has focus (Up, Down and Space are left to the page), a horizontal swipe on touch, and the thumbnails. A deck whose `language` is right to left (and a page that sets `dir` or CSS `direction`) turns the controls and the Left and Right keys around.

Accessibility: the element is a labelled region (the deck name) holding a focusable group named `Slide 3 of 8: Revenue grew`; slide text is live SVG text in the order the renderer paints it (tag, title, content, footnotes, then header and footer), not an image, so a screen reader reads it; slide changes made by keyboard or thumbnail are announced through a polite live region; thumbnails are a list of buttons (one tab stop, arrow keys inside, `aria-current`) whose drawings are hidden from assistive technology; the buttons keep their focus ring and `forced-colors` support; and animation is limited to a hover colour that `prefers-reduced-motion: reduce` removes. The test suite runs axe-core (WCAG 2.0 to 2.2 A and AA plus best practice) over the element, the player and the speaker view with no violations. There are no transitions or builds (deferred, opf#250).

### Server markup

`toHtml(deck, slides?, options?)` returns the tag with the deck's slides as inline SVG inside it. A visitor without JavaScript, a crawler or a reader sees the slides; when the element upgrades its shadow DOM replaces them. `toHtml(deck)` draws the first slide and a list of titles; `toHtml(deck, '1-')` every slide, and `toHtml(deck, 3)`, `'1-3'` or `[1, 3]` those slides of the presented sequence; `embed: true` adds the document as an `application/opf+json` child so the upgrade needs no request (it includes hidden slides and notes, as the `src` file does); `fonts` (an object) takes a handle, or any object with a `textMeasurement`, for exact widths; a string is the font root URL for the `fonts` attribute. In Next.js, render the string from a server component with `dangerouslySetInnerHTML` and call `defineOpfDeck()` from a client component. A strict `style-src` Content-Security-Policy needs `style-src-attr 'unsafe-inline'` for the renderer's `style="white-space:pre"` attributes; the element's own styles use constructable stylesheets.

Each slide's SVG embeds only the resolved faces it draws (see `toSvg` above), including bold, italic and glyph fallback, so loading a whole pack for measurement does not put that pack into every slide. `toHtml` accepts `fontMode: 'standalone' | 'shared' | 'external'`:

- `standalone` (default) embeds fonts in each slide, so its SVG remains self-contained when extracted.
- `shared` emits the drawn font rules once inside the returned tag, retaining license metadata in the SVGs. Keep the returned markup together; an extracted SVG needs those shared rules to travel with it.
- `external` emits no font rules (the slides render with `text: "system"`). Supply page CSS with the exact pinned, licensed faces (including replacements and fallback faces) used by the handle, from your own origin. Keep the same handle for layout; omitting it changes layout to estimates. Copy license notices with the served files. An offline page needs those local files available too.

Shared and external rules apply at page scope. A strict CSP must permit their inline style or self-hosted stylesheet and the matching `font-src` (`data:` for embedded fonts). These modes change delivery, while measurement, text positions and font selection stay the same. The Node loader's large script faces still require `embedScriptFonts: true` for self-contained SVG or shared SSR; otherwise supply them through external CSS.

For a lightweight initial page, pre-render measured markup on the server and enable controls on demand. Here the server owns the fonts and the client owns the upgrade button:

```js
// Server/build step: write this HTML into your page, followed by the upgrade button.
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toHtml} from '@openpresentation/opf-render/element';
const fonts = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck, embedScriptFonts: true});
const html = toHtml(deck, '1-', {fonts, fontMode: 'shared', embed: true, attributes: {id: 'deck', fonts: '/opf-fonts/'}});
// <button id="upgrade" type="button">Enable slide controls</button>
```

```js
// Bundler-processed client entry; do not also import /element/define at startup.
document.querySelector('#upgrade').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const {defineOpfDeck} = await import('@openpresentation/opf-render/element');
    defineOpfDeck();
    await document.querySelector('#deck').ready;
    button.hidden = true;
  } finally { button.disabled = false; }
});
```

Copy the self-hosted font root as above, including any script packs the deck draws. No JavaScript is needed to read the pre-rendered slides; the upgrade loads the strict byte-matched measurement engine and fonts when requested. A page that only needs readable slides can omit the client entry and button entirely. A live element without a font handle/root uses estimated widths and system fonts; that is a different fidelity contract.

The reproducible production fixture (`npm run build` then `node scripts/measure-web-delivery.mjs`) measures minified split ESM over local HTTP gzip, with actual font requests counted separately. On 2026-10-08 (Node 24, Playwright Chromium, OPF 0.15), its three-slide Roboto deck measured:

| Delivery | HTML gzip | JavaScript gzip | External font requests |
|---|---:|---:|---|
| Standalone SSR, no scripts | 686,617 B | 0 B | None; fonts are in HTML |
| Shared SSR, no scripts | 229,260 B | 0 B | None; fonts are in HTML |
| External SSR, no scripts | 1,021 B | 0 B | Two faces, 191,628 B gzip, plus host CSS |
| Shared SSR, immediate upgrade | 229,286 B | 500,021 B | Two faces, 191,628 B gzip |
| Shared SSR, before deferred upgrade | 229,322 B | 199 B | None |
| Shared SSR, after deferred upgrade | 229,322 B | 500,355 B total | Two faces, 191,628 B gzip |

The base and Office pack standalone SVGs both contain two Roboto rules (430,764 B / 228,481 B gzip). All three SSR modes render identical pixels with JavaScript disabled, an extracted standalone SVG paints the same offline, and strict interactive upgrades preserve those pixels. These numbers describe this local candidate and fixture, vary with the deck and bundler, and are recorded in [the production delivery report](docs/evidence/rr-59-web-delivery.json). The measurement-enabled JavaScript cost remains about 500 KB gzip. Copying the approximately 34 MiB font root does not make the browser fetch it all: this fixture fetches only Roboto Regular and Bold; other documents fetch their own required faces.

### The slideshow

`present(source, options)` takes an OPF document, its URL or an `<opf-deck>` element and covers the page with a full-screen player (call it from a click or key handler; full screen and the speaker view need a user gesture). It resolves with a `PlayerSession` (`slide`, `total`, `next()`, `previous()`, `first()`, `last()`, `goto(n)`, `blank('black' | 'white' | 'none')`, `openPresenterView()`, `close()`; events `slidechange`, `blank`, `presenterview`, `close`). One show per document: a second call returns the running one.

Keys: Right, Down, Page Down, Space, Enter and `N` are next; Left, Up, Page Up, Backspace, Shift+Space and `P` are previous; Home and End; a slide number then Enter (Escape clears it); `B` and `W` toggle a black or white screen (any navigation key brings the slide back first); `S` opens the speaker view; `F` toggles full screen; Escape leaves (leaving full screen any other way ends the show too). Click or tap advances (the left third goes back) and a horizontal swipe navigates. The player is a modal dialog: the rest of the page is inert, focus stays inside it and returns to where it was when the show ends, and an element that started it follows the show and fires `slidechange`.

`element.present({returnFocus: target})` honors the explicit target; otherwise it captures the invoking element before asynchronous loading (including the Present button in its shadow root). If that target is removed, focus falls back to the deck viewport. Fetched deck failures include the source URL, status and content type in the error detail; HTML responses explain likely SPA fallback routing. A valid JSON body is accepted even if the server labels it with another content type.

The speaker view opens in a second window (`S`, the button, or `presenterView: true`): the current and next slide (the last slide says so), the speaker notes, the section, a timer (against the deck's `duration` in minutes, with pause and reset) and the clock, previous, next and blank buttons, the same keys, and a notes size control. Notes are the OPF `notes` string and are shown as plain text only (rich notes are deferred, opf#251). The windows follow each other over a `BroadcastChannel` named from the deck, so any number of windows of one deck on one origin stay in step (a logical clock settles two changes that cross), and `present(deck, { role: 'presenter' })` makes a second tab or window the speaker view. Pass `channel` to name the channel yourself or `false` for none. The audience window and the popup are driven by this page, so closing or navigating the page ends both.

Not in v1: transitions and builds, links between slides, rich notes, translated interface strings (the controls are English) and a Window Management (multi-screen) placement of the two windows.

## Open font-scheme families (FF-31)

Font schemes select openly licensed Latin families that no Office substitute covers, and the font policy routes proprietary families to open replacements (Red Hat for Segoe UI and Tahoma and, since FF-43, Barlow, Anton, Figtree, Work Sans, EB Garamond, Archivo Narrow, Libre Caslon Text and Bitter). The office pack vendors them as static faces (`fonts/<family>/`: only the used faces, the upstream OFL notice as `OFL.txt` and a generated `PROVENANCE.json`), so `loadFonts({ pack: 'office' })` resolves each to its own face, and a strict registry no longer throws `font-unavailable` for them:

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

Embedding: open faces are flagged `embed: "used"`. `registry.embeddedFonts` stays the 33 Office and base faces, while the `loadFonts()` handle's `embeddedFonts` (or `registry.selectEmbeddedFonts`) supplies every face and `toSvg` embeds an open face only when the slide's text names its family, so a Montserrat slide carries Montserrat and not the whole pack. Raster output reads the files from `fontFiles`. `includeOpenFonts: false` leaves the open families out of the office pack entirely.

## Script fonts, lang and right-to-left text (FF-19)

Previews itemize text by Unicode script. Each run uses the OOXML script slot its script belongs to (`latin`, `eastAsian` or `complexScript`), as resolved by core `resolveScriptFonts` from the document's language and font scheme. Latin, Greek and Cyrillic text stays in the design font. The text's role picks the major (heading) or minor (body) slots: title, subtitle and tag text is heading, as in the exporter's heading shapes, and all other text is body. Licensed script fonts are never bundled. With a measured registry, a proprietary family (for example Meiryo, Microsoft YaHei, Malgun Gothic, Arabic Typesetting, David, Mangal or Angsana New) is previewed with its designated open replacement from `SCRIPT_FONT_REPLACEMENTS`, and each replacement is recorded in `registry.substitutions` as `visual`. The PPTX keeps the chosen family. If the slot's face has no glyph for a run, the run falls back by coverage to the designated OFL Noto family for its script.

The replacement faces are an optional, hash-pinned font pack: 70 static faces from 37 `@expo-google-fonts/*` packages (SIL OFL 1.1): 63 regular and bold Noto script faces from 31 packages, plus the FF-45 symbol packs (`noto-sans-symbols`, `noto-sans-symbols-2` and `noto-sans-math`, under `Zsym`: the Symbol, Wingdings and Webdings code tables draw with them), the FF-45 emoji pack (`noto-color-emoji`: Noto Color Emoji, COLRv1 and OT-SVG colour glyphs, 24.0 MiB; `noto-emoji`: the monochrome face the raster path draws) under the pseudo-script `Zsye` and the math pack (`stix-two-math`, `noto-sans-math`) under `Zmth` (Noto Sans Math serves both Zmth and Zsym). The pinned script faces total 66.9 MiB, of which 55.9 MiB is CJK; the emoji and math faces add 27.5 MiB and the symbol faces another 1.3 MiB. Installing all 37 packages takes about 361 MiB, because they also ship weights the manifest does not pin. All 37 are exact optional peer dependencies, so the renderer install does not grow (RR-63: `@expo-google-fonts/noto-sans`, the default Latin, Cyrillic and Greek glyph-fallback face, about 14 MiB installed, was the one pinned runtime dependency and is now an optional peer like the rest; the office pack names it in its install error). It is the default glyph-fallback face: `loadFonts({ pack: 'office' })` always loads it, marked fallback-only (it serves glyph fallback and requests for Noto Sans, never stands in for another family, and is embedded in a standalone SVG only when its text draws it, like the open families (embed "used"); raster output reads it from `fontFiles`). Install only the other scripts you need, then load them. Segoe UI Emoji previews with Noto Color Emoji and Cambria Math with STIX Two Math once their packs are loaded (`scripts: 'auto'` loads them for text with emoji-presentation clusters or mathematical notation, or a scheme that names the family); emoji sequences stay one run and one glyph, browsers draw them in colour, and PNG/PDF output draws the monochrome Noto Emoji because resvg has no colour-glyph support. The emoji pack is opt-in by use: `scripts: 'auto'` (Node) and `ensureScripts` (browsers) load Noto Color Emoji (24 MiB) only for a deck with emoji-presentation text or a scheme that names Segoe UI Emoji, and it is an optional peer dependency, so it is not in the npm tarball; `scripts: 'all'` loads it too, so pass an explicit script list when memory or download size matters. The PPTX keeps the chosen family either way:

```js
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toSvg, toPng } from '@openpresentation/opf-render';

// npm install @expo-google-fonts/noto-sans-jp@0.4.3 @expo-google-fonts/noto-naskh-arabic@0.4.5
const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: ['Jpan', 'Arab'] });
const slides = toSvg(presentation, { fonts });
const png = await toPng(slides[0], { fonts });
```

`scripts` accepts ISO 15924 codes (`Jpan`, `Hans`, `Hant`, `Kore`, `Arab`, `Hebr`, `Deva`, `Beng`, `Thai` and others; see `scriptFontPackages('all')`) or `'all'`. `detectScripts(presentation)` from `/fonts` lists the scripts a document's text needs. Every face and license notice is checked against `BUNDLED_FONT_MANIFEST`. A missing package fails with `font-resource-unavailable` and names the exact version to install. Script faces are left out of `fonts.embeddedFonts` unless you pass `embedScriptFonts: true`, because a CJK face is 5 to 10 MB. Raster output reads them from `fontFiles`. In a browser, serve the installed packages and load `scriptFontEntries(scripts, { baseUrl })` from `/fonts-browser` with `loadFonts({ faces })`. The loader verifies each entry's SHA-256 with Web Crypto before use.

### Load only the script faces a document uses (`scripts: 'auto'`)

Hosts do not need to detect scripts themselves. `scripts: 'auto'` reads the presentation's drawn text and loads only the faces for the scripts it uses: a Latin, Greek or Cyrillic deck loads none, a Japanese deck loads Noto Sans JP, an Arabic deck the three Arabic packages. Text decides, so a deck whose `language` is `ja` but whose text is Latin still loads nothing. The one exception is a font scheme that names a script font (Yu Gothic, Meiryo, Malgun Gothic, Microsoft YaHei, Arabic Typesetting, Mangal or a pinned Noto family, on the deck or on a slide's `design`): its Latin text previews with that font's open replacement, so its face loads whatever the text, and Han-only text in such a deck draws with the scheme's CJK face. `detected` still lists only what the text draws; `scripts` is what to load. The document language only tells Han text apart (through core `resolveScriptFonts`, the same profile the renderer plans with; a core without it treats Han as Simplified Chinese, as the renderer does). Only drawn text counts (titles, text, list items, runs, table cells, chart labels, code, quotes, metrics, furniture); ids, image alt text and sources, URLs, assets, catalogs, speaker notes, `extensions`, a slide's `beat` and the deck's own name, description, filename, author, speaker, audience, purpose, tone, takeaway, duration, tags and narrative are ignored. The organization and a slide's `section` count only when a design turns on that generated header or footer field. Detection itemizes text exactly as drawing does, so with an East Asian language the curly quotes, dashes and ellipsis count as East Asian. `detectPresentationScripts(presentation)` and `autoScriptSelection(presentation)` (from `/fonts-node` and `/fonts-browser`) return the decision.

```js
// Node: pass the presentation with scripts: 'auto'. Auto never fails on a package that is not installed
// or a script no pinned font serves; it reports them through onDiagnostic and registry.scriptSelection.
const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation });
fonts.registry.scriptSelection; // { detected, scripts, unavailable, packages, notInstalled }

// Node, later: fonts.ensure(presentation) loads the script faces another presentation needs (resolves { scripts, lazy, uncovered }).

// Browser: script faces are fetched lazily, once each, hash-verified, from where the host serves the
// installed @expo-google-fonts packages. Call ensure after every edit and render again afterwards.
const browserFonts = await loadBrowserFonts({ faces: baseEntries, substitutionPolicy: 'visual', fallbackFamily: 'Roboto', scriptBaseUrl: '/script-fonts/' });
if (browserFonts.pending(presentation).length) await browserFonts.ensure(presentation); // resolves { scripts, lazy, uncovered }
// pending is synchronous: empty means nothing is missing, so render at once.
// Text decides, so the analysis does not resolve layouts. Pass the render options (renderOptions: { catalogs: [defaultCatalog] }
// to loadFonts, or per call) so a font scheme only the host's catalogs have and that names a script font (Yu Gothic) counts.
```

Where the renderer has per-character glyph fallback (`glyphFallbackFamilies`), auto also loads Noto Sans when the text has Greek or Cyrillic (the chosen Latin face may lack it), and the next CJK face of the fallback chain when a drawn Han, kana or Hangul character is missing from the loaded ones (a Simplified-only hanzi in Japanese text, hanja). That is capped at one fallback package beyond the packages the text's own scripts need: a character no CJK face covers never pulls in all four (10 to 20 MiB each); it is listed in `ensureScripts().uncovered` (Node: `script-glyph-uncovered`, `registry.scriptSelection.uncovered`) and the renderer reports `missing-glyph`. Browser loads are all or nothing per package: a failed fetch, hash check or `FontFace.load()` leaves the registry, the document and `loadedScriptPackages` unchanged and the package pending. One failing package does not lose the others: `ensureScripts` loads every package it can, then rejects with an `OPFFontError` whose `details` are `{ loaded, failed: [{package, code, message}] }`, and the next call retries only the failures. `ensureScripts(presentation, { signal })` and `loadScripts(scripts, { signal })` take a per-call `AbortSignal` (the creation signal is not reused), and `dispose()` during a load leaves no face behind and rejects with `font-registry-disposed`. Script faces carry `embed: "used"`, like the open families: the eager `registry.embeddedFonts` leaves them out, and when you pass them explicitly (`registry.selectEmbeddedFonts(face => face.scripts)`) an SVG embeds one only when the slide's text uses its family, so a Latin slide never carries a CJK face.

`loadFonts` (browser) also accepts `scripts: 'auto'` with `presentation` (loads on creation), and `fonts.registry.loadScripts(['Arab'])` for explicit scripts. A registry grows in place: `registry.addFaces(entries)` registers faces atomically, refreshes the script aliases (Meiryo resolves to Noto Sans JP once its face exists) and drops `registry.substitutions` recorded before the face existed, so hosts keep one `textMeasurement`. Faces are never unloaded before `dispose()`. Measurements planned before a face was added (for example a long-lived `createScriptTextMeasurement` wrapper) do not know it; call `fonts.ensure` before creating them. Sizes: one CJK package is 10.4 (Japanese), 20.1 (Simplified Chinese), 13.6 (Traditional Chinese) or 11.8 MiB (Korean); the three Arabic packages total 1.8 MiB and each other script under 1.5 MiB. A Latin-only deck downloads nothing extra.

The renderer measures and paints with the same runs. A line whose runs use different families is drawn as positioned tspans, each with its own measured advance. For consistent line breaks, pass the same measurement to pagination and editing: `createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(presentation))`. Without a registry, the SVG names every candidate family in order (for example `Meiryo, Noto Sans JP, sans-serif`), and the host resolves glyphs itself.

The SVG root carries `lang` and `xml:lang` from the document's `language`. Measurement applies the same OpenType language system that a browser selects for that `lang`; Noto Sans KR spacing, for example, differs under `KOR`. Direction is set per paragraph, meaning the text between hard line breaks. The rule is core's `paragraphDirection(text, deckDirection)`, the same function the exporter uses for `a:pPr rtl`. A paragraph is right to left when the deck language is right to left and its first strong character is right to left, or it has none. Strong characters follow UAX #9 P2: isolates are skipped, LRM/RLM/ALM count, and the letters of every right-to-left script, historic ones included, are right to left. The renderer does not keep its own copy of the rule. Every wrapped line of a right-to-left paragraph is laid out as a right-to-left isolate (U+2067 ... U+2069), so lines of one paragraph never differ. Measured rich-text fragments are placed from the right edge.

If core's `resolveScriptFonts` throws for the document, the preview uses the design font for every script, sets no `lang`, lays out every paragraph left to right and reports `language-preview-unresolved` once through `onDiagnostic`.

A face that lacks a character never fails a preview. As in a browser or PowerPoint font linking, each character the resolved face lacks is measured and drawn with the first loaded face that has it, along a fixed chain (`glyphFallbackFamilies(character, profile)`): the character's own script face, the deck language's script face, Noto Sans (Latin, Cyrillic and Greek), the other CJK faces (Japanese, Simplified, Traditional, Korean), then every other Noto script face. A Greek or Cyrillic word under Georgia (Gelasio) or a script scheme's face (Constantia previews with the open PT Serif, which has Cyrillic, so only its Greek text falls back), Greek under Meiryo, Yu Gothic, Microsoft YaHei or Malgun Gothic, Japanese-only kanji beside Hangul, and Simplified-only hanzi in a Japanese deck therefore draw with Noto Sans or the CJK face that has them, and each word stays in one face when one has all of it. Each substitution is reported once per family pair and path as a `font-glyph-fallback` diagnostic through `onDiagnostic` (`fontFamily`, `fallbackFamily`, `scripts`, `characters`); it is a note, not an error. Pass `glyphFallback: 'none'` to `toSvg` or `createScriptTextMeasurement` to keep exact faces, so a missing glyph raises `missing-glyph` again. Coverage is checked per grapheme cluster and per word: a base letter and the combining marks after it (NFD Vietnamese, Cyrillic U+0306) move together to the first face that has the whole cluster, and only their word moves, not the sentence. Without a registry, a Greek or Cyrillic run names `Noto Sans` after the design font in its font stack. With `scripts: 'auto'`, the CJK fallback faces are loaded for you: the language's face plus at most one fallback face (opf-render#55's cap). Greek and Cyrillic need no package, because the office registry always carries Noto Sans. Serif decks prefer the serif face of each script where one is pinned (Noto Serif Hebrew, Tibetan); no Noto Serif is bundled for Latin, Cyrillic, Greek or CJK, so their fallback text draws in the sans face. A character that no loaded face has still raises `missing-glyph`. The PPTX export is unchanged: it names the chosen font and PowerPoint links its own fallback fonts.

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
import { toSvg } from '@openpresentation/opf-render';

toSvg(template, { variables: { client: 'Globex', revenue: 1250000 } });
```

A template previews with each unfilled variable's `example` and reports `variable-example-used` through `onDiagnostic` (a built-in variable such as `{{speaker.name}}` whose document field is missing reports `variable-builtin-missing`; built-ins read the document's own `speaker`, `organization` and `name`, and a template preview keeps an absent one visible); a variable with no example keeps its `{{id}}` text. A normal deck with an unfilled required variable throws `OPFRenderError` with code `unfilled-variables`, and a value of the wrong kind throws `invalid-variables`. `resolvePresentation(...).presentation` is the concrete deck. `variables: false` draws the document as authored, with tokens and `var:` references visible (the editor canvas's view of a template, so inline edits never overwrite a token). Decks without content variables are untouched. See [templates and variables](https://github.com/OpenPresentation/opf/blob/main/docs/templates-and-variables.md).

Slide-scoped built-ins (FA-31): `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` work in any string of a slide (titles, body text, table cells, notes) and in header and footer `text`. The deck-wide pass leaves them as written; the renderer draws each slide from core's substituted slide (`resolveSlideContext(...).slide`), numbered by its position in the deck you render (run core `paginate` first and the numbers and the count are the paginated ones), so the body and the footer show the same number. A zone's `text` is one furniture part (`data-opf-furniture-field="text"`); the former `organization`, `speaker`, `section` and `slideNumber` flags are gone, so write `{{organization.name}}` or `{{slide.number}}` in the `text`.

### Symbol-encoded families: Symbol, Wingdings, Webdings (FF-45)

Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings keep their glyphs at the 224 codes 0x20..0xFF of a Microsoft Symbol cmap, not at Unicode code points, and none of them may be bundled. A run or design font in one of them no longer fails with `font-encoding-required`: each character is normalised to its code (the private-use character U+F0xx that Office writes for Insert > Symbol and `a:sym` runs, or the Windows-1252 character of the code, so "l" and U+F06C are the same Wingdings bullet) and mapped through core's reversible, version-specific tables (`@openpresentation/opf` `spec/reference/symbol-font-encodings.json`, read through `@openpresentation/opf/symbol-font-encodings`, not copied here; `mapSymbolText('Wingdings', 'l')` gives U+26AB) to the Unicode equivalent, which the first loaded face of the family's chain draws: `SYMBOL_PREVIEW_FACES` is Noto Sans Symbols 2, Noto Sans Symbols, Noto Sans Math, Noto Sans for the dingbat fonts and Noto Sans (Greek letters, digits, punctuation) first for Symbol. The three symbol packages are optional peers of the script pack under the key `Zsym` (`scripts: ['Zsym']`; `scripts: 'auto'` selects it when a run, `design.fonts` or a font scheme names one of the families; `fonts.ensure(presentation)`): `@expo-google-fonts/noto-sans-symbols-2`, `noto-sans-symbols` and `noto-sans-math`, OFL-1.1, together about 1.2 MiB. Every code the tables map (1059 of 1120: Symbol 189, Wingdings 222, Wingdings 2 217, Wingdings 3 208, Webdings 223) draws a real glyph when the pack is loaded; the 61 codes without a Unicode equivalent (the Wingdings 0xFF Windows logo, unassigned codes) draw the placeholder U+25A1. Each glyph is one positioned tspan at the advance of the verified Windows font (Wingdings 5.01, Wingdings 2 and 3 1.55, Webdings 5.01, Symbol 5.01), in measurement and drawing alike, so line breaks and bullet gaps follow PowerPoint; the open glyph keeps its shape and is compressed to its code's advance only when wider, never stretched. Characters that are not codes (a CJK letter in a Wingdings run) draw as themselves. Without the pack, Symbol's Greek letters, digits and punctuation draw with the office pack's Noto Sans, the other codes draw U+FFFD, and the `font-glyph-fallback` diagnostic (`codes`, `placeholder`) names the pack; a registry with no chain face and no `fallbackFamily` throws `font-encoding-required`, naming it too. `resolveFont` and `resolveStyle` report `symbolEncoding` with the substitute face, so exporters keep writing the chosen family and the original characters, and the PPTX names Wingdings with its codes. The symbol faces also end the glyph fallback chain. Appearance is the open face's, not Microsoft's; native PowerPoint verification of the exported runs is separate (FF-46).

## Small conveniences (FA-13)

`code.highlight` draws one theme-derived band (an SVG `rect`) behind each run of marked lines and dims the unmarked lines; marked lines keep their syntax colours, and every colour stays at least 4.5:1 on what it sits on (core `codeHighlightColors`). A text `design.watermark` is one `text` element in the heading font and the theme text color, centered and rotated 30 degrees counterclockwise at the watermark opacity (core `layoutWatermark`). A `TextRun` with `code: true` draws in the design's code font with a monospace generic fallback, in text, lists and tables. A run with `lang` writes `lang`/`xml:lang` on its text and is measured and drawn with the script fonts of that language (Han text takes the Japanese or the Simplified Chinese face). `1:1`, `4:5` and `9:16` compose at 7.5 x 7.5, 7.5 x 9.375 and 7.5 x 13.333 inches.

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

- `@openpresentation/opf` is the compatibility source for schemas, validation, resolution and composition. The renderer imports no catalog data; hosts register catalogs (`@openpresentation/opf/catalog` holds the gallery snapshot).
- `@resvg/resvg-js` (optional peer, RR-63) is used only for local SVG rasterization in Node; it makes no network calls and does not require a browser. `sharp` (optional peer) decodes WebP, rotated JPEG and the pictures of a vector PDF. Both load on first use; see [Install](#install-what-to-add-for-what-rr-63).
- `pdf-lib` (optional peer, RR-63) assembles raster-mode PDF bytes locally. Metadata timestamps are disabled so repeated PDF output is byte-stable for the same SVG input and options.
- Vector PDF output is written by a small deterministic PDF writer in this package, with `pako` for Flate compression (pure JavaScript, so independent of the platform zlib build), `fontkit` for shaping and font metrics and `bidi-js` for the Unicode bidirectional algorithm. No hosted service, network call or system font is involved.
- Bundled OFL Roboto and Roboto Mono TTF files (the optional peers `@expo-google-fonts/roboto` and `roboto-mono`, which Node `loadFonts()` and the PNG/PDF default read) provide the default deterministic font fallback.
- `toPng` and `toPdf` disable system-font loading by default. Hosts that require branded fonts should pass a handle with explicit `fontFiles` (or font folders as `fonts`); `fonts: { loadSystemFonts: true }` is an opt-in escape hatch for PNG and raster PDF output and can make it environment-dependent. A vector PDF rejects it (`pdf-system-fonts-unsupported`): it embeds only fonts you supply, so a system font can never be embedded by accident.

Browser support boundary: `toSvg` and `resolvePresentation` are browser-importable pure JavaScript APIs. The root `toPng` and `toPdf` (also `/png` and `/pdf`) are Node APIs because they depend on the Node builds of resvg and sharp, which are optional peers loaded on first use (`converter-missing` when absent). For a page, `@openpresentation/opf-render/export-browser` has the same two names (see below).

Chartex chart previews (FF-22b) draw the constructs opf-pptx exports as Office 2016 chartex parts: `treemap` (squarified tiles of the first series, one colour per tile, category labels), `histogram` (a lone value column binned like PowerPoint with Scott's rule count and right-closed bins, or one column per category), `pareto` (columns sorted descending with the cumulative-percentage line on a 0-100% axis), `box-and-whisker` (rows grouped by category, one box per series, exclusive quartiles, whiskers within 1.5 IQR, mean markers, outlier points), `waterfall` (floating bars from the running total, increases and decreases in the first two palette colours, connector lines) and `funnel` (centred bars with value labels). `world` is an honest non-geographic preview: one tile per region shaded by value with its name and value. No geography data is shipped; PowerPoint draws the real map from Bing geodata it fetches itself, so the preview and the native map agree on labels, values and the series colour, not on shapes. Each chartex kind also accepts a lone value column (row numbers as categories; histogram and pareto bin the values). Every mark and label keeps a `data-opf-path` (bins and boxes trace to their value column).

Combo charts (FA-15): `type: "combo"` draws clustered columns with line series (lines with markers) in one plot. Core's `resolveChartData` resolves the plan, so the preview and the PPTX export agree: the series that `chart.line` names (by default the last series) are lines, `chart.secondaryAxis` puts lines on a secondary value axis at the right (at the left right to left) with its own scale and its tick labels in the first secondary series' column format, and the series are drawn and listed in the legend columns first, then the primary-axis lines, then the secondary-axis lines. Gridlines follow the primary axis; `axisTitles.secondary` titles the secondary axis (rotated, inside a right legend); data labels sit outside the end of the columns and above the line points unless `dataLabels.position` says otherwise.

Chart options (RR-35): a chart's optional `axisTitles`, `legend` and `dataLabels` (core `docs/chart-options.md`) are drawn. A named legend position is carved from the chart box before the plot is laid out, axis titles sit beside the axes (the value title rotated 270 degrees), and data labels follow the content (category, value, percent), position and separator the chart type supports. An option a type cannot show is dropped with a `chart-option-adapted` diagnostic; a chart without the fields draws as before.

Chart emphasis (FA-14): `chart.highlight` names the series (data columns) and categories (row labels) that carry the message. Highlighted marks are filled with the deck primary and every other mark with a muted neutral derived from the chart panel and text colors (core `chartHighlightColors`; core `chartHighlightMarks` decides which marks are named: a mark is highlighted when its series or its category is). It colors columns, bars, line series and (for a category highlight) line points, areas, scatter and radar series, and pie and doughnut slices, with legend keys and data label contrast following; the chartex constructs draw as before and the `chart-option-adapted` diagnostic names the dropped part. Series keep their order and a chart without `highlight` draws the same SVG as before.

Chart and table data (RR-54, needs the core release with `resolveChartData`; core `docs/chart-table-data.md`): every chart path plots the data core resolves, so `DataColumn` headers, `{ dataset, fields }` references to the top-level `datasets` map and `chart.mapping` (category, scatter X and series by column name) all draw, and a series is labelled with its column `name`. Chart numbers are core's strict `chartNumber` (`"12%"`, `"(5)"` and `"Q1"` are gaps, `"1e6"` is 1000000). A column's number `format` shapes its data labels and the value-axis tick labels (the first plotted series' format; the scatter X axis follows the X column; percent axes and pie percent labels stay percent; a 100% stacked chart's data labels show the values in their own format, as PowerPoint does), and table cells draw the formatted text. A formatted horizontal axis (horizontal bars, the scatter X axis) pulls its plot in until the first and last tick labels stay inside the chart; a General axis keeps its placement. A dataset chart or table draws exactly its inline equivalent and traces every part to its authored `slides.N.chart` or `slides.N.table` path; a chart with `mapping` traces each part to the authored column. The legacy sketch (a chart type outside the catalog) plots a gap as nothing. A document without the new fields draws byte for byte as before; a data source by file or asset (the removed `ChartDataSource`) is an `invalid-opf` error.

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

For actual font measurement, load `loadFonts()` from `@openpresentation/opf-render/fonts-node` and pass the handle as `{ fonts }` to rendering (it carries the measurement and the faces to embed in an SVG) and to PNG/PDF conversion (its `fontFiles`). The browser-safe `@openpresentation/opf-render/fonts` entry holds the font data and helpers (`FONT_POLICY` and `fontPolicyFor` are core's own; the registry itself is behind `loadFonts`). Missing fonts/glyphs fail explicitly; aliases and fallback are opt-in and recorded in `registry.substitutions`. Bundled font license notices travel with embedded SVG fonts.

Raster updates produce an HTML gallery and `artifacts/golden/candidate.json`; they never overwrite the approved baseline automatically (baselines are directories with one file per deck; `npm run golden:promote` writes only the decks that moved). See [baseline review and known limitations](test/golden/README.md).

Version 0.1.1 adds rich-text line offsets and measured boxes to opt-in SVG tracing, including blank lines, for editor caret placement. Normal SVG/PNG output is unchanged.

## Embedded WebP in PNG/PDF output (since 0.2.0)

PNG and PDF conversion now decode embedded WebP image data URIs to static PNG before rasterization. This preserves fit/crop, transparency, EXIF orientation and the first animation frame. The source SVG and OPF document remain unchanged; browser SVG output keeps the original embedded image. Both href and legacy xlink:href are supported, including base64 and percent-encoded data. This step does not resolve local filenames, download remote images or change the existing host imageResolver contract.

The Node-only raster path lazily loads pinned Sharp 0.35.5, requiring Node 22 or later for this package and normal installation of its optional platform binaries. Browser exports do not include the decoder. Malformed embedded WebP produces image-conversion-failed with its data-opf-path when present, otherwise svg.images.N. Decoding has a 40-megapixel limit. PNG/PDF are static outputs; animation beyond the first frame and original image metadata are not retained.

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
