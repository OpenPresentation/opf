---
type: changed
packages: [opf]
---
RR-85 (composition geometry): metrics center horizontally within their allocated block by default, keeping the value/unit pair and metadata together. Explicit slide, deck, host, theme, layout and direct `layoutMetric` alignment overrides retain precedence; prose, lists and tables retain their existing defaults. Coordinate the dependent packages' minimum core version in the release train.
