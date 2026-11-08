# RR-20: preserve reviewer history

The 21-deck RR54 review command hardcoded 0.33 metadata and overwrote existing
`rr105033Previous` and `source.rr105033ArchiveReview` during a later review.
The completed 0.34 raw archive evidence is preserved unchanged on evidence-only
branch `5e89a184ffc8a38539f5fb5e573f403066bcca17`; its original generated JSON
remains an explicit historical failure of metadata construction, not accepted
0.34 provenance.

Vetoable decision, accepted by the coordinator: use append-only version-neutral
`source.rr54ArchiveReviews` and changed-entry `rr54ArchivePrevious` arrays.
Preserve every legacy source/history field. New previous-lock entries refer to
their source review by `reviewIndex`. Unchanged entries receive no extra history.

The extracted pure constructor validates the complete actual fixture/report,
baseline hashes/sizes/counts, unchanged-row consistency, applicable native
subdigests, source/tool evidence and array histories before producing a clone.
The existing command uses it; its export caller, options, literal archive hashes,
raw part comparisons, baseline assertions and fixture write location are
unchanged. There is no promotion, new release claim, consumer/approval flag,
normalization or runtime drawing change.

Actual 21-fixture controls cover legacy 0.33 preservation, all unrelated fields,
changed-only history, a subsequent review appending its actual latest lock,
native digest continuity, malformed report/history refusal and actual command
routing. Initial controls pass. The required mapped check and a corrected 0.34
candidate constructed from already sealed reports/bytes will be archived before
the final push. No archive serialization rerun is needed for that construction.
