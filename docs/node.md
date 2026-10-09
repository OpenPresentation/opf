# OPF files in Node: `@openpresentation/opf/node`

`@openpresentation/opf/node` is core's file API: it converts, opens and saves OPF files, and draws them as PDF, PNG, SVG and
PPTX through the optional engines. It is Node-only. The root `@openpresentation/opf` and every other subpath stay free of the
file system and run in a browser.

```ts
import * as opf from "@openpresentation/opf/node";

await opf.convert("deck.opf.md", "deck.pdf");
const deck = await opf.open("deck.opf.md");
deck.slides.push({ title: "Q4" });
await opf.save(deck, "deck.opf.md");
const { files } = await opf.convert(deck, { format: "pptx" }); // bytes, nothing written
```

The namespace also re-exports the rest of core (`validate`, `parse`, `stringify`, `paginate`, the types and the error classes)
and `defaultCatalog`, so one import covers an application.

## The stack

OPF is five packages. **Core** (`@openpresentation/opf`) is the format and its API: schemas, types, `validate`, `parse` and
`stringify`, composition and pagination, with `/node` for files. **The CLI** (`@openpresentation/cli`) is the `opf` command; its
`convert`, `render`, `export` and `import` commands run the `/node` engine. **opf-render**, **opf-pptx** and **opf-editor** are the
engines: drawing (SVG, PNG, PDF), PowerPoint (export and import) and the editor.

## Install

```sh
npm install @openpresentation/opf @openpresentation/opf-render @openpresentation/opf-pptx \
  @resvg/resvg-js sharp pdf-lib \
  @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 \
  @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 \
  @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
```

`@openpresentation/opf-render` and `@openpresentation/opf-pptx` are optional peer dependencies of core: npm does not install them
for you, and an application that only reads, validates or converts between deck forms needs neither. `/node` loads them the
first time a call needs them, from core's own install location and then from the working directory; a missing one throws
`peer-not-installed` with the install command. What each output needs is listed in [the CLI reference](cli.md#install): PNG
needs `@resvg/resvg-js` and `sharp`, raster PDF `pdf-lib`, pictures in a PDF `sharp`, every format the office font pack, and
`.pptx` input or output `@openpresentation/opf-pptx`.

## `convert(input, output, options?)`

```ts
await opf.convert("deck.opf.md", "deck.pdf");
await opf.convert("deck.opf.md", "deck.pptx");
await opf.convert("deck.opf.md", "slides/deck.png");   // one PNG per slide: slides/deck-001.png, -002, ...
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
| `.png`, `.svg` | one file per slide, named after the output: `slides/deck.png` gives `slides/deck-001.png`, `-002`, ... (padded to three digits, or more for a longer deck; the numbers are the deck's slide numbers). When one slide is selected (or the deck has one), it is written to the output name itself, as `opf render --out slide.png` does. |
| `.zip` | one archive of the slides, named as above inside it. The slides are PNG unless `format: "svg"`. |
| `.opf.md`, `.yaml`, `.yml`, `.json` | the deck in that form |

Any other extension, and a plain `.md` file, rejects with `invalid-option`, which names the supported extensions. A `format`
that disagrees with the output's extension is refused too; it is only needed for a `.zip`.

**Without an output path**, pass the format in the options: `convert(input, { format })` writes nothing and returns the files
with their names and bytes. The names follow the deck: its `filename`, else its slugified `name`, else the input file's stem
(`Q4-Review.pdf`, `Q4-Review-001.png`, `deck.opf.yaml`).

**Options** are those of `opf export` in camel case: `slides` (`"1,3-5"` or `[1, 3]`), `includeHidden`, `paginate`, `scale`
(0.1 to 8, PNG and raster PDF), `pdfMode` (`vector`, the default, or `raster`), `svgFonts` (`used` or `none`), `chartex`,
`provenance` and `imageFormat` (PPTX), `date` (`YYYY-MM-DD` for date fields; nothing reads a clock), `catalogs` (the default
catalog when omitted), `fonts` (a prepared `loadFonts()` handle of `@openpresentation/opf-render/fonts-node`), `fontDirs`
(directories of `.ttf`/`.otf` files), `assetDir`, plus `signals` (a `.pptx` input: also return the importer's per-shape
signals), `zip` and `force`. An option that does not apply to the pair rejects with `invalid-option`: `scale` for a deck
output, `slides` for a PPTX, `pdfMode` for anything but a PDF.

**Writing.** Everything is checked, read and produced before anything is written; on any error nothing is written. Parent
folders are created. Each file is written to a temporary sibling and renamed, so no partial file ever has the final name. An
output that exists rejects with `output-exists` unless `force: true`, as `--force` does for the commands; a symlink or a
non-regular file is never replaced. The result is `{ files: [{ name, path, type, bytes, ... }], findings }`, with the slide
number, id and size of each picture and the pages of a PDF.

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
| `OPFApiError` (the base class) | `invalid-option`, `input-not-found`, `input-unreadable`, `invalid-presentation` (a deck written as a deck), `output-exists`, `output-not-file`, `output-unwritable` |
| `OPFExportError` | the export step: `peer-not-installed` (the message carries the install command; `details` the package and range), `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, a font code |
| `OPFImportError` | the import step and `open` of a PowerPoint file: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `import-failed`, `invalid-presentation` |
| `OPFValidationError` | `open` and `save` of an invalid deck; also thrown by core's `parse` and `assertValid` |

`findings` on an error holds the located findings of the failed step.

## Fonts, determinism and the network

Drawing uses the renderer's bundled open font pack (the office pack with visual substitution) plus the `fontDirs` files, never
system fonts. The pack is prepared once per process and reused by every call that passes neither `fonts` nor `fontDirs` (with
`fontDirs`, once per list of files); a deck that draws a script beyond Latin, Greek and Cyrillic gets a handle with its script
faces. Concurrent calls share the one preparation and draw one at a time on it. The output is the same bytes as with a handle
of the caller's own. Nothing is fetched and no clock is read: the same input, options and installed versions give the same
bytes on every machine.

## Reading and writing text without files

Core's root (browser-safe) reads and writes deck text: `parse(text, { filename?, format?, catalogs? })` returns the
presentation and throws `OPFValidationError` on syntax, schema or reference errors (findings located by line and column);
`stringify(deck, { format? | filename? })` returns text; `validate(text)` returns the full report, warnings included.
