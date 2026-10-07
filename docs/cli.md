# The `opf` CLI: producing and reading files

The CLI (`@openpresentation/cli`, binary `opf`, Node 24) validates, edits, paginates and bundles documents (see
[its README](../packages/cli/README.md)). `opf validate` is the one checker ([validate](validate.md)). Three commands
produce and read files: `opf render`, `opf export` and `opf import`. They are in the CLI after RR-27 of the [release readiness program](programs/release-readiness/README.md)
and ship in CLI 0.10.0, the first CLI release after 0.9.2.

All three are deterministic and local: no network, no model, no telemetry, no system fonts. The same document, options
and installed package versions give the same bytes on every operating system.

## Install

`render` and `export` need `@openpresentation/opf-render`; `export --format pptx` and `import` also need
`@openpresentation/opf-pptx`. Both are **optional peer dependencies** of the CLI (decision RR-27, below), loaded the
first time a command needs them. Install them next to the CLI:

```sh
npm install -g @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx
# a project that depends on the CLI
npm install -D @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx
# one run, nothing installed
npx -p @openpresentation/cli -p @openpresentation/opf-render -p @openpresentation/opf-pptx opf export deck.opf.json --format pptx
```

The CLI looks for a peer beside itself first (a global install, an npx run, a project dependency) and in the working
directory second. Without it the command exits 2 with `code: "peer-not-installed"` and the install command. The
commands check the functions they call and name the version to install when an older peer lacks one.

## `opf render`

```sh
opf render deck.opf.json [--slides 1,3-5] [--include-hidden] [--format svg|png] [--scale N] [--out dir|file|-]
```

