---
type: changed
packages: [opf, cli]
---
RR-77 (breaking, no alias): slide file numbers are padded to the width of the largest number written, replacing the three-digit minimum. `convert(deck, "slides/deck.png")` and `opf convert deck.opf.md slides/deck.png` write `deck-1.png` to `deck-9.png` for a short deck, `deck-01.png` from ten slides and `deck-001.png` from a hundred; with `slides: "2,5"` / `--slides 2,5` the width comes from the largest slide selected (`deck-2.png`, `deck-5.png`). The in-memory file names (`convert(deck, { format })`, `Q4-Review-1.png`) and the `.zip` entry names follow the same rule. One selected slide, or a one-slide deck, is still written to the output name itself. `opf fill`'s `{n}` now pads through the same helper (no change in what it writes).
