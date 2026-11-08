# Final 0.34 archive review: evidence only, never merge

This branch preserves the separate nine-deck ChartEx fallback and 21-deck RR54
archive reviews. It does not change or promote any fixture, release a package,
normalize hashes, adjust a golden/budget, or establish native acceptance.

The exact published 0.33 export baseline is
`26fd4de9cee7e57f9e0620eddcad2dcef04e00e3` in
`C:/opf-work/archive-baseline033`. The reviewed candidate is
`513156a982397eaa0033808215fbb86dd284745b` in
`C:/opf-work/integration-034`. Its fresh seven-package build was at `b124b1ad`;
the literal production/package/schema/lock/manifest diff through candidate 513
is empty. Original baseline setup/build and candidate build logs are retained.
Both producers were clean. All seven dist inventories and source trees were
sealed before and after every export and remained byte-identical. The
coordinator held integration writes until those seals closed.

The maintained nine reviewer reproduced all nine original hashes, sizes,
ordered diagnostics and layout/tag counts before candidate export. The
maintained 21 reviewer reproduced all 21 hashes, sizes, part counts and applicable
strict native-slide subdigests. An approved companion capture retained all 42
complete bare-export archives and asserted every hash and size against the
maintained 21 output. No extra export options, fonts or CLI defaults were added.
These API archive contracts are distinct from shipped-CLI/native qualification.

All 524 changed raw part instances have an explicit literal-byte disposition:

- Nine fallback decks: 516 instances. The four new catalog IDs are
  `inverted-pyramid`, `org-chart`, `hierarchy` and `venn`. Every existing native
  layout and tag is byte-identical after matching its ID, including the auto
  carrier where present. Only new carriers, filename/index moves, exact
  relationship targets, master registrations and content-type additions change.
  Eight decks have 38 to 42 layout parts; `world-category` has 37 to 41 because
  it has no auto carrier. Native slide XML, chart parts, fonts/text/data payloads
  and ordered diagnostics remain exact.
- RR54: 19 entire archives are byte-identical. `bar` changes one part, literally
  the category tick label position from `nextTo` to `low`, matching the accepted
  negative-horizontal-label correction. Its scale, data and other bytes remain
  exact. `pie` changes seven parts: the already reviewed LH-182 nested-ring
  adaptation pins the shared inner plot and adds one surface-color hole ellipse
  under the chart frame. Its marker tag, relation/content-type registration,
  `Paragraphs` metadata tally and native structure/style digests follow that
  shape. All other native slide XML, authored content/background and data remain
  exact. This is an explanation of the raw source delta, not new native proof.
- All 34 embedded XLSX archives and all 408 nested parts are literally identical.
  No worksheet values, formulas, styles, ranges, shared strings or workbook
  relationships changed. Full inventories include unchanged workbooks too.

The evidence-only assertion script reviews every changed part individually;
existing layouts are matched by semantic ID and then their original raw bytes
are compared directly. Accepted relationship/registration insertions and the
two bounded chart changes are asserted literally. No transformed or normalized
archive hash is used to make a lock pass. The first local review-script parse
failure and its corrected successful attempt are both retained; neither changed
producer bytes or export results.

The 21 reviewer has a known metadata limitation: its original generated
`source.rr105033ArchiveReview` still hardcodes the old 0.33 narrative and evidence
path. The generated JSON is preserved unchanged as raw output. That narrative is
not accepted for 0.34. The coordinator owns a separate reviewed promotion with
correct 0.34 provenance after accepting this evidence. Existing lock hashes must
not be edited manually.

Portable evidence is under
[`docs/evidence/rr105-034-archive-review`](../../../evidence/rr105-034-archive-review/receipt.json).
There are 30 manageable per-deck ZIP packets containing complete PPTX bytes,
all raw changed part bytes and inventories, plus separate unchanged original
maintained outputs, generated candidate JSON files, source/tool/build seals,
all original failures and a complete machine-readable part disposition.

The original strict PPTX failure is preserved from
`C:/opf-work/rr105-readonly-survey/artifacts/check-changed/tests_pptx.log`:
`chartex.mjs:433` stops at `treemap-category` (`d1e56048...` versus the old lock
`8434325b...`), leaving 251 tests unrun. Its separate native-contract log had
sparse-corpus `ENOENT` failures, not archive mismatches. The earlier nine-review
attempt's CJS resolver failure (`ERR_PACKAGE_PATH_NOT_EXPORTED` for composition)
is also retained; the maintained final ESM route succeeds. The preliminary RR54
receipt reproduced 21 baselines and found the same two changed entries. These
historical receipts do not replace the exact final-source review.

Next: coordinator review and separate fixture promotions; unchanged strict
archive tests and final combined CI afterward. Reuse native evidence only when
the relevant input PPTX bytes are exact. This branch is evidence only and must
never be merged.
