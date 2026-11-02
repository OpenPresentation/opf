---
type: changed
packages: [opf]
---
Layout harvest: in a region with an anchor other than `top`, a content card fills its whole cell and the anchor places the payload inside it, so a bottom-anchored row keeps full-height cards with the text at their foot; such a card starts half a gap below its cell (`CARD_FILL_SPACE`), clear of the heading, and cards in a row share one height and one top edge. A card insets its payload by a sixteenth of its shorter side, from the former 12 reference px up to 24 (`CARD_INSET`), and at most a tenth of its height down: full-height cards get 24 px and a small KPI tile keeps its room. Without a host text measurement, a monospace family (`monospace`, or a family named Mono, Courier, Consolas or Menlo) is measured at 0.6 em per character (`measureMonospaceText`), so a code line no longer runs past its panel in a preview drawn with Roboto Mono.
