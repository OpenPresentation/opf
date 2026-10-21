---
type: changed
---
FA-33 (needs core with FA-33; no renderer code or pixel changes): layout records are one `direction` plus an ordered, nestable `regions` list instead of the `areas` grid with `columns`, `rows` and a `regions` map. The renderer reads core's composed geometry as before, so every slide draws identically and no slide hash moves (the template baseline's `source.sha256` records the new Gallery 5 record digest, see `test/golden/notes/FA-33.md`); the README describes the new record and the stale 0.19 template fixture, which only tested the old format, is removed.
