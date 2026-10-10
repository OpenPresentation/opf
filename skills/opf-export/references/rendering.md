# Rendering and conversion APIs

## CLI

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx @resvg/resvg-js sharp pdf-lib @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
opf doctor --format text                                  # what this install can write, and the one install command
opf convert deck.opf.json slides/deck.png --slides 1,3-5 [--scale 2] [--include-hidden]   # slides/deck-1.png, ... (zero-padded to the largest number: deck-01.png from ten slides)
opf convert deck.opf.json "slides/slide-{n}.png"   # {n} = the slide number; always numbered, even for one slide
opf convert deck.opf.json deck.pptx [--charts auto|native|picture] [--images compatible|preserve] [--provenance full|references-only|none]
opf convert deck.opf.json deck.pdf [--raster] [--paginate] [--date YYYY-MM-DD] [--fonts dir]
opf convert deck.opf.json slides.zip [--to svg] [--text fonts|system|paths]
opf convert deck.pptx deck.opf.json [--signals signals.json]
opf convert deck.opf.md - --to pdf > deck.pdf               # stdout: one file, named by --to
# formats from the names: .json .opf.yaml .opf.md .md .pptx -> .pdf .pptx .png .svg .zip .json .opf.yaml .opf.md; a flag outside its format exits 2
```

From opf-render 0.16 the converters (`@resvg/resvg-js` and `sharp` for PNG, `pdf-lib` for raster PDF, `sharp` for pictures in a PDF) and the font packages are optional peers: a missing one exits 2 with `code: "peer-not-installed"`, the package and one install command for the package manager and install in use (`install`; `opf doctor` prints the same), and `convert` of `@openpresentation/opf` throws the same code.

The commands each print one JSON report (the `opf validate` shape: `ok`, `findings` with `ruleId`/`severity`/`category`/`path`/`help`, `counts`, plus `outputs` with SHA-256 digests) and exits 1 on errors, or on findings at or above `--fail-on` (nothing is written then). The CLI uses the same `loadFonts` office pack as the recipe below (visual substitution, `scripts: 'auto'`) plus `.ttf`/`.otf` files from `--fonts`, resolves relative images only inside the deck folder (`--asset-dir`), supplies opf-render as the PNG rasterizer for SVG pictures in a PPTX, and never reads a clock (`--date`). PDF is vector by default (`--raster` for one image per page). Per-slide images and PDF skip slides marked `hidden: true` unless `--include-hidden`, and output files are named by the deck's `filename`, else its slugified `name`, else the input file's name. Full reference: `docs/cli.md` in the core repository.

## Files in Node

`@openpresentation/opf` in Node is core's file API. The same import in a browser or worker is a browser-safe build with the same names, where `open`, `save` and `convert` reject with `node-only`; `@openpresentation/opf/node` of 0.17 is gone. The commands above run it.

```js
import * as opf from '@openpresentation/opf';

