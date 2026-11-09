# RR-105 current preparation contract

The Office-free preparation tools now use the single reviewed package fixture at
`packages/pptx/test/fixtures/chartex-fallback-main.json` as their current archive authority.
The historical native fixture at `scripts/native-acceptance/fixtures/chartex-fallback-main.json`
is byte-identical to its authentic earlier witness and remains independently bound.
Neither a successful preparation nor the older native result certifies current native behavior.

## Cause and decisions (vetoable)

- RR105-CURRENT-ARCHIVE-AUTHORITY: load the current package fixture, never copy or compute new accepted hashes.
  Bind both repository-relative paths, SHA-256 values and source metadata in suite provenance, including
  the package fixture in `suiteRepository.files` even though it is outside the tooling directory.
  A different consumer must reproduce the strict current lock; historical hashes are not alternate acceptance.
- RR105-CURRENT-CHART-MODES: current LH-175 multi-series Pareto is clustered columns in all three modes,
  with all three North/South/West series and exact `chart-data-adapted/chart-fallback` diagnostics.
  LH-60 nonplace world categories also remain columns; the Japanese country map stays a distinct case.
  Keep all 30 chart inputs positive. With 28 primary inputs and the six-slide table input, the complete
  default preparation contains 59 positive cases; the old 58-case witness remains historical.
- RR105-PREPARATION-ONLY: no native recertification, registry qualification, worker limit change,
  archive promotion, product chart change or schema change is part of this repair.

## Preserved failed attempt and satisfied precondition

Exact current package source is `b623a3674037f29d68496e96a3f5b6da55d73470`.
The original unchanged preparation produced 28 primary cases, then failed at treemap-category:
actual `c844c8abe2f223546f9a735e27f16cb0e036dd7c519b01992e02df5c22639079`
versus historical native `ae8fe51d4d66b62a99d93bbb6023eb6f6c6f35cc4d4f6e3fefae2ea741b7e2a1`.
Its unsealed output has no suite.json and remains unchanged. The old witness is authentic: later
published PPTX 0.20.2 qualification reproduced its nine locks. No old-ae8 archive bytes were recovered,
so no old-versus-current part-diff or single-cause metadata claim is made.

Before this patch, one independent current-consumer nine-case diagnostic reproduced every current
archive hash, size, ordered diagnostic, layout/tag count, ZIP part and embedded workbook against both
the canonical package fixture and the reviewed current packet
[594863](https://github.com/OpenPresentation/opf/tree/594863c06e7c442c6784226fe30d9357e290ac07/docs/handoff/2026-11-09/rr20-current-nine-archive-review).
The separate immutable [preparation evidence](https://github.com/OpenPresentation/opf/tree/b721182431f1dd5961c1c3f1906ffcad94a3fdf7/docs/handoff/2026-11-09/native-current-preparation-b623)
retains the original failure, 22-deck/27-variant release corpus and all nine diagnostic receipts. NEVER MERGE that evidence branch.

## Checked semantics and boundaries

The preparation matrix keeps deterministic second exports, whole-archive locks, exact sizes,
ordered diagnostics, complete layout/tag counts and no AlternateContent in fallback mode.
Pareto and box fixtures have columns Quarter/North/South/West, three rows and three numeric series.
Classic box caches/workbook intentionally group rows under Quarter repeated three times;
OPF_DATA and full import independently restore authored Q1/Q2/Q3. All nine numeric values and
three series names are checked in classic and native box caches, workbook and import.
Pareto caches/workbook directly retain Q1/Q2/Q3. Japanese 国/値 and nonplace Region/Value world
sources retain their distinct rows, mode contracts and complete import data.

Focused controls passed 6/6, including an actual 30-archive matrix and mutations of series,
categories, values, chart direction, workbook values and native box caches. The first focused attempt
failed before exports because a require-only resolver was used for the import-only composition entry;
the tool now uses the installed public root exports. That setup failure is preserved.
Required mapped checks and fresh full preparation are pending at this source checkpoint.

The four seven-slide chart cases and six-slide table remain outside the generic three-slide guard;
preparation does not authorize executing them through that worker. PowerPoint remains held while
an existing process is open. Frozen exporter/importer/worker witnesses are untouched. Charts remain
on the current implementation; explicit reference-line schema implementation still awaits owner agreement.
