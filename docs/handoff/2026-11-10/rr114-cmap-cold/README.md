# RR114 cmap cold-trial evidence

NEVER MERGE. The actual root-owned six-child trial is complete and passed. This branch only preserves its results; it changes no product/runtime source and repeats no experiment. See [RESULTS.md](RESULTS.md) for exact means, ranges, CPU/memory data and limits.

First-use means were whole 3.461 s, old demand 3.735 s and candidate 3.417 s, with only two fresh processes per arm. One whole control was faster than both candidate samples, so the supported interpretation is rough parity rather than a universal or statistically established win. The historical 13.6% demand penalty remains unchanged historical evidence.

Run offline with Node 24 and no installed dependencies:

    node docs/handoff/2026-11-10/rr114-cmap-cold/verify.mjs

The verifier checks 46 original raw records / 3,818,369 bytes in raw.json.gz, all six child reports and terminals, complete source/dependency before/after identities, 216 retained final digest entries plus the actual 648 guarded-output outcomes, exact driver derivation and every reported statistic. It never executes archived code. All measured run/case/input/derivation files remain byte-exact under scoped -text attributes. No font binaries, credentials, private decks, native acceptance, registry acceptance, release or deployment are included.

Publication remains held for root review.

Metadata-only syntax/verifier checks passed. The first whitespace check refused CR-at-EOL in newly written PowerShell metadata receipts; their exact originals and refusal are retained in checks-original.json.gz. Direct checks/ files are labelled CRLF-to-LF display copies and then pass whitespace inspection. Measured drivers, raw trial reports and raw.json.gz were never normalized or rerun. No install/build/mapped product suite was repeated.
