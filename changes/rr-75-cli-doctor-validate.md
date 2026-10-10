---
type: added
packages: [cli]
---
RR-75 (OPF 0.18): `opf doctor`, a multi-file `opf validate`, examples, and errors that state the fix.
    - **`opf doctor [deck]`** reports, per format (json, yaml, md, svg, png, pdf, pdf-raster, pptx, pptx-import), whether this install can write it and what it misses, and prints one command that installs it all. It loads nothing: it finds the packages where the engine looks (opf-render's fonts and converters from opf-render's install) and checks their versions. With a deck, a PDF needs sharp only when the deck has pictures. JSON by default, `--format text` for people. A conversion that misses a peer exits 2 with the same one command in `install` and in the message.
    - **Install commands match the package manager** in `npm_config_user_agent` (npm, pnpm, yarn, bun) and the way the CLI is installed (global, a project, or an npx run).
    - **`opf validate` takes several files, folders and `-`**: a folder's `*.opf.json`, `*.opf.yaml`, `*.opf.yml` and `*.opf.md`, sorted, skipping `node_modules` and dot folders. One input keeps its report (now with `command`, `ok`, `input` and `outputs`); several give `{ command, ok, files, counts }`. The exit status is the worst over every file. `--format github` prints `::error`/`::warning`/`::notice` workflow annotations with the file, line and column.
    - **`opf create --example <slug>`** copies one of core's bundled example decks, and **`opf catalog examples [slug]`** lists them (`opf catalogs` counts them).
    - **Errors that state the fix:** a missing or extra argument names it and prints the command's usage (no more "Incorrect arguments"); an unknown command, option, value, catalog, id, schema or example suggests the nearest one ("Did you mean --check?"); every command has its own `--help`, `-h` and `opf help <command>`; `--name=value` works for every value option.
