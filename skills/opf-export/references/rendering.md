# Rendering and conversion APIs

## CLI

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx @resvg/resvg-js sharp pdf-lib @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
opf render deck.opf.json --slides 1,3-5 --format svg|png [--scale 2] [--include-hidden] [--out dir]
opf export deck.opf.json --format pptx|pdf|png|svg [--out file|dir|x.zip] [--pdf-mode vector|raster]
           [--chartex auto|native|fallback] [--provenance full|references-only|none] [--paginate] [--include-hidden] [--date YYYY-MM-DD]
opf import deck.pptx [--out deck.opf.json] [--signals signals.json]
```

From opf-render 0.16 the converters (`@resvg/resvg-js` and `sharp` for PNG, `pdf-lib` for raster PDF, `sharp` for pictures in a PDF) and the font packages are optional peers: a missing one exits 2 with `code: "peer-not-installed"`, the package and the install command, and `exportDeck` throws the same code.

The commands each print one JSON report (the `opf validate` shape: `ok`, `findings` with `ruleId`/`severity`/`category`/`path`/`help`, `counts`, plus `outputs` with SHA-256 digests) and exits 1 on errors, or on findings at or above `--fail-on` (nothing is written then). The CLI uses the same `loadFonts` office pack as the recipe below (visual substitution, `scripts: 'auto'`) plus `.ttf`/`.otf` files from `--font-dir`, resolves relative images only inside the deck folder (`--asset-dir`), supplies opf-render as the PNG rasterizer for SVG pictures in a PPTX, and never reads a clock (`--date`). PDF is vector by default (`--pdf-mode raster` for one image per page). Per-slide images and PDF skip slides marked `hidden: true` unless `--include-hidden`, and output files are named by the deck's `filename`, else its slugified `name`, else the input file's name. Full reference: `docs/cli.md` in the core repository.

## Library API

`@openpresentation/cli/api` is the library form of the commands above (Node only). Core reads and writes text; this entry reads and writes files.

```js
import { readDeck, writeDeck, validate, exportDeck, importDeck, OPFExportError } from '@openpresentation/cli/api';

const { presentation, findings: readFindings } = readDeck(text, { filename: 'deck.opf.md' }); // JSON, YAML or .opf.md
const pdf = await exportDeck(presentation, { format: 'pdf', pdfMode: 'vector' });
const slides = await exportDeck(presentation, { format: 'png', slides: '1,3-5', scale: 2 });
const zip = await exportDeck(presentation, { format: 'svg', zip: true });
const pptx = await exportDeck(presentation, { format: 'pptx', date: '2026-10-08' });
const { presentation: imported, findings } = await importDeck(pptx.files[0].bytes);
try { await exportDeck(presentation, { format: 'pdf' }); } catch (error) {
  if (error instanceof OPFExportError && error.code === 'peer-not-installed') console.error(error.message); // the install command
}
```

- Returns `{ files: [{ name, type, bytes }], findings, fonts, skippedHidden, renderer, pptx? }`. Files are named by the deck's `filename`, else its slugified `name`, else the `filename` option; per-slide files end `-001.png`. Nothing is written for you.
- `findings` are the `opf validate` shape (rule ids `render/`, `pptx/`, `pdf/`, `fonts/`, `cli/` for the engines' diagnostics). The format and references check runs first: an invalid presentation throws `invalid-presentation` and `error.findings` hold its errors.
- Errors: `OPFExportError` / `OPFImportError` (both extend `OPFApiError`) with `code`: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, `import-failed`.
- Fonts are the renderer's office pack plus `fontDirs`; pass `fonts` (the handle `loadFonts()` returns) to reuse one across calls. Local images are read only from `assetDir`; URLs are never fetched.
- Core is a regular dependency of the CLI package, so `@openpresentation/cli/api` and `@openpresentation/opf` in the same application are one core (`error instanceof OPFValidationError` holds across both).

## Prepared font inputs

`loadFonts` in `/fonts-node` returns the fonts handle
(current coordinated set: core 0.14.0, renderer 0.14.0, PPTX 0.14.0, editor 0.14.2):

```js
const fonts = await loadFonts({
  pack: 'office', substitutionPolicy: 'visual',
});
const {presentation} = paginate(document, {fonts});
const slides = renderSvg(presentation, {fonts}); // one SVG per slide
const png = await svgToPng(slides[0], {fonts});
const pptx = await toPptx(presentation, {fonts});
console.log(fonts.substitutions);
```

Import the named functions from the same public modules shown below. The loader verifies pinned font/notice hashes and the handle supplies one consistent measurement, SVG embedding and raster font set to every deck-level call as `{ fonts }`. `pack: 'base'` suits authored Roboto decks; Office visual substitutions are explicit. It leaves source content, font choices and native font installation unchanged. Native PPTX embedding and pixel equivalence are separate gates.

## Node export (the engines directly)

Use the engines directly when you need the pieces; `exportDeck` calls these.

```js
import { renderSvg, svgToPng, svgToPdf } from '@openpresentation/opf-render';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { toPptx, fromPptx } from '@openpresentation/opf-pptx';

