---
type: changed
packages: [opf, cli]
---
RR-62 (breaking, 0.x minor): core's `readDeck` and `writeDeck` are now `parse` and `stringify`. `parse(text, { filename?, format?, catalogs? })` returns the presentation and throws `OPFValidationError` on a syntax, schema or reference error (findings located by line and column); `validate(text)` still returns the full report. `stringify(deck, { format? | filename? })` returns the text. `@openpresentation/opf/deck` exports `parse`, `stringify`, `deckFormatOf` and `DECK_FORMATS`.
