---
type: fixed
packages: [opf, cli]
---
`opf create` writes a deck that validates clean. The starter deck carries `language` (`en-US`, or `--language <tag>`), so the first `opf validate` no longer reports `opf/missing-language`. `opf create --example <slug>` copies the image files the example names (for `header-footer-logo-set`, `assets/logo-dark.svg` and four more) next to the new deck, lists them in the report's `outputs`, and refuses to overwrite an existing file unless `--force`; core now publishes those files under `dist/example-files/`. The `cli/asset-missing` hint no longer says `opf convert` stops: convert draws a placeholder and exits 0, and stops before writing anything only with `--fail-on warning`.
