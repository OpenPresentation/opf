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
routing. Local controls and the coordinator's independent Node 24 controls pass.

The once-only mapped check took 572.3 seconds: nine build/root steps passed,
typecheck correctly skipped, and the PPTX leg stopped on unchanged
`keynote-registry-runtime.mjs:44` with Windows symlink `EPERM`. Its first 78 tests
passed, including the 45-child/43-case determinism matrix (280 seconds); 156
later tests were not run. The new pure test passed directly and independently
before that inherited earlier suite failure. No assertion was weakened or broad
test run repeated. All raw logs, including the independent coordinator log,
are preserved in the [construction/check packet](../../../evidence/rr20-archive-history/checks.json).

The corrected 0.34 candidate was constructed from the sealed 513 report and
original fixture, with zero archive serialization. All 21 current hash, size,
part-count and native-digest fields equal the accepted raw candidate. All
original source fields and all seven legacy 0.33 entry histories are preserved;
only `bar` and `pie` append their actual current previous lock. The new source
review distinguishes the original export-reviewer identity from the new pure
construction helper and binds evidence commit `5e89a184` and exact report hash.

The [corrected candidate](../../../evidence/rr20-archive-history/corrected-034-candidate-fixture.json)
has SHA-256
`d62b991a3772856d812296cf12582be2ede6850e39d644d3414ab39a89a06e27`.
The packet includes exact original fixture/report/evidence inputs and a portable
`reconstruct-candidate.mjs` that reproduces those JSON bytes without importing
an exporter. The original wrong-metadata candidate remains immutable on the
previous evidence branch. The coordinator owns source integration, fixture
promotion and final combined checks; this PR claims none of those outcomes.
