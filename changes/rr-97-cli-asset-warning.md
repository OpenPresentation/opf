---
type: changed
packages: [opf, cli]
---
RR-97: with opf-pptx 0.24.1 or later, `opf convert deck.opf.json out.pptx` reports an image it cannot read (a missing file, a path outside the deck folder or `--asset-dir`, a file that is no image) as a `pptx/unresolved-asset` warning and writes the deck without that image, instead of stopping with a `pptx/asset-unresolved` error; `--fail-on warning` still rejects it before any file is written. Nothing changes in core code: the CLI's resolver (`forPptx`) still throws `asset-unresolved`, which opf-pptx now turns into the warning. `docs/cli.md` states both behaviors, and the CLI's files test follows the installed opf-pptx version.
