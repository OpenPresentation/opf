---
type: changed
---
RR-96 (core companion; colors only): the structural neutrals the export writes (card edges, table borders, chart gridlines and rules) come from core's scheme-derived `roles.border` (the text color mixed into the background) instead of a fixed slate, so decks whose scheme is not slate-based draw quieter or warmer lines, and a dark slide gets lines derived from its own map. Archives of decks with cards, tables or charts are byte-different (fixtures `rr-54-unchanged.json` and `chartex-fallback-main.json` re-pinned). Requires the unreleased core 0.23.0.
