# OPF files in Node: `@openpresentation/opf`

`@openpresentation/opf` is one import for every runtime. In Node (and Bun and Deno) it is core plus the file API: it converts,
opens and saves OPF files, and draws them as PDF, PNG, SVG and PPTX through the optional engines. In a browser or a worker the
same import gives the browser-safe build, with the same names, where only the file functions refuse.

```ts
import * as opf from "@openpresentation/opf";

await opf.convert("deck.opf.md", "deck.pdf");
const deck = await opf.open("deck.opf.md");
deck.slides.push({ title: "Q4" });
await opf.save(deck, "deck.opf.md");
const { files } = await opf.convert(deck, { format: "pptx" }); // bytes, nothing written
```

The namespace is all of core (`validate`, `parse`, `stringify`, `paginate`, `parseSlideSelection`, the types and the error
classes), so one import covers an application. The pptx.gallery catalog is the package `@openpresentation/gallery` (`gallery`, a
dependency of core, RR-78); in Node, `open`, `save` and `convert` register it when no `catalogs` are passed. A gallery that targets
another catalog record schema than core reads (`CATALOG_SCHEMA`) is refused with `gallery-schema-mismatch`.

## The CLI's verbs, with the CLI's defaults

OPF 0.18 gives the Node build the verbs of the `opf` command, so a script calls them instead of spawning `opf`:

