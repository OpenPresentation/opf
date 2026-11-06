---
type: changed
packages: []
---
Adding an example deck no longer fails the build: the renderer's golden gate compares every slide of the decks its baseline records and reports a deck it has not recorded yet as new (and a deck that left `examples/` as removed) instead of failing on the corpus size and digest, and the core tests that asserted exactly 131 example decks now only check that the examples load. `docs/examples.md` has a short "Adding an example" section.