await opf.convert('deck.opf.md', 'deck.pdf', { raster: true });          // a picture per page; vector text is the default
await opf.convert('deck.opf.md', 'deck.svg', { text: 'paths' });        // glyph outlines: the SVG needs no font
await opf.convert('deck.opf.md', 'slides/deck.png', { slides: '1,3-5', scale: 2 }); // slides/deck-1.png, -3, -4, -5 (or "slides/slide-{n}.png": slide-1.png, ...)
await opf.convert('deck.opf.md', 'slides.zip', { format: 'svg' });
await opf.convert('deck.opf.md', 'deck.pptx', { date: '2026-10-08' });
const { files, findings } = await opf.convert(deck, { format: 'png' });  // [{ name, type, bytes, slide, width, height }], nothing written
const imported = await opf.open('deck.pptx');                           // or opf.open(pptxBytes)
try { await opf.convert('deck.opf.md', 'deck.pdf'); } catch (error) {
  if (error instanceof opf.OPFExportError && error.code === 'peer-not-installed') console.error(error.message); // the install command
}
```

- `convert(input, output, options?)` writes; `convert(input, { format })` returns the files. Names without an output follow `name`, else the deck's `filename`, else its slugified `name`, else the input file's stem; per-slide files end `-1.png`, zero-padded to the width of the largest slide number written (`-01.png` from ten slides, `-001.png` from a hundred; with `slides: [3, 11]` they are `-03` and `-11`). With an output path, `{n}` in a `.png` or `.svg` path is the slide number (`"slides/slide-{n}.png"`, always numbered, even for one slide); any other `{key}`, and `{n}` in any other output, throws `invalid-option`. The options are `slides`, `includeHidden`, `paginate`, `scale`, `raster`, `text` (`fonts`, `system` or `paths`), `charts`, `images`, `provenance`, `date`, `catalogs`, `fonts`, `assetDir`; the 0.17 names `pdfMode`, `svgFonts`, `chartex`, `imageFormat`, `fontDirs` and `filename` are refused with the new name.
- `findings` are the `opf validate` shape (rule ids `import/`, `render/`, `pptx/`, `pdf/`, `fonts/`, `cli/` for the engines' diagnostics). The format and references check runs first: an invalid deck throws `invalid-presentation` and `error.findings` hold its errors, located in the file.
- Errors: `OPFApiError` (`invalid-option`, `input-not-found`, `output-exists`, ...), `OPFExportError` and `OPFImportError` (both extend it) with `code`: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, `import-failed`; `open` and `save` of an invalid deck throw `OPFValidationError`.
- Fonts are the renderer's office pack (prepared once per process) plus the font folders in `fonts` (a folder, or a list of folders); pass `fonts` as the handle `loadFonts()` returns to use your own. Local images resolve next to the input file (`assetDir` overrides); URLs are never fetched.

## Prepared font inputs

`loadFonts` in `/fonts-node` returns the fonts handle
(current coordinated set: core 0.17.0, renderer 0.17.1, PPTX 0.17.0, editor 0.17.0):

```js
const fonts = await loadFonts({
  pack: 'office', substitutionPolicy: 'visual',
});
const {presentation} = paginate(document, {fonts});
const slides = toSvg(presentation, {fonts}); // one SVG per slide; toSvg(presentation, 3, {fonts}) is slide 3 as one string
const png = await toPng(slides[0], {fonts});
const pptx = await toPptx(presentation, {fonts});
console.log(fonts.substitutions);
```

Import the named functions from the same public modules shown below. The loader verifies pinned font/notice hashes and the handle supplies one consistent measurement, SVG embedding and raster font set to every deck-level call as `{ fonts }`. `pack: 'base'` suits authored Roboto decks; Office visual substitutions are explicit. It leaves source content, font choices and native font installation unchanged. Native PPTX embedding and pixel equivalence are separate gates.

## Node export (the engines directly)

Use the engines directly when you need the pieces; `convert` calls these.

```js
import { toSvg, toPng, toPdf } from '@openpresentation/opf-render';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toPptx, fromPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts({pack: 'office'});
const diagnostics = [];
const options = {fonts, onDiagnostic: issue => diagnostics.push(issue)};
const slides = toSvg(document, options); // embeds the faces each slide draws; { text: 'paths' } draws outlines instead
const firstSlidePng = await toPng(slides[0], {fonts});        // or toPng(document, 1, {fonts}): the deck's slide 1
const deckPdf = await toPdf(slides, {fonts});                  // or toPdf(document, {fonts}); { raster: true } for a picture per page
const pptx = await toPptx(document, options);
// Write the returned strings/bytes to the user's requested local output paths.
// const imported = await fromPptx(inputPptxBytes);
```

The Node `toPdf` accepts a deck, one SVG or an array of SVGs, creating one PDF page per slide. The Node font loader requires its installed font resources. If unavailable, supply explicitly licensed font files through the supported registry API rather than claiming the starter pack was loaded. Pass the same handle to PNG/PDF conversion (`{ fonts }`); embedding fonts in SVG does not by itself configure the Node rasterizer.

`loadFonts({pack: 'office'})` defaults to metric substitutions, and its pack includes Intos, a metric-compatible replacement for the Aptos family, so default-scheme (Aptos) decks measure and draw with it. Opt into `{substitutionPolicy:'visual'}` only when a visual-only look-alike is acceptable as a documented fallback (a known layout-fidelity gap), for example Roboto or Carlito for Aptos in a registry without the office pack. Inspect `fonts.substitutions`. An SVG embeds only the bundled font families its text names. Replacements affect previews and measurement only; the exported PPTX keeps the selected font name. Synchronous SVG calls without `fonts` estimate widths; loading a named font only at painting time can create gaps or overlaps between rich runs. Supply the handle to both layout and drawing. Current scalar and code layout preserve authored source whitespace through separate source-mapping contracts; general native rich-text round-trip remains a separate limit.

A raster snapshot embedded into PPTX is not equivalent to editable native shapes. The OPF PPTX converter writes supported native content, but visual and import coverage are incomplete. Verify what the requested deck uses.

## Templates and variables

A deck that declares content variables, uses a built-in (`{{speaker.name}}`, `var:speaker.photo`) or is a template (`"template": true`) is resolved by core `resolveVariables` before it is composed, so preview and PPTX agree. Pass the values as the `variables` option of `toSvg`, `resolvePresentation` and `toPptx`. A template previews and exports with each variable's `example` (PPTX reports `variable-example-used` through `onDiagnostic`); a normal deck with an unfilled required variable is refused with code `unfilled-variables`. The PPTX holds the resolved text, so re-import returns the filled deck, not the template. Fill a template into a concrete deck first (`opf fill`) when the deliverable is a finished deck. Organization logo references (`var:organization.logo.icon`) and `{{slide.number}}` are slide-scoped: core resolves them for each output slide (`resolveSlideContext`, `layoutFurniture`), the logo for that slide's background.

## Browser rendering

```js
import { toSvg } from '@openpresentation/opf-render/svg';
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
const fonts = await loadFonts({faces: [
  {url: '/fonts/Roboto-Regular.ttf', family: 'Roboto', weight: 400},
  {url: '/fonts/Roboto-Bold.ttf', family: 'Roboto', weight: 700},
]});
const svg = toSvg(document, 1, {fonts}); // slide 1: slides count from 1
// fonts.dispose() on final owner cleanup, not after each slide.
```

The host must provide those files and required additional faces. The loader registers `FontFace` and measures the same bytes. Cross-origin font URLs require CORS. `/svg` is browser-safe; PNG/PDF rasterization belongs to the Node entrypoint. Host UI and CSP determine how SVG is mounted.

Collect diagnostics and inspect actual previews. Font substitutes can preserve some metrics while changing glyph appearance or shaping. Exact schema/editing coverage, shared geometry, native PPTX text, and embedded SVG fonts are separate claims. None alone establishes pixel-identical PowerPoint output.

Text runs and character lists share measured wrapping across SVG and native PPTX. List descriptions and levels affect fitting; paginate between whole entries. Native output uses one editable box per fitted line, with bullets on first body lines. A numbered list (`numbering`) writes native `a:buAutoNum` auto-numbers on those lines, `startAt` set to the counted number, at the marker geometry core composes, and import maps them back. Image bullets and native PowerPoint raster parity remain unverified. Do not infer a lossless rich-list import round trip from export support.

Citations, footnotes and captions (RR-34) draw from the shared geometry: marker fragments are superscript text (native `baseline="30000"` runs in PPTX), the footnote area is a rule plus one tagged text box per listed line (`OPF footnotes <slide> ...`, `OPF_FOOTNOTES_V1`) above the footer placeholders, and a caption is one tagged text box per line (`OPF caption <path> ...`, `OPF_CAPTION_V1`) naming its media shape. Import re-attaches captions and rebuilds `references`, `cite` and `footnote` from those tags and the marker numbers; the deck's references also travel in the document provenance record. Without tags a superscript number stays a superscript run and a text box under a picture stays a text block.