| Function | Command | In Node, when `catalogs` is omitted |
| --- | --- | --- |
| `validate(deck, options?)` | `opf validate` | the gallery is registered, so `opf validate deck` and `validate(deck)` report the same findings |
| `stats(deck, options?)` | `opf stats` | the gallery |
| `paginate(deck, options?)` | `opf paginate` | the gallery. Pass `fonts` (opf-render's `loadFonts()`) for measured page breaks; without it the result says `layout: "estimated"`. `opf paginate` measures with the office pack, prepared once per process, as `convert` does for an export with `paginate: true` |
| `embed(deck, options?)` | `opf embed` | the gallery |
| `edit(deck, patch, options?)` | `opf edit` | the gallery for the check. Applies a JSON Patch whole or not at all (`OPFPatchError`), checks the result (`OPFValidationError`; `validate: false` skips it) and returns `{ presentation, findings, inverse }` |
| `fill(template, data?, options?)` | `opf fill` | no catalog: `data` is CSV, TSV or JSON text, a record or a list of records; returns `{ decks, complete, unfilled, diagnostics }`, and `presentation` with `combine: true`. `fillRecords(text)` reads the records alone |
| `diff(a, b)`, `merge(base, ours, theirs)` | `opf diff`, `opf merge` | no catalog |

An explicit `catalogs: []` registers none. The browser build exports the same functions and registers no catalog (FA-21): a
browser host passes `{ catalogs: [gallery] }` itself (`import { gallery } from "@openpresentation/gallery"`). Only `open`, `save` and `convert` are Node only.

A shorter name is available as an npm alias, if you want one: `npm i opf@npm:@openpresentation/opf` installs the same package
as `opf`, so `import * as opf from "opf"` works too. The docs keep the full name.

## One import for every runtime

OPF 0.18 removed the `@openpresentation/opf/node` subpath of 0.17: import `@openpresentation/opf` instead, with the same names
(OPF 0.19 removed `@openpresentation/opf/catalog` and `defaultCatalog`, with no alias: import `gallery` from
`@openpresentation/gallery`).
The package's conditional exports pick the build:

| Condition | Build | `open`, `save`, `convert` |
| --- | --- | --- |
| `bun`, `deno`, `node` | the full build (`dist/index.js`) | work on files, and `convert` also returns bytes |
| `workerd` (Cloudflare), `worker`, `browser`, `default` | the browser-safe build (`dist/browser.js`) | reject with `OPFApiError` code `node-only` |

The condition also decides how `validate` runs the JSON Schemas; see [Edge runtimes](#edge-runtimes-validators-that-never-compile-code).

- **One type surface.** Both builds share `dist/index.d.ts` (the `types` condition, first in the map), so TypeScript sees the
  same declarations under `NodeNext` and `Bundler` resolution; the file functions are documented there as Node only. The
  declarations need no Node types.
- **The browser-safe build** imports no Node builtin, no file system and neither engine (`scripts/check-browser-safe.mjs`
  bundles it for the browser and worker conditions). Its `node-only` messages name the alternative: `parse(text, { filename })`
  for `open`, `stringify(deck, { filename })` for `save`, and for `convert` the deck forms through `parse` and `stringify` and
  drawing through opf-render's `/export-browser` entry. The in-memory `convert(deck, { format })` is Node only in 0.18 too; a
  later release adds a browser implementation through `/export-browser`.
- **The Node build** loads its file engine on the first file call, so importing the root costs no more than core.
- **Bundlers** pick the browser build for a browser target and the full build for a Node target. A bundler that sets neither
  condition gets `default`, the browser-safe build: for a Node bundle, add the `node` condition (Rollup's node-resolve
  `exportConditions: ["node"]`, esbuild's `platform: "node"`).

## Edge runtimes: validators that never compile code

`validate` checks a document against the JSON Schemas with Ajv, and Ajv compiles each schema to JavaScript with `new Function` the
first time it is used. Cloudflare Workers, Vercel Edge and a page under a Content-Security-Policy without `unsafe-eval` refuse
code generation from strings (Workers: "Code generation from strings disallowed for this context", while a request is handled), so
on those hosts the package ships the same validators compiled at build time (Ajv's standalone code generation, `scripts/validators-codegen.mjs`).
They give the same verdicts and the same findings: `test/precompiled-validators.test.mjs` compares them with Ajv on every example deck,
on catalog records and on random mutants of both, and on every `oneOf` and `anyOf` branch of the schemas.

The choice is made by the package's export conditions, through the internal `#schema-engine` import (package.json `imports`), so a
host needs no alias, no build step and no option:

| Condition | Validators |
| --- | --- |
| `workerd` (Cloudflare Workers), `worker`, `edge-light` (Vercel Edge) | precompiled; no code is generated at runtime |
| `node`, `bun`, `deno`, `browser`, `default` | Ajv, compiled on the first `validate` of the process |

Wrangler and OpenNext set `workerd`, `worker` and `browser` when they bundle a Worker, and the Edge runtime of Next.js sets `edge-light`,
so a Worker needs nothing from you. Two cases do not get them by condition. Code that runs on a worker but was bundled for Node (a
Next.js route handler that Turbopack or webpack resolved with the `node` condition before OpenNext packaged it, for one), and a browser
page under a strict Content-Security-Policy. Import the precompiled validators once, before the first `validate`:

```ts
import "@openpresentation/opf/precompiled"; // installs the build-time validators for this process; it exports nothing
```

The price is size: the precompiled validators add about 78 KB gzipped (1.4 MB minified, mostly generated code) to the browser-safe
build, which is why the browser keeps Ajv by default. On the first `validate` they save the time Ajv spends compiling the schemas
(the first `validate` took about 100 ms with Ajv and about 10 ms precompiled in Node). A schema you compile yourself with Ajv is not covered: the precompiled build validates the OPF schemas that
ship in the package.

The `workerd` CI lane (`packages/javascript/test/workerd.test.mjs`, in the core job of `ci.yml`) bundles the package the way Wrangler
does, runs it in the real `workerd` runtime from the `workerd` npm package (no Cloudflare account, no login), validates the example
decks, and requires the findings to equal Node's. A control in the same file bundles a Worker without the worker conditions and
requires workerd to refuse it, so the lane fails if the default validators go back to runtime compilation. Fonts, rasterizing and the
in-memory `convert` are not part of this lane yet (CE-02, CE-03 in `docs/programs/cloud-editor/`).

## The stack

OPF is six packages. **Core** (`@openpresentation/opf`) is the format and its API: schemas, types, `validate`, `parse` and
`stringify`, composition and pagination, and in Node the files. **The gallery** (`@openpresentation/gallery`) is the pptx.gallery
catalog, a dependency of core released on its own version line. **The CLI** (`@openpresentation/cli`) is the `opf` command;
its `convert` command runs core's Node engine (through `@openpresentation/opf/internal/engine`,
which the package exports under the `node` condition for the CLI only; it is not an application API). **opf-render**,
**opf-pptx** and **opf-editor** are the engines: drawing (SVG, PNG, PDF), PowerPoint (export and import) and the editor.

## Install

```sh
npm install @openpresentation/opf @openpresentation/opf-render @openpresentation/opf-pptx \
  @resvg/resvg-js sharp pdf-lib \
  @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 \
  @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 \
  @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
```

`@openpresentation/opf-render` and `@openpresentation/opf-pptx` are optional peer dependencies of core: npm does not install them
for you, and an application that only reads, validates or converts between deck forms needs neither. Core loads them the
first time a call needs them, from core's own install location and then from the working directory; a missing one throws
`peer-not-installed` with the install command. What each output needs is listed in [the CLI reference](cli.md#install): PNG
needs `@resvg/resvg-js` and `sharp`, raster PDF `pdf-lib`, pictures in a PDF `sharp`, every format the office font pack, and
`.pptx` input or output `@openpresentation/opf-pptx`.

## `convert(input, output, options?)`

```ts
await opf.convert("deck.opf.md", "deck.pdf");
await opf.convert("deck.opf.md", "deck.pptx");
await opf.convert("deck.opf.md", "slides/deck.png");   // one PNG per slide: slides/deck-1.png, -2, ...
await opf.convert("deck.opf.md", "slides/slide-{n}.png");   // always numbered: slides/slide-1.png, slide-2.png, ...
await opf.convert("deck.pptx", "deck.opf.yaml");       // import
await opf.convert("deck.opf.json", "deck.opf.md");     // change the deck form
await opf.convert("deck.opf.md", "deck.png", { slides: "1-3", scale: 2 });
await opf.convert("deck.opf.md", "slides.zip", { format: "svg" });
```

`input` is a file path, a presentation object or the bytes of a `.pptx` file (`Uint8Array`). The formats come from the names:

| Input | Read as |
| --- | --- |
| `.pptx`, PPTX bytes | imported through opf-pptx |
| `.opf.md` | a Markdown deck |
| `.yaml`, `.yml` | a YAML deck |
| `.json` | a JSON deck |

| Output | Written as |
| --- | --- |
| `.pdf`, `.pptx` | one file |
| `.png`, `.svg` | one file per slide, named after the output: `slides/deck.png` gives `slides/deck-1.png`, `-2`, ... (the numbers are the deck's slide numbers, padded with zeros to the width of the largest number written: `deck-01.png` from ten slides, `deck-001.png` from a hundred; `slides: "2,5"` gives `deck-2.png` and `deck-5.png`). When one slide is selected (or the deck has one), it is written to the output name itself, as `opf convert deck.opf.json slide.png --slides 2` does. With `{n}` in the output (`"slides/slide-{n}.png"`) the files are always numbered, even for one slide, and `{n}` is the slide number padded by the same rule. `{n}` is the only placeholder: any other `{key}`, and `{n}` in a `.pdf`, `.pptx`, `.zip` or deck-form output, rejects with `invalid-option`. |
| `.zip` | one archive of the slides, its entries named as the plain `.png` and `.svg` files above (`slides.zip` holds `slides-1.png`, ...; always numbered; the archive's own name takes no `{n}`). The slides are PNG unless `format: "svg"`. |
| `.opf.md`, `.yaml`, `.yml`, `.json` | the deck in that form |

Any other extension, and a plain `.md` file, rejects with `invalid-option`, which names the supported extensions. A `format`
that disagrees with the output's extension is refused too; it is only needed for a `.zip`.

**Without an output path**, pass the format in the options: `convert(input, { format })` writes nothing and returns the files
with their names and bytes. `name` sets the base name of the files; without it they follow the deck: its `filename`, else its
slugified `name`, else the input file's stem (`Q4-Review.pdf`, `Q4-Review-1.png`; padded like the files above, `Q4-Review-01.png` from ten slides, `deck.opf.yaml`). `zip: true` returns one archive of
the PNG or SVG slides; with an output path a `.zip` name makes the archive instead.

**Options** are the flags of `opf convert` in camel case: `slides` (`3`, `"1,3-5"` or `[1, 3]`, read by `parseSlideSelection`), `includeHidden`, `paginate`, `scale`
(0.1 to 8, PNG and raster PDF), `raster` (`true` draws a PDF as a picture per page; vector text is the default), `text` (an SVG
carries `"fonts"`, the default, which embeds the faces the slide uses; `"system"`, none, for a page that has the fonts; or
`"paths"`, glyph outlines, so the file needs no font), `charts` (`"auto"`, `"native"` or `"picture"`), `provenance` and `images`
(`"compatible"` or `"preserve"`) for PPTX, `date` (`YYYY-MM-DD` for date fields; nothing reads a clock), `catalogs` (the default
catalog when omitted), `fonts` (a prepared `loadFonts()` handle of `@openpresentation/opf-render/fonts-node`, or a folder or a list
of folders of `.ttf`/`.otf` files), `assetDir`, plus `signals` (a `.pptx` input: also return the importer's per-shape
signals), and for output without a path `zip` and `name`, and `overwrite`. An option that does not apply to the pair rejects with
`invalid-option`: `scale` for a deck output, `slides` for a PPTX, `raster` for anything but a PDF, `text` for anything but an SVG,
`zip` or `name` with an output path. The 0.17 names (`pdfMode`, `svgFonts`, `chartex`, `imageFormat`, `fontDirs`, `filename`) were
renamed in 0.18 and are refused with the new name.

**Writing.** Inputs are checked and all results are produced and staged before destination files are published. A preflight,
render or staging failure publishes no destination files, though parent folders may have been created. Each final file is
published atomically from a temporary sibling, so no partial file has the final name. Multiple files are not one transaction:
a later publication I/O failure can leave earlier complete outputs in place. Keep that possibility in your recovery logic.
Existing regular outputs are replaced by default, as `save` and `fs.writeFile` do: running the same `convert` again rebuilds
the file. `overwrite: false` checks for existing outputs during preflight and reports `output-exists`, the rule the `opf`
commands apply without `--force`. A symlink, a directory or another non-regular file is refused (`output-not-file`). The result
is `{ files: [{ name, path, type, bytes, ... }], findings }`, with the slide number, id and size of each picture and the pages of a PDF.

**Images.** When `input` is a path, a deck's relative image paths resolve against the input file's folder, from any working
directory; `assetDir` replaces that folder. Only image files inside it are read, and URLs are never fetched.

**Chaining.** A `.pptx` input is imported, checked and then exported or written. `findings` holds both steps: the importer's
diagnostics carry the `import/` rule prefix, the format and references check `opf/`, and the engines `render/`, `pptx/`,
`pdf/`, `fonts/` and `cli/`.

## `open(pathOrBytes, options?)`

Returns the presentation itself. A `.opf.md`, `.yaml`/`.yml` or `.json` file is read in the form its extension names and
checked for format and references; a `.pptx` path or its bytes are imported. An invalid deck throws `OPFValidationError`,
whose findings are located by line and column in the file; a PowerPoint file that cannot be imported throws `OPFImportError`.
Warnings are not returned: `validate` reports them, and `convert("deck.pptx", "deck.opf.yaml")` returns what an import could
not keep. `catalogs` (default: the default catalog) is where references resolve.

## `save(deck, path, options?)`

Writes the deck in the form the file name names (`.opf.md`, `.yaml`/`.yml` or `.json`), atomically, creating folders and
replacing the file. It checks format and references first and refuses an invalid deck with `OPFValidationError`; `validate:
false` writes work in progress, as an editor's autosave does (the YAML and Markdown writers still refuse a document that is
not well-formed OPF). `schemaComment: true` starts a YAML file with the editor modeline. Returns `{ path, format }`.

## Errors

Every error has a `code`; branch on it, never on the message.

| Class | Codes |
| --- | --- |
| `OPFApiError` (the base class) | `node-only` (the browser-safe build), `invalid-option`, `input-not-found`, `input-unreadable`, `invalid-presentation` (a deck written as a deck), `output-exists`, `output-not-file`, `output-unwritable` |
| `OPFExportError` | the export step: `peer-not-installed` (the message carries the install command; `details` the package and range), `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, a font code |
| `OPFImportError` | the import step and `open` of a PowerPoint file: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `import-failed`, `invalid-presentation` |
| `OPFValidationError` | `open` and `save` of an invalid deck; also thrown by core's `parse` and `assertValid` |

`findings` on an error holds the located findings of the failed step.

## Fonts, determinism and the network

Drawing uses the renderer's bundled open font pack (the office pack with visual substitution) plus the files in the `fonts` folders, never
system fonts. The pack is prepared once per process and reused by every call that passes no `fonts` (with `fonts` folders, once per
list of files); a deck that draws a script beyond Latin, Greek and Cyrillic gets a handle with its script
faces. Concurrent calls share the one preparation and draw one at a time on it. The output is the same bytes as with a handle
of the caller's own. Nothing is fetched and no clock is read: the same input, options and installed versions give the same
bytes on every machine.

## Reading and writing text without files

Core reads and writes deck text in every runtime: `parse(text, { filename?, format?, catalogs? })` returns the
presentation and throws `OPFValidationError` on syntax, schema or reference errors (findings located by line and column);
`stringify(deck, { format? | filename? })` returns text; `validate(text)` returns the full report, warnings included.

## Slide selections

`parseSlideSelection(selection, total, label?)` (both builds) turns a selection into slide numbers, one-based, ascending and
without repeats: `3`, `[1, 3]`, `"1,3-5"`, `"2-"` (to the end) and `"-3"` (from the start). It throws `OPFApiError`
`invalid-option` for a malformed selection, a number that is not a whole number from 1, a reversed range or a slide past the
end, and `no-slides` when `total` is 0. `convert` and the opf CLI's `--slides` read selections with it, and an engine can share it.
