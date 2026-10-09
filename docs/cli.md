# The `opf` CLI: producing and reading files

The CLI (`@openpresentation/cli`, binary `opf`, Node 22 or later; verified on Node 24) validates, edits, paginates and bundles documents (see
[its README](../packages/cli/README.md)). `opf validate` is the one checker ([validate](validate.md)). Four commands
produce and read files: `opf render`, `opf export`, `opf convert` and `opf import`. They run core's file engine, the one
applications call as [`@openpresentation/opf`](node.md) (`convert`, `open`, `save`); the commands add the flags, the
JSON report and the exit codes.

All four are deterministic and local: no network, no model, no telemetry, no system fonts. The same document, options
and installed package versions give the same bytes on every operating system.

## Install

`render`, `export` and `convert` to PDF, PNG or SVG need `@openpresentation/opf-render`; PPTX output and `.pptx` input (`export
--format pptx`, `import`, `convert` from or to `.pptx`) also need `@openpresentation/opf-pptx`. Both are **optional peer dependencies** of the CLI and of core (decision RR-27, below; RR-62 moved the engine into core, RR-70 made it the root's Node build), loaded the
first time a command needs them. Install them next to the CLI:

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx @resvg/resvg-js sharp pdf-lib @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
# a project that depends on the CLI
npm install -D @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx @resvg/resvg-js sharp pdf-lib @expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2
# one run, nothing installed
npx -p @openpresentation/cli -p @openpresentation/opf-render -p @openpresentation/opf-pptx -p @resvg/resvg-js -p sharp -p @expo-google-fonts/roboto@0.4.3 -p @expo-google-fonts/roboto-mono@0.4.2 -p @expo-google-fonts/caladea@0.4.2 -p @expo-google-fonts/arimo@0.4.3 -p @expo-google-fonts/tinos@0.4.2 -p @expo-google-fonts/cousine@0.4.3 -p @expo-google-fonts/gelasio@0.4.1 -p @expo-google-fonts/noto-sans@0.4.2 opf export deck.opf.json --format pptx
```

The CLI looks for a peer beside itself first (a global install, an npx run, a project dependency) and in the working
directory second. Without it the command exits 2 with `code: "peer-not-installed"` and the install command. The
commands check the functions they call and name the version to install when an older peer lacks one.

From opf-render 0.16 the renderer's own dependencies are optional peers too: the converters (`pdf-lib`, `@resvg/resvg-js`,
`sharp`) and every `@expo-google-fonts/*` package, so a host installs only what its outputs use. The CLI and
`@openpresentation/opf` in Node always load the renderer's office font pack. What each output needs beside `@openpresentation/opf-render`:

| Output | Also install |
| --- | --- |
| every format (the office font pack) | `@expo-google-fonts/roboto@0.4.3 @expo-google-fonts/roboto-mono@0.4.2 @expo-google-fonts/caladea@0.4.2 @expo-google-fonts/arimo@0.4.3 @expo-google-fonts/tinos@0.4.2 @expo-google-fonts/cousine@0.4.3 @expo-google-fonts/gelasio@0.4.1 @expo-google-fonts/noto-sans@0.4.2` |
| `png` | `@resvg/resvg-js@^2.6.2 sharp@^0.35.5` |
| `pdf` | nothing for text in the default vector mode; `pdf-lib@^1.17.1` for `--raster`; `sharp@^0.35.5` when the deck has pictures |
| `svg` | the fonts only |
| `pptx`, `import` | `@openpresentation/opf-pptx` (an SVG picture in a PPTX is rasterized by the renderer, so `@resvg/resvg-js`) |

A converter or font package that is missing is reported as the same missing-peer error as a missing renderer: the command
exits 2 with `code: "peer-not-installed"` and the renderer's own install command in `error`, with `package` (or `packages`),
`range`, `install` and `purpose` beside it; `convert` of `@openpresentation/opf` throws `OPFExportError` with the same `code` and `details`.

## From code

The commands are the CLI; the engine they run is core's `@openpresentation/opf` in Node, which an application imports instead
of spawning `opf`:

```ts
import * as opf from "@openpresentation/opf";

await opf.convert("deck.opf.md", "deck.pdf");                         // opf convert deck.opf.md deck.pdf
const { files } = await opf.convert(deck, { format: "png", scale: 2 }); // bytes, nothing written
const deck = await opf.open("deck.pptx");                             // import
```

The options are the flags in camel case (`--raster` is `raster: true`, `--fonts` is `fonts` (a folder or a list of folders), `--asset-dir` is
`assetDir`, `--include-hidden` is `includeHidden`; `--text`, `--charts` and `--images` keep their names). The 0.17 names (`pdfMode`, `svgFonts`, `chartex`,
`imageFormat`, `fontDirs`, `filename`) are refused with the new name. The commands refuse an existing output without `--force`; `convert` replaces it unless
`overwrite: false`. The error codes are the commands': `peer-not-installed`,
`peer-too-old`, `peer-load-failed`, `invalid-option` and `input-not-found` (command exit 2), `invalid-presentation`,
`no-slides`, `all-slides-hidden`, `export-failed`, `import-failed` and `output-exists` (1). See [OPF files in Node](node.md).

## `opf render`

```sh
opf render deck.opf.json [--slides 1,3-5] [--include-hidden] [--format svg|png] [--scale N] [--text fonts|system|paths] [--out dir|file|-]
```

One file per slide: `<name>-001.svg` (or `.png`) in `--out` (default `<name>-slides/`). `--format` defaults to `svg`, or to the
format `--out` names: `--out slide.png` is PNG. An `--out` with another file extension (`deck.pdf`, `deck.txt`) is a usage
error (exit 2), so it never becomes a folder of that name. See [Output names](#output-names) for `<name>`.
Slides marked `hidden: true` are skipped, as in the presenter, unless `--include-hidden`; the numbers in file names stay the
slide numbers of the document, so skipping slide 2 writes `-001` and `-003`. `--slides` takes one-based
numbers and ranges (`1,3-5`, `2-` to the end, `-3` from the start). `--format` defaults to `svg`. `--scale` (0.1 to 8,
default 1) sets the PNG pixel density against the 1280 x 720 reference slide. `--out -` writes one slide to stdout.

An SVG is standalone: it embeds the faces its text names (a Latin slide carries about 2 MB of font data), never the
whole pack. `--text system` leaves the fonts out for a smaller file that depends on the viewer's fonts, and `--text paths` draws every
glyph as an outline, so the file needs no font at all (see [Fonts](#fonts)). `--text fonts` is the default. PNG and PDF
output reads the same font files and embeds nothing.

## `opf export`

```sh
opf export deck.opf.json --format pptx|pdf|png|svg [--out file|dir|.zip|-] [--slides 1,3-5] [--include-hidden]
           [--raster] [--charts auto|native|picture] [--text fonts|system|paths]
           [--provenance full|references-only|none] [--images compatible|preserve]
```

| Format | Output | Notes |
| --- | --- | --- |
| `pptx` | `<name>.pptx` | opf-pptx `toPptx`. The whole deck (`--slides` is refused). `--charts` (`picture` draws the charts as pictures), `--provenance` (`none` writes no provenance tags) and `--images` set the `toPptx` options. |
| `pdf` | `<name>.pdf` | One page per selected slide. `--raster` draws each page as one image; the default is vector with selectable text. The report states the mode used (`pdf.mode`). |
| `png`, `svg` | a directory, one file (`--out x.png`, one slide), or a zip (`--out x.zip`) | As `render`. Zip entries are stored (not deflated) with a fixed timestamp, so the archive is byte-identical everywhere. |

The format is taken from `--out`'s extension when `--format` is omitted (`.pptx`, `.pdf`, `.png`, `.svg`), with the rule
`opf convert` uses. A `--format` that disagrees with that extension, and an `--out` with another file extension, are usage
errors (exit 2).

The PDF and the `png` and `svg` outputs skip hidden slides unless `--include-hidden`. The `pptx` output always carries them, as hidden slides (`--include-hidden` is refused for it).

## `opf import`

```sh
opf import deck.pptx [--out deck.opf.json|-] [--signals signals.json]
```

`fromPptx` to an OPF document (default `<name>.opf.json` in the working directory; `-` reads or writes stdin/stdout).
Import is a conversion, not a lossless round trip for arbitrary decks: what it cannot keep is reported as `import/...`
diagnostics. `--signals` also writes the raw per-shape layout and style signals (`fromPptx` with `signals: true`, which returns
`{ presentation, signals }`). The signals are deterministic data; they never leave the machine.
AI reconstruction of third-party decks is not part of the CLI (it lives in pptx.dev).

## `opf convert`

```sh
opf convert deck.opf.md deck.pdf
opf convert deck.opf.md slides/deck.png --slides 1-3 --scale 2   # slides/deck-001.png, -002, -003
opf convert deck.opf.md slides.zip --format svg
opf convert deck.pptx deck.opf.yaml
opf convert deck.opf.json deck.opf.md
```

One file to another, the formats named by the extensions. The input is `.pptx` (imported), `.opf.md`, `.yaml`/`.yml` or
`.json`; the output is `.pdf`, `.pptx`, `.png`, `.svg`, `.zip`, `.opf.md`, `.yaml`/`.yml` or `.json`. Any other extension,
and stdin or stdout (`-`), is a usage error (exit 2) that names the supported ones.

| Output | Written as |
| --- | --- |
| `.pdf`, `.pptx` | one file |
| `.png`, `.svg` | one file per slide beside the output, named after it: `slides/deck.png` writes `slides/deck-001.png`, `-002`, ... (the numbers are the deck's slide numbers, padded as `render` pads them). One selected slide, or a one-slide deck, is written to the output name itself, as `opf render --out slide.png` does. |
| `.zip` | one archive of the slides, named as above inside it: PNG, or SVG with `--format svg` |
| `.opf.md`, `.yaml`, `.yml`, `.json` | the deck in that form |

The flags are those of `opf export` (`--slides`, `--scale`, `--raster`, `--text`, `--charts`, `--provenance`,
`--images`, `--paginate`, `--include-hidden`, `--date`, `--fonts`, `--asset-dir`, `--force`, `--fail-on`, `--json`);
`--format` is needed only for a `.zip`. A flag that does not apply to the pair (`--scale` for a deck output, `--slides` for a
PPTX) is a usage error. Relative images resolve next to the input file unless `--asset-dir`. Parent folders are created; every
file is produced before any is written, each through a temporary sibling and a rename; an existing output needs `--force`.

The report is `opf export`'s (`command: "convert"`, `format`, `ok`, `valid`, `written`, `input`, `outputs` with SHA-256
digests, `findings`, `counts`, `checks`, the engines' versions and, for drawn output, `fonts`). A `.pptx` input is imported,
checked and then written or drawn; `findings` holds both steps (`import/` rules from the importer). The exit codes are
`export`'s.

## Options shared by `render` and `export`

### Output names

Files are named by the deck: its root `filename` (a trailing `.pptx`, `.pdf`, `.png` or `.svg` is dropped, in any case), else
its `name` slugified (`Q4 Review / 2026` becomes `Q4-Review-2026`), else the input file's stem (`deck.opf.json` gives `deck`).
The same rule names the editor's downloads. An explicit `--out` is used as given.

### Hidden slides

`render` and `export` skip slides marked `hidden: true` when they write one file per slide, a zip or a PDF, because a hidden slide is
not part of the presented sequence. `--include-hidden` writes them too. Slides named with `--slides` are always written, hidden or
not. The report lists the slide numbers left out in `skippedHidden`. A deck whose every slide is hidden exits 1 and names the flag.


| Option | Meaning |
| --- | --- |
| `--include-hidden` | Write hidden slides too (per-slide images, zips and PDF). See [Hidden slides](#hidden-slides). |
| `--paginate` | Paginate with the same fonts first (as `opf paginate` does, but measured), so overflowing slides split instead of reporting `text-overflow`. `--slides` then counts the paginated slides. |
| `--date YYYY-MM-DD` | The date for `date: true` header and footer fields. The CLI never reads a clock; without it a current date is reported as unresolved. |
| `--fonts <directory>` (repeatable) | Your own `.ttf`/`.otf` files, loaded in addition to the bundled pack, directly inside the directory, sorted by name. A face that repeats a bundled family, weight and style is refused. |
| `--asset-dir <directory>` | The folder relative image paths resolve against and the only folder read. Default: the document's folder (the working directory for stdin). |
| `--fail-on <error\|warning\|info>` | Findings at or above this severity fail, and nothing is written (default `error`). `--fail-on warning` fails on warnings; every command that checks a document takes it. |
| `--force` | Replace existing outputs. Without it any existing destination exits 1 before anything is written. |
| `--json` | Accepted for scripts that pass it everywhere. JSON is the default report format; `--format text` selects human-readable diagnostics on commands that support it. |

## Fonts

The renderer's bundled open font pack (the office pack: Carlito, Intos for Aptos, the open families font schemes
select and the open replacements the font policy routes proprietary families to, with lazy faces) with the visual
substitution policy, plus the files from `--fonts`. **System fonts are never loaded**, and nothing is downloaded.
Font substitutions are listed under `fonts.substitutions` in the report with their `compatibility` (`metric` or
`visual`). The PPTX keeps the font names the document chose.

Scripts beyond Latin, Greek and Cyrillic need the optional Noto script packages of the renderer
(`@expo-google-fonts/noto-sans-jp` and so on). Install the ones named in the `fonts/script-font-not-installed`
diagnostic next to the CLI; without them, text the loaded faces cannot draw is the error `render/missing-glyph`.
Standalone SVG (`--text fonts`, the default) embeds the installed script faces its text uses, just like Latin faces.
`--text system` omits all font bytes and requires the viewer to provide the matching families. `--text paths` draws the text as
glyph outlines (shaped, with the real text kept invisible beside it for selection and search), so the SVG needs no font and
looks the same in every viewer; it is for previews and portable files, not for editing the text in place. `--text` applies to SVG output.

## Images and assets

Relative image paths and `file:` paths resolve against the document's folder (or `--asset-dir`). Only `.png`, `.jpg`,
`.jpeg`, `.gif`, `.webp` and `.svg` files whose content matches are read, and only inside that folder (symlinks are
resolved first), so a document cannot pull another file on the machine into an output. URLs are never fetched. For SVG
and PNG output, an unreadable image draws the renderer's placeholder with an `unresolved-asset` or `cli/asset-blocked`
warning. For PPTX an unreadable or blocked local path stops the export (`pptx/asset-unresolved`): opf-pptx would otherwise read the path itself.
An unresolved remote URL is never fetched; the exporter can write an unavailable-image placeholder with a
`pptx/unresolved-asset` warning. Use `--fail-on warning` to reject that incomplete output before any file is written. SVG
pictures in a PPTX get their PNG fallback from the CLI's own opf-render install (`svgRasterizer`), so they export
whichever way the packages were installed.

## Markdown and YAML

JSON stays the canonical form of a deck. YAML (`deck.opf.yaml`) and Markdown (`deck.opf.md`) are authoring forms of the same data, and every command that reads or writes a deck reads and writes all three. Two more groups of commands convert between a deck and text, with no renderer: they are core features (`@openpresentation/opf/markdown` and `@openpresentation/opf/yaml`) and need no optional peer.

```sh
opf from-md deck.md deck.opf.json            # Markdown in the OPF dialect to a validated deck
opf to-md deck.opf.json deck.md              # a deck as Markdown that reads back unchanged
opf from-yaml deck.opf.yaml deck.opf.json    # strict YAML to a validated deck (--aliases expands anchors)
opf to-yaml deck.opf.json deck.opf.yaml --schema-comment
opf validate deck.opf.yaml                   # every command that reads a deck reads .yaml and .yml files
opf validate deck.opf.md                     # ... and .opf.md Markdown decks (a plain .md file is never a deck)
opf edit deck.opf.md --patch changes.json --in-place   # the file stays Markdown
opf format deck.opf.md --check               # canonical Markdown
opf render deck.opf.md --out slides
opf edit deck.opf.json --patch changes.json --output deck.opf.yaml   # or --format yaml
opf validate - --input-format yaml < deck.txt     # json (default), yaml or markdown (md)
```

- `from-md` and `to-md` follow the Markdown dialect (YAML front matter, `---` between slides, `#` title, lists, tables, `chart`, `metric` and `timeline` fences, speaker notes): see [Markdown and outlines](markdown.md). `from-md --format yaml` or a `.yaml` output writes the deck as YAML.
- `from-yaml` and `to-yaml` read and write a deck as JSON-compatible YAML 1.2, with canonical key order and an optional `# yaml-language-server` line for editor validation: see [OPF as YAML](yaml.md). A file ending `.yaml` or `.yml` is read as YAML by every command; stdin and other names are JSON unless `--input-format yaml` is given. Commands that write a deck write YAML for an output ending `.yaml`/`.yml` or with `--format yaml`. A YAML syntax error exits 2 with the line and column (`opf validate` reports it as a `yaml/<rule>` finding and exits 1); commands that rewrite a YAML file do not preserve its comments and say so on stderr.
- A file ending `.opf.md` is read as a Markdown deck by every command, and `--input-format markdown` (or `md`) reads stdin and other names that way. A command that writes a deck writes Markdown for an output ending `.opf.md` or with `--format markdown`, and otherwise the format it read; `opf format deck.opf.md` canonicalizes it. A Markdown syntax error exits 2 with `line:column` (`opf validate` reports it as a `markdown/<rule>` finding and exits 1), and a rewrite that has to put content into an `opf-slide`/`opf-block` fence says so on stderr. See [Markdown decks in every command](markdown.md#markdown-decks-in-every-command).
- All of them print JSON reports (on stderr when stdout carries the document) and use the exit codes below: 0 success, 1 invalid content, an output conflict or a finding at or above `--fail-on`, 2 usage, a read error or I/O.

## Diagnostics and exit codes

The report is the [`opf validate`](validate.md) report with the written files added: `ok`, `valid`, `schemaValid`,
`findings` (`ruleId`, `severity`, `category`, JSON Pointer `path`, `scope`, `message`, `help`), `counts`, `checks`, `sha256` and
`opfVersion`. The document's format and references are checked first (not accessibility or layout rules: a contrast
warning never blocks a write); an invalid one exits 1 and nothing is rendered. Library findings are added with the
prefix `render/`, `pptx/`, `pdf/`, `fonts/`, `import/` or `cli/` (the same word is their category), for example
`render/text-overflow`. Notes (`font-glyph-fallback`, `pdf-font-embedded`, `svg-sanitized`) are `info`; everything else a
library reports is a `warning`; a failed render, export or import is an `error`. `checks.layout` is `measured`: the
CLI measures text with the fonts it loaded.

`outputs` lists each file with `sha256`, `bytes`, `mediaType`, and for slides `slide`, `id`, `width`, `height`.
`renderer` and `pptx` give the package versions used. With `--out -` the file goes to stdout and the report to stderr.

Exit `0`: success (warnings allowed). Exit `1`: invalid document, error finding, a finding at or above `--fail-on`, or an
existing output. Exit `2`: usage, I/O, a missing or too-old peer, a font directory problem. (`opf validate` has the
same codes; text that is not valid JSON is an invalid document, exit `1`, with an `opf/json-syntax` finding.)

## Runtime choices

- **Peers, not bundled.** opf-render and opf-pptx are optional peer dependencies loaded lazily. opf-pptx pulls the
  native `sharp` engine, opf-render `resvg`, `fontkit` and the font packs (about 135 MB installed); bundling them would
  turn a 1.6 MB, dependency-free CLI into one that cannot be installed offline or on a locked-down agent host, and
  validating or editing a document would pay for it. The tarball stays small and `dependencies` holds only core (`@openpresentation/opf`, whose Node engine the commands run).
- **JSON by default.** `--json` is a compatibility flag. Commands such as `validate` accept `--format text` for
  human-readable diagnostics; render/export use `--format` to select the output file type and retain JSON reports.
- **No clock.** `--date` is explicit so a rerun tomorrow gives the same bytes.
- **Fonts are the bundled pack plus `--fonts`.** Never system fonts (owner font policy).
- **Stored zip entries.** Deflate output differs between zlib builds, which would make archive hashes host-dependent.

## Catalog names

`opf catalogs` lists canonical camelCase names such as `colorSchemes` and `fontSchemes`.
`opf catalog` also accepts the website-style `color-schemes`, `font-schemes` and `chart-types` spellings.
