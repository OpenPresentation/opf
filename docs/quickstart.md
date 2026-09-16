# Developer quickstart

A new developer can install the **published** OPF packages into a fresh Node 24
project and author, lint, compose, paginate, edit with undo, preview and export
a representative deck. No account, model call, or sibling repository checkout
is required.

This is a documented supported subset, not universal Office or all-feature
parity. See the [compatibility matrix](compatibility-matrix.md) for what is
shipped versus deferred.

## Versions

Pin the coordinated set from `release-plan.json` (currently core **0.10.1**,
renderer/PPTX/CLI **0.8.1**, editor **0.7.1**). All of these packages declare
`engines.node: 24.x`.

```sh
node -v   # must be 24.x
npm install @openpresentation/opf@0.10.1 \
  @openpresentation/opf-render@0.8.1 \
  @openpresentation/opf-editor@0.7.1 \
  @openpresentation/opf-pptx@0.8.1 \
  @openpresentation/cli@0.8.1
```

Copy [`docs/quickstart/developer-quickstart.opf.json`](quickstart/developer-quickstart.opf.json)
into that project as `deck.opf.json`. That file is a docs fixture, not one of
the 126 decks in `@openpresentation/opf/examples`. Verify the install came from the registry
(`package-lock.json` `resolved` URLs start with `https://registry.npmjs.org/`)
and that you did not add `file:` dependencies on this repository.

## Author, validate and lint

```sh
npx --no-install opf --version
npx --no-install opf validate deck.opf.json
npx --no-install opf lint deck.opf.json
```

The CLI bundles schema, catalogs and lint. It does **not** render slides.
`opf --version` reports the CLI and bundled core. Successful validation is not
visual verification.

Library equivalents:

```js
import { readFile } from 'node:fs/promises';
import { validatePresentation, lintSource } from '@openpresentation/opf';

const source = await readFile('deck.opf.json', 'utf8');
const document = JSON.parse(source);
console.log(validatePresentation(document));
console.log(lintSource(source));
```

## Offline fonts, composition, pagination

```js
import { composeSlide, paginatePresentation, fontSchemes, resolveFontFamilies } from '@openpresentation/opf';
import { prepareNodeFonts } from '@openpresentation/opf-render/fonts-node';

const { options } = await prepareNodeFonts({ pack: 'base' });
const fonts = resolveFontFamilies(fontSchemes.find(scheme => scheme.id === 'roboto'));
const geometry = composeSlide(document.slides[0], { presentation: document, fonts, ...options });
const { presentation, pages } = paginatePresentation(document, { fonts, ...options });
```

`prepareNodeFonts({ pack: 'base' })` loads the bundled Roboto faces for
`design.fontScheme: 'roboto'`. Pass `fonts` from that scheme into `composeSlide`
when you also pass `textMeasurement`; otherwise furniture falls back to
`sans-serif` and the registry has no matching face. `paginatePresentation`
resolves catalog font schemes itself. The helper does not install system fonts
or change the authored scheme. Reuse the same `options` for SVG preview and
PPTX export.

Shared headers and footers use `furniture-flow-v2`. Body content stays between
`geometry.furniture.headerBottom` and `geometry.furniture.footerTop`. PPTX
export of those bands is ordinary slide shapes tagged `OPF_FURNITURE_V1` with
vendor `p:hf` off, not native Office Header/Footer objects
([issue 87](https://github.com/OpenPresentation/opf/issues/87)).

Pagination returns a new presentation plus source mappings. It preserves
authored text, whitespace and reading order; it does not drop overflowed
content.

```sh
npx --no-install opf paginate deck.opf.json paginated.opf.json
```

## Edit with undo

```js
import { createEditorSession } from '@openpresentation/opf-editor';

const editor = createEditorSession(document, { rejectInvalid: true });
const original = editor.document.slides[0].title;
editor.set('slides.0.title', 'Edited title');
editor.undo();
// original title, including whitespace, is restored
```

The CLI can apply JSON Patch edits (`opf edit`) but has no persistent undo
history. Use the editor session or version control for undo.

## Preview and export

```js
import { renderSvgDeck, svgToPng, svgToPdf } from '@openpresentation/opf-render';
import { toPptx } from '@openpresentation/opf-pptx';

const svgs = renderSvgDeck(presentation, options);
const png = await svgToPng(svgs[0], options);
const pdf = await svgToPdf(svgs, options);
const pptx = await toPptx(presentation, options);
```

`renderSvg` / `renderSvgDeck` are the local preview. PNG and PDF rasterize that
SVG; **PDF is raster-backed** in this release (not selectable vector text).
`toPptx` is the supported editable PowerPoint export from OPF. Opening the file
in Microsoft PowerPoint and round-tripping native fidelity is
[issue 87](https://github.com/OpenPresentation/opf/issues/87), not this
quickstart.

Browser preview uses the same SVG core plus
`@openpresentation/opf-render/fonts-browser` and
`@openpresentation/opf-editor/canvas`. Load the same font bytes the Node helper
resolved. Do not fetch fonts from the network at render time.

## Prove it

From this repository, after a normal `pnpm install`:

```sh
node scripts/test-developer-quickstart.mjs
```

That script creates an empty temp project, installs the published versions from
the npm registry, copies this example, and asserts validate, lint, offline
fonts, furniture composition, pagination, undo, SVG, PNG, raster PDF and PPTX.
It fails if any package is a `file:` or workspace link.

## What this does not cover

- Renderer native-width residuals:
  [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24)
- Native PowerPoint Header/Footer objects (Insert → Header & Footer, notes
  master, `p:hf`) plus open/edit/save/reopen:
  [opf#87](https://github.com/OpenPresentation/opf/issues/87). Tagged furniture
  shapes are not that work.
- Public-site adoption:
  [opf#88](https://github.com/OpenPresentation/opf/issues/88)
- Archived font-shaping prototypes (not in the published runtime)
- Selectable vector PDF, general SVG diagrams, and Mermaid
