---
type: fixed
packages: [cli]
---
RR-62: `opf render` and `opf export` take the format from `--out`'s extension with the rule `opf convert` uses: `opf render deck.opf.md --out deck.png` writes a PNG file instead of a folder named `deck.png` full of SVG files. An `--out` with another file extension, or one that disagrees with `--format`, is a usage error (exit 2).
