# RR54 archive review history

`scripts/review-rr54-archives.mjs` produces a review candidate, never promotes
`test/fixtures/rr-54-unchanged.json`. The exact bare caller remains
`toPptx(structuredClone(entry.deck))`, with options omitted and no registered
catalog. Archive hashes, raw ZIP comparisons, baseline assertions and applicable
native-slide subdigests are unchanged.

Each completed review appends `source.rr54ArchiveReviews`: exact baseline export
reference, actual baseline build and candidate heads, source tree objects,
fixture/reviewer/helper hashes, export caller and review evidence directory.
The metadata describes review generation; it does not assert native rendering,
workbook parity, approval or publication.

Only changed entries append their actual current hash/size/part count and
applicable native-slide digest to `rr54ArchivePrevious`. Its `reviewIndex`
identifies the new source review record. Unchanged entries remain entirely
identical. Repeated reviews append the then-current lock, preserving every
earlier record. Legacy `rr105033Previous`, `rr105033ArchiveReview` and all other
source/history fields remain intact.

The pure candidate constructor validates complete report/fixture coverage,
baseline locks, unchanged rows, applicable candidate native digests and history
array types. It does not serialize archives, normalize hashes or write files.
The coordinator still reviews raw parts and promotes generated fixture bytes
in a separate source change.
