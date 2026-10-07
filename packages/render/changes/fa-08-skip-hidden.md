---
type: added
---
FA-08: `renderSvg(deck, { skipHidden: true })` leaves out slides marked `hidden`, the sequence the player presents (the result is then shorter than the deck). The default is unchanged, one SVG per slide, and `renderSlideSvg` still renders any slide named by its index. The `opf render` and `opf export` CLI skips hidden slides itself and keeps them with `--include-hidden`.