const fonts = await loadFonts({pack: 'office'});
const diagnostics = [];
const options = {fonts, onDiagnostic: issue => diagnostics.push(issue)};
const slides = renderSvg(document, options); // embeds the faces each slide draws
const firstSlidePng = await svgToPng(slides[0], {fonts});
const deckPdf = await svgToPdf(slides, {fonts});
const pptx = await toPptx(document, options);
// Write the returned strings/bytes to the user's requested local output paths.
// const imported = await fromPptx(inputPptxBytes);
```

The current Node `svgToPdf` accepts one SVG or an array, creating one PDF page per slide. The Node font loader requires its installed font resources. If unavailable, supply explicitly licensed font files through the supported registry API rather than claiming the starter pack was loaded. Pass the same handle to PNG/PDF conversion (`{ fonts }`); embedding fonts in SVG does not by itself configure the Node rasterizer.

`loadFonts({pack: 'office'})` defaults to metric substitutions, and its pack includes Intos, a metric-compatible replacement for the Aptos family, so default-scheme (Aptos) decks measure and draw with it. Opt into `{substitutionPolicy:'visual'}` only when a visual-only look-alike is acceptable as a documented fallback (a known layout-fidelity gap), for example Roboto or Carlito for Aptos in a registry without the office pack. Inspect `fonts.substitutions`. An SVG embeds only the bundled font families its text names. Replacements affect previews and measurement only; the exported PPTX keeps the selected font name. Synchronous SVG calls without `fonts` estimate widths; loading a named font only at painting time can create gaps or overlaps between rich runs. Supply the handle to both layout and drawing. Current scalar and code layout preserve authored source whitespace through separate source-mapping contracts; general native rich-text round-trip remains a separate limit.

A raster snapshot embedded into PPTX is not equivalent to editable native shapes. The OPF PPTX converter writes supported native content, but visual and import coverage are incomplete. Verify what the requested deck uses.

## Templates and variables

A deck that declares content variables, uses a built-in (`{{speaker.name}}`, `var:organization.logo`) or is a template (`"template": true`) is resolved by core `resolveVariables` before it is composed, so preview and PPTX agree. Pass the values as the `variables` option of `renderSvg`, `renderSlideSvg`, `resolvePresentation` and `toPptx`. A template previews and exports with each variable's `example` (PPTX reports `variable-example-used` through `onDiagnostic`); a normal deck with an unfilled required variable is refused with code `unfilled-variables`. The PPTX holds the resolved text, so re-import returns the filled deck, not the template. Fill a template into a concrete deck first (`opf fill`) when the deliverable is a finished deck.

## Browser rendering

```js
import { renderSlideSvg } from '@openpresentation/opf-render/svg';
import { loadFonts } from '@openpresentation/opf-render/fonts-browser';
const fonts = await loadFonts({faces: [
  {url: '/fonts/Roboto-Regular.ttf', family: 'Roboto', weight: 400},
  {url: '/fonts/Roboto-Bold.ttf', family: 'Roboto', weight: 700},
]});
const svg = renderSlideSvg(document, 0, {fonts});
// fonts.dispose() on final owner cleanup, not after each slide.
```

The host must provide those files and required additional faces. The loader registers `FontFace` and measures the same bytes. Cross-origin font URLs require CORS. `/svg` is browser-safe; PNG/PDF rasterization belongs to the Node entrypoint. Host UI and CSP determine how SVG is mounted.

Collect diagnostics and inspect actual previews. Font substitutes can preserve some metrics while changing glyph appearance or shaping. Exact schema/editing coverage, shared geometry, native PPTX text, and embedded SVG fonts are separate claims. None alone establishes pixel-identical PowerPoint output.

Text runs and character lists share measured wrapping across SVG and native PPTX. List descriptions and levels affect fitting; paginate between whole entries. Native output uses one editable box per fitted line, with bullets on first body lines. A numbered list (`numbering`) writes native `a:buAutoNum` auto-numbers on those lines, `startAt` set to the counted number, at the marker geometry core composes, and import maps them back. Image bullets and native PowerPoint raster parity remain unverified. Do not infer a lossless rich-list import round trip from export support.

Citations, footnotes and captions (RR-34) draw from the shared geometry: marker fragments are superscript text (native `baseline="30000"` runs in PPTX), the footnote area is a rule plus one tagged text box per listed line (`OPF footnotes <slide> ...`, `OPF_FOOTNOTES_V1`) above the footer placeholders, and a caption is one tagged text box per line (`OPF caption <path> ...`, `OPF_CAPTION_V1`) naming its media shape. Import re-attaches captions and rebuilds `references`, `cite` and `footnote` from those tags and the marker numbers; the deck's references also travel in the document provenance record. Without tags a superscript number stays a superscript run and a text box under a picture stays a text block.
