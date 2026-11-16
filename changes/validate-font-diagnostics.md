---
type: fixed
packages: [cli, opf]
---
`opf validate` reports the `fonts/script-font-not-installed` and `fonts/script-glyph-uncovered` warnings that `opf convert` and `opf doctor` report, instead of discarding them (`--ignore` drops them, `--only` skips them). The script-font message names the package at its pinned version and gives the global, project and npx install commands, not only `npm install -g` without a version.
