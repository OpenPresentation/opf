# Developer quickstart

A new developer can install the **published** OPF packages into a fresh Node 24
project and author, validate, compose, paginate, edit with undo, preview and export
a representative deck. No account, model call, or sibling repository checkout
is required.

This is a documented supported subset, not universal Office or all-feature
parity. See the [compatibility matrix](compatibility-matrix.md) for what is
shipped versus deferred.

## Versions

Pin the coordinated set from `release-plan.json` (currently core **0.17.0**,
CLI **0.17.1**, renderer **0.17.1**, PPTX **0.17.0**, editor **0.17.0**). All of these packages declare
`engines.node: >=22`; Node 24 is the toolchain this quickstart is verified on.

```sh
node -v   # 24.x (verified); 22 and later are declared
npm install @openpresentation/opf@0.17.0 \
  @openpresentation/opf-render@0.17.1 \
  @openpresentation/opf-editor@0.17.0 \
  @openpresentation/opf-pptx@0.17.0 \
  @openpresentation/cli@0.17.1
# opf-render 0.17 keeps its converters and font packages as optional peers: install the ones you use
# (here the base font pack, PNG and PDF; add @expo-google-fonts/* office or script packs as needed)
npm install @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 \
  @resvg/resvg-js@^2.6.2 pdf-lib@^1.17.1 sharp@^0.35.5
```

A missing converter or font package is a typed error (`converter-missing`, `font-resource-unavailable`) whose message
names the `npm install` command, so a host that only previews SVG in a browser installs none of them.

Copy [`docs/quickstart/developer-quickstart.opf.json`](quickstart/developer-quickstart.opf.json)
into that project as `deck.opf.json`. That file is a docs fixture, not one of
the 126 decks in `@openpresentation/opf/examples`. Verify the install came from the registry
(`package-lock.json` `resolved` URLs start with `https://registry.npmjs.org/`)
and that you did not add `file:` dependencies on this repository.

The [format card](format-card.md) describes ColorRef, named variables and the
current source contract. `opf embed` embeds the catalog records a deck uses for
portable offline authoring; it does not download remote assets. Keep the
ColorRef docs fixture outside the 126-deck example/golden corpus in this update.

## The short path

With core 0.18.0 and later, three calls of `@openpresentation/opf` cover files in a Node application (core 0.17 had them at `@openpresentation/opf/node`):

```js
import * as opf from '@openpresentation/opf';

await opf.convert('deck.opf.md', 'deck.pdf');            // also .pptx, .png (one per slide), .svg, .zip and the deck forms
const deck = await opf.open('deck.opf.md');              // .opf.md, .opf.yaml, .opf.json, or a .pptx to import
deck.slides.push({ title: 'Q4' });
await opf.save(deck, 'deck.opf.md');
```

The CLI does the same from a shell: `opf convert deck.opf.md deck.pdf`. The sections below take the pieces one at a time.

## Author and validate

```sh
npx --no-install opf --version
npx --no-install opf validate deck.opf.json
npx --no-install opf validate deck.opf.json --format text
```

The CLI depends on core, which holds the schema, catalogs and the checker. Validation never renders; `opf convert` produces PDF, PPTX, PNG and SVG and reads `.pptx` files through the optional peers `@openpresentation/opf-render` and
`@openpresentation/opf-pptx` (see [the CLI reference](cli.md); `opf doctor` says what is installed).
`opf --version` reports the CLI and the installed core. Successful validation is not
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
const { slide, options } = resolveSlideContext(document, 0, { fonts });
const geometry = composeSlide(slide, options);
const { presentation, pages } = paginate(document, { fonts });
```

`loadFonts({ pack: 'base' })` loads the bundled Roboto faces for
`design.fontScheme: 'roboto'`. It returns the fonts handle: every deck-level
verb (`paginate`, `toSvg`, `toPng`, `toPdf`, `toPptx`) takes it as
`{ fonts }` and reads what it needs from it (the `textMeasurement`, the faces
to embed, the font files). `resolveSlideContext(document, index, { fonts, catalogs })` resolves
one slide's layout, canvas, theme and font families (slide design, then deck
design, then theme, then the engine default font scheme) into the options `composeSlide`
takes, so you never look up a font scheme yourself; a reference that resolves
nowhere comes back as an `unresolved-reference` diagnostic. It also returns
`slide`: the slide with `{{slide.number}}`, `{{slide.section}}` and
`{{deck.slideCount}}` substituted for `options.slideNumber` and
`options.slideCount`; compose and draw that slide. `paginate`
does the same for every slide. The helper does not install system fonts or
change the authored scheme. Reuse the same `fonts` for SVG preview and PPTX
export.

Shared headers and footers use `furniture-flow-v2`. Body content stays between
`geometry.furniture.headerBottom` and `geometry.furniture.footerTop`. A zone
writes generated values as variables in its `text`, such as
`"{{slide.number}} / {{deck.slideCount}}"` or `"{{organization.name}}"`.

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

`@openpresentation/opf` in Node (core 0.18.0 and later) reads and writes files with the bundled fonts and loads the render and
PPTX engines you installed:

```js
import * as opf from '@openpresentation/opf';

await opf.convert('deck.opf.json', 'deck.pdf');
await opf.convert('deck.opf.json', 'slides/deck.png', { scale: 2 });   // slides/deck-001.png, -002, ...
await opf.convert('deck.opf.json', 'deck.pptx');
const back = await opf.open('deck.pptx');                              // PowerPoint to OPF
const { files } = await opf.convert(back, { format: 'svg' });          // bytes, nothing written
```

`convert` checks the deck (format and references), draws with the renderer's bundled open fonts and no system fonts,
reads images next to the input file, never reads a clock (pass `date: 'YYYY-MM-DD'` for a date field) and writes each file
atomically. A missing engine throws `OPFExportError` with code `peer-not-installed` and the install command. The options and
errors are in [OPF files in Node](node.md).

### Advanced: the engines directly

`convert` calls these. Use them when you need the pieces: your own fonts handle, one SVG per slide in a browser,
or options the function does not expose.

```js
import { toSvg, toPng, toPdf } from '@openpresentation/opf-render';
import { toPptx } from '@openpresentation/opf-pptx';

const svgs = toSvg(presentation, { fonts });   // one SVG per slide
const png = await toPng(svgs[0], { fonts });
const pdf = await toPdf(svgs, { fonts });
const pptx = await toPptx(presentation, { fonts });
```

`toSvg` is the local preview of every slide (`toSvg(presentation, 3, { fonts })` draws slide 3 as one string). PNG rasterizes that SVG.
PDF (opf-render 0.12.0 and later) converts the same SVG to **vector paths with
selectable, searchable text** in embedded font subsets, with no second layout pass;
pass `{ raster: true }` for the image-per-slide output that renderers up to 0.11.9
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
