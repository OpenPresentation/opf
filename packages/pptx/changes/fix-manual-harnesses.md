---
type: fixed
---
Tests: the manual harnesses `test/openxml/generate.mjs` and `test/native-furniture-fixtures.mjs` run again on 0.18 (they pass `catalogs: [defaultCatalog]`, expect `notesMasterIdLst` before `sldIdLst`, and read the slide `text` shorthand on import), and `npm test` now runs the Open XML generator from source (`test/manual-harness-smoke.mjs`) and reads its output back as XML so it cannot go stale unnoticed (#222).
