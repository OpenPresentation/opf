---
type: added
packages: []
---
Repository only: format-coverage decks in the release qualification corpus (`scripts/native-acceptance/qualification/decks/coverage-*.opf.json`, 30 decks) use every key, enum value and alternative of the presentation schema and every default layout, so PowerPoint and Keynote open all of them; `pnpm check:format-coverage` fails when the schema gains a key or value that no deck uses, and an integration test validates, draws and exports every coverage deck.
