---
type: fixed
---
Tests only: `test/script-corpora.mjs` (the FF-44 per-face shaping qualification against HarfBuzz) runs in `npm test`. It was excluded from the runner (`test/suites.json`) and no CI step ran it, so it went unnoticed that it failed after FF-45 added the emoji and math slots (`Zsye`, `Zmth`), which are symbol sets with no language corpus; they are now exempt by name. It stays out of the contract suite.