One file per slide: `<name>-001.svg` (or `.png`) in `--out` (default `<name>-slides/`). See [Output names](#output-names) for `<name>`.
Slides marked `hidden: true` are skipped, as in the presenter, unless `--include-hidden`; the numbers in file names stay the
slide numbers of the document, so skipping slide 2 writes `-001` and `-003`. `--slides` takes one-based
numbers and ranges (`1,3-5`, `2-` to the end, `-3` from the start). `--format` defaults to `svg`. `--scale` (0.1 to 8,
default 1) sets the PNG pixel density against the 1280 x 720 reference slide. `--out -` writes one slide to stdout.

An SVG is standalone: it embeds the faces its text names (a Latin slide carries about 2 MB of font data), never the
whole pack. `--svg-fonts none` leaves the fonts out for a smaller file that depends on the viewer's fonts. PNG and PDF
output reads the same font files and embeds nothing.

## `opf export`

```sh
opf export deck.opf.json --format pptx|pdf|png|svg [--out file|dir|.zip|-] [--slides 1,3-5] [--include-hidden]
           [--pdf-mode vector|raster] [--chartex auto|native|fallback]
           [--provenance full|references-only|none] [--image-format compatible|preserve]
```

| Format | Output | Notes |
| --- | --- | --- |
| `pptx` | `<name>.pptx` | opf-pptx `toPptx`. The whole deck (`--slides` is refused). `--chartex`, `--provenance` and `--image-format` are the `toPptx` options of the same names (`none` writes no provenance tags). |
| `pdf` | `<name>.pdf` | One page per selected slide. `--pdf-mode` picks `vector` (selectable text, from the opf-render release that carries opf-render#90) or `raster` (one image per page); omitted, the installed renderer's default. `--pdf-mode vector` on a renderer without it exits 2. The report states the mode used (`pdf.mode`). |
| `png`, `svg` | a directory, one file (`--out x.png`, one slide), or a zip (`--out x.zip`) | As `render`. Zip entries are stored (not deflated) with a fixed timestamp, so the archive is byte-identical everywhere. |

The format is taken from `--out`'s extension when `--format` is omitted (`.pptx`, `.pdf`, `.png`, `.svg`).

The PDF and the `png` and `svg` outputs skip hidden slides unless `--include-hidden`. The `pptx` output always carries them, as hidden slides (`--include-hidden` is refused for it).

## `opf import`

```sh
opf import deck.pptx [--out deck.opf.json|-] [--signals signals.json]
```

`fromPptx` to an OPF document (default `<name>.opf.json` in the working directory; `-` reads or writes stdin/stdout).
Import is a conversion, not a lossless round trip for arbitrary decks: what it cannot keep is reported as `import/...`
diagnostics. `--signals` also writes the raw per-shape layout and style signals (`fromPptx` with `signals: true`,
opf-pptx 0.11.9 and later; an older peer exits 2). The signals are deterministic data; they never leave the machine.
AI reconstruction of third-party decks is not part of the CLI (it lives in pptx.dev).

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
| `--font-dir <directory>` (repeatable) | Your own `.ttf`/`.otf` files, loaded in addition to the bundled pack, directly inside the directory, sorted by name. A face that repeats a bundled family, weight and style is refused. |
| `--asset-dir <directory>` | The folder relative image paths resolve against and the only folder read. Default: the document's folder (the working directory for stdin). |
| `--fail-on <error\|warning\|info>` | Findings at or above this severity fail, and nothing is written (default `error`). `--fail-on warning` fails on warnings; every command that checks a document takes it. |
| `--force` | Replace existing outputs. Without it any existing destination exits 1 before anything is written. |
| `--json` | Accepted for scripts that pass it everywhere. Reports are always JSON; this is the default. |

## Fonts

The renderer's bundled open font pack (the office pack: Carlito, Intos for Aptos, the open families font schemes
select and the open replacements the font policy routes proprietary families to, with lazy faces) with the visual
substitution policy, plus the files from `--font-dir`. **System fonts are never loaded**, and nothing is downloaded.
Font substitutions are listed under `fonts.substitutions` in the report with their `compatibility` (`metric` or
`visual`). The PPTX keeps the font names the document chose.

Scripts beyond Latin, Greek and Cyrillic need the optional Noto script packages of the renderer
(`@expo-google-fonts/noto-sans-jp` and so on). Install the ones named in the `fonts/script-font-not-installed`
diagnostic next to the CLI; without them, text the loaded faces cannot draw is the error `render/missing-glyph`.

## Images and assets

Relative image paths and `file:` paths resolve against the document's folder (or `--asset-dir`). Only `.png`, `.jpg`,
`.jpeg`, `.gif`, `.webp` and `.svg` files whose content matches are read, and only inside that folder (symlinks are
resolved first), so a document cannot pull another file on the machine into an output. URLs are never fetched. For SVG
and PNG output, an unreadable image draws the renderer's placeholder with an `unresolved-asset` or `cli/asset-blocked`
warning. For PPTX it stops the export (`pptx/asset-unresolved`): opf-pptx would otherwise read the path itself. SVG
pictures in a PPTX get their PNG fallback from the CLI's own opf-render install (`svgRasterizer`), so they export
whichever way the packages were installed.

## Markdown and YAML

Two more groups of commands convert between a deck and text, with no renderer: they are core features (`@openpresentation/opf/markdown` and `@openpresentation/opf/yaml`) and need no optional peer.

```sh
opf from-md deck.md deck.opf.json            # Markdown in the OPF dialect to a validated deck
opf to-md deck.opf.json deck.md              # a deck as Markdown that reads back unchanged
opf from-yaml deck.opf.yaml deck.opf.json    # strict YAML to a validated deck (--aliases expands anchors)
opf to-yaml deck.opf.json deck.opf.yaml --schema-comment
opf validate deck.opf.yaml                   # every command that reads a deck reads .yaml and .yml files
opf edit deck.opf.json --patch changes.json --output deck.opf.yaml   # or --format yaml
opf validate - --input-format yaml < deck.txt
```

- `from-md` and `to-md` follow the Markdown dialect (YAML front matter, `---` between slides, `#` title, lists, tables, `chart`, `metric` and `timeline` fences, speaker notes): see [Markdown and outlines](markdown.md). `from-md --format yaml` or a `.yaml` output writes the deck as YAML.
- `from-yaml` and `to-yaml` read and write a deck as JSON-compatible YAML 1.2, with canonical key order and an optional `# yaml-language-server` line for editor validation: see [OPF as YAML](yaml.md). A file ending `.yaml` or `.yml` is read as YAML by every command; stdin and other names are JSON unless `--input-format yaml` is given. Commands that write a deck write YAML for an output ending `.yaml`/`.yml` or with `--format yaml`. A YAML syntax error exits 2 with the line and column (`opf validate` reports it as a `yaml/<rule>` finding and exits 1); commands that rewrite a YAML file do not preserve its comments and say so on stderr.
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

## Decisions (RR-27, vetoable)

- **Peers, not bundled.** opf-render and opf-pptx are optional peer dependencies loaded lazily. opf-pptx pulls the
  native `sharp` engine, opf-render `resvg`, `fontkit` and the font packs (about 135 MB installed); bundling them would
  turn a 1.6 MB, dependency-free CLI into one that cannot be installed offline or on a locked-down agent host, and
  validating or editing a document would pay for it. The tarball stays small and `dependencies` stays empty.
- **Reports are always JSON; `--json` is a no-op alias.** The CLI contract is JSON reports and JSON errors; a second
  text reporter would split every consumer.
- **No clock.** `--date` is explicit so a rerun tomorrow gives the same bytes.
- **Fonts are the bundled pack plus `--font-dir`.** Never system fonts (owner font policy).
- **Stored zip entries.** Deflate output differs between zlib builds, which would make archive hashes host-dependent.

## Follow-up (openpresentation.org)

The site's CLI and developer docs should gain a "Render, export and import" page from this file (install block,
the three commands, the report fields), and its quickstart should stop saying the CLI does not render. No public
support or progress status goes on the site (program invariant); the page documents commands, not coverage.
