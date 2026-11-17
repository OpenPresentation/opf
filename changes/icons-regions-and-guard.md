---
type: fixed
packages: [opf, render, pptx]
---
Icons are drawn where the author asked for them whenever their chips cost no text size:
    - An `icon` on a list entry, metric or group inside a promoted region (`start`, `center+end`, ...) is now loaded, drawn and validated; before, the icon walk skipped region keys, so such icons were silently left out with no finding.
    - A slide whose full chips set a block smaller (a list in a small weighted column) now tries the compact chips, which keep the text size, and keeps every other rule it would keep without icons. Before, the size guard retried only the rules that had fired, so the chips were dropped, and the list could even be set a half step smaller than the same list without icons.
    - Where there is truly no room, `opf/icon-dropped` says what bounds the block (a `composition.weights` share, a region, or the slide) and its help names what to change.
