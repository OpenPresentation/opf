# Developer quickstart

A new developer can install the **published** OPF packages into a fresh Node 24
project and author, validate, compose, paginate, edit with undo, preview and export
a representative deck. No account, model call, or sibling repository checkout
is required.

This is a documented supported subset, not universal Office or all-feature
parity. See the [compatibility matrix](compatibility-matrix.md) for what is
shipped versus deferred.

## Versions

Pin the coordinated set from `release-plan.json` (currently core **0.13.0**,
CLI **0.11.0**, renderer **0.13.1**, PPTX **0.13.2**, editor **0.12.1**). All of these packages declare
`engines.node: >=22`; Node 24 is the toolchain this quickstart is verified on.

```sh
node -v   # 24.x (verified); 22 and later are declared
npm install @openpresentation/opf@0.13.0 \
  @openpresentation/opf-render@0.13.1 \
  @openpresentation/opf-editor@0.12.1 \
  @openpresentation/opf-pptx@0.13.2 \
  @openpresentation/cli@0.11.0
```

Copy [`docs/quickstart/developer-quickstart.opf.json`](quickstart/developer-quickstart.opf.json)
into that project as `deck.opf.json`. That file is a docs fixture, not one of
the 126 decks in `@openpresentation/opf/examples`. Verify the install came from the registry
(`package-lock.json` `resolved` URLs start with `https://registry.npmjs.org/`)
and that you did not add `file:` dependencies on this repository.

The [format card](format-card.md) describes ColorRef, named variables and the
current source contract. `opf bundle` can inline resolved catalog records for
portable offline authoring; it does not download remote assets. Keep the
ColorRef docs fixture outside the 126-deck example/golden corpus in this update.

## Author and validate

```sh
npx --no-install opf --version
npx --no-install opf validate deck.opf.json
npx --no-install opf validate deck.opf.json --format text
```

The CLI bundles schema, catalogs and the checker. Validation never renders; `opf render`, `opf export` and
`opf import` produce and read files through the optional peers `@openpresentation/opf-render` and
`@openpresentation/opf-pptx` (see [the CLI reference](cli.md)).
`opf --version` reports the CLI and bundled core. Successful validation is not
visual verification.

Library equivalents:

```js
import { readFile } from 'node:fs/promises';
import { validate } from '@openpresentation/opf';

const source = await readFile('deck.opf.json', 'utf8');
const document = JSON.parse(source);
console.log(validate(document));   // a parsed document: findings of every category
console.log(validate(source));     // JSON text: the same findings with line and column
```

## Offline fonts, composition, pagination

```js
import { paginate, resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';

const fonts = await loadFonts({ pack: 'base' });
const { options } = resolveSlideContext(document, 0, { fonts });
const geometry = composeSlide(document.slides[0], options);
const { presentation, pages } = paginate(document, { fonts });
```

`loadFonts({ pack: 'base' })` loads the bundled Roboto faces for
`design.fontScheme: 'roboto'`. It returns the fonts handle: every deck-level
verb (`paginate`, `renderSvg`, `svgToPng`, `svgToPdf`, `toPptx`) takes it as
`{ fonts }` and reads what it needs from it (the `textMeasurement`, the faces
to embed, the font files). `resolveSlideContext(document, index, { fonts })` resolves
one slide's layout, canvas, theme and font families (slide design, then deck
design, then theme, then the default font scheme) into the options `composeSlide`
takes, so you never look up a font scheme yourself; an unknown font-scheme id
comes back as an `unresolved-font-scheme` diagnostic. `paginate`
does the same for every slide. The helper does not install system fonts or
change the authored scheme. Reuse the same `fonts` for SVG preview and PPTX
export.

Shared headers and footers use `furniture-flow-v2`. Body content stays between
`geometry.furniture.headerBottom` and `geometry.furniture.footerTop`.

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
const original = editor.presentation.slides[0].title;
editor.set('slides.0.title', 'Edited title');
editor.undo();
// original title, including whitespace, is restored
```

The CLI can apply JSON Patch edits (`opf edit`) but has no persistent undo
history. Use the editor session or version control for undo.

## Preview and export

```js
import { renderSvg, svgToPng, svgToPdf } from '@openpresentation/opf-render';
import { toPptx } from '@openpresentation/opf-pptx';

const svgs = renderSvg(presentation, { fonts });   // one SVG per slide
const png = await svgToPng(svgs[0], { fonts });
const pdf = await svgToPdf(svgs, { fonts });
const pptx = await toPptx(presentation, { fonts });
```

`renderSvg` is the local preview of every slide (`renderSlideSvg` draws one). PNG rasterizes that SVG.
PDF (opf-render 0.12.0 and later) converts the same SVG to **vector paths with
selectable, searchable text** in embedded font subsets, with no second layout pass;
pass `{ mode: 'raster' }` for the image-per-slide output that renderers up to 0.11.9
always wrote. Pass the same fonts handle as for PNG; vector PDF never uses system
fonts.
`toPptx` is the supported editable PowerPoint export from OPF. Shared
headers/footers in that file are tagged slide shapes (`OPF_FURNITURE_V1`), not
native Office Header/Footer objects (`p:hf` / notes master). Opening the file
in Microsoft PowerPoint, compiling furniture into real Header/Footer objects,
and round-tripping native fidelity is
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
the npm registry, copies this example, and asserts validate, offline
fonts, furniture composition, pagination, undo, SVG, PNG, PDF and PPTX.
It fails if any package is a `file:` or workspace link.

## What this does not cover

- Renderer native-width residuals:
  [opf-render#24](https://github.com/OpenPresentation/opf-render/issues/24)
- Native PowerPoint open/edit/save/reopen and real Office Header/Footer (`p:hf`):
  [opf#87](https://github.com/OpenPresentation/opf/issues/87)
- Remaining GitHub [issue 88](https://github.com/OpenPresentation/opf/issues/88)
  checklist (the Inspector overlay/json-options, gallery Playground+Editor
  links, and Header & footer playground example are already live on
  production; the issue stays open)
- Archived font-shaping prototypes (not in the published runtime)
- PDF/UA or PDF/A conformance, general SVG diagrams, and Mermaid
