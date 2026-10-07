---
type: changed
---
RR-20: the renderer's default golden baseline records the examples of core 0.14.0 (the core floor of this release), so the publish workflow's golden gate accepts the registry core. The corpus digest moves from `394c4ce7...` (126 decks, 805 slides) to `d414d352...` (127 decks, 807 slides): 13 slide hashes change and 2 slides are added, in 14 deck files, all from core's format-audit example work (FA) and the chart data fixes; no renderer change moves a pixel. The baseline equals core's reviewed `scripts/fixtures/opf-examples-png.fa-0-14.sha256.json`.
