# Exact archive review packets

Evidence only: never merge this branch or copy candidate hashes manually.

- [Handoff and precise limits](../../../handoff/2026-11-08/rr105-034-archive-review.md)
- [Receipt and every packed file hash](receipt.json)
- [All 524 raw-part dispositions](part-disposition.json)
- [Nine generated candidate, unchanged](nine-candidate-fixture.json)
- [21 generated candidate, unchanged; old 0.33 narrative is unaccepted](twenty-one-candidate-fixture.json)

`nine/*.zip` and `twenty-one-complete/*.zip` contain every complete baseline and
candidate PPTX, changed raw XML parts and nested-workbook comparisons. The
original maintained outputs/provenance are retained in a separate ZIP, as are
original build logs, first strict/resolver failures and exact producer tools.
`review-capture.mjs` and `review-parts.mjs` are the exact evidence-only scripts.
All producer exports used actual Node 24.20.0 and the selected built runtimes.
No Office, font registration, fixture promotion or raster golden update ran.
