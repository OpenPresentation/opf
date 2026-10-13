# RR-20: array areas and design defaults

Qualification uses core `8f70cf1b52dc4ca4eb246a6f9d065b1403edbf31`, gallery
`146e477196405fe7d2283008f6fad34c12742599`, and renderer source
`7ce5c43c2c340f67920ebada7e48cad2e7f8bb9e`.

The official [dry run](https://github.com/OpenPresentation/opf-render/actions/runs/38303250315)
reproduced unchanged main before generating candidates in the digest-pinned
Playwright image. Its manifest preserves all 807 example keys and the reviewed
495 template keys. Historical baseline files are retained. The three removed
template keys are the previously paginated FAQ-3-long pages: the unchanged
authored content now fits, so that fixture no longer enters the overflow corpus.
See `docs/evidence/rr20-array-areas/golden-keyset-review.json`.

Compared with the historical manifests, 586 example renders and 409 template
renders change. The changes cover the array-based layout records, stronger list
defaults, content positioning, compact timeline labels, neutral chart/table
structure, numeric alignment and zero-bound magnitude axes. Comparison scale,
system-font policy, trace settings and exact-hash checks remain unchanged.

The supervisor checked the manifest keysets and every uploaded PNG against its
manifest hash, reviewed template contact sheets 0–9 and representative technical
grid, quote, timeline and table examples. A GPT-6.1 Sol reviewer inspected sheets
10–20. No unexpected regression was identified in that visual review.

These are regression fixtures, not a claim that every crowded slide is readable.
The unpaginated long timeline/table/code fixtures and the ten-item described FAQ
intentionally expose overflow and emit corresponding diagnostics. Timeline,
table and code paginated counterparts were reviewed as the usable output; the
described-FAQ feature fixture has no paginated companion. Do not present the
unpaginated stress captures as successful slide designs. Native PowerPoint
acceptance remains separate and deferred.

The official [write run](https://github.com/OpenPresentation/opf-render/actions/runs/38304214690)
committed only the new baseline files as `5a419108bdd25e9970a1e88badb2e4ad1c5f1931`.
Both committed manifests exactly equal the reviewed dry-run manifests. Core's
coordinated fixture is a serialization of this committed example baseline, not
a locally rendered replacement; the previous core fixture remains available
for published 0.19 registry qualification.
