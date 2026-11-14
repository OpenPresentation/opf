---
type: fixed
packages: [cli, render]
---
`opf doctor <deck>` runs the script-font check `opf convert` runs: the Noto script packages the deck's text needs that are not installed are listed with their versions (`scriptFonts`, `missing`, the one `install` command and `fonts/script-font-not-installed` findings), and the drawn formats are no longer `ready` while they are missing (for example a deck with an Arabic slide and only the Latin fonts installed); without a deck, doctor says nothing about a deck's scripts. The renderer's `font-unavailable` error for a script font (a slide with its own Noto font scheme) now names the package and version to install instead of "load the 'scripts' font pack", and its `script-font-not-installed` diagnostics carry `version`. The diagrams guide now says what `opf validate` reports for a diagram with and without the renderer installed.
