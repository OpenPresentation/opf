---
type: changed
packages: [opf]
---
Layout harvest: a content card insets its payload by 24 reference px (was 12), at most a quarter of the card across and a tenth of its height down, so a short KPI tile keeps its room; cards in an anchored row share the row's height, so their bottom edges line up. Without a host text measurement, a monospace family (`monospace`, or a family named Mono, Courier, Consolas or Menlo) is measured at 0.6 em per character (`measureMonospaceText`), so a code line no longer runs past its panel in a preview drawn with Roboto Mono.
