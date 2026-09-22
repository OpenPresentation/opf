# Native font inventory: read-only observation and corrected parent parsing

This bundle preserves one bounded Microsoft PowerPoint read-only inventory attempt and an independent offline audit. The child worker completed in 1.369 seconds with exit code 0, confirmed one close of the exact owned presentation, observed all four expected current text styles, and left its input bytes unchanged. The attempt made no edit, save, reopen, export, or embedding operation.

The raw parent result remains a failure. `attempt/supervisor.json` reports `fontCleanupConfirmed`, `lifecycleComplete`, and `contentGatePassed` as false because Windows PowerShell 5.1 pipeline assignment wrapped the root JSON array from `font-registration.json` as one element containing the four decoded rows. The original raw report, supervisor report, registration JSON, stages, request, progress, worker outcome, stdout, and stderr are preserved byte for byte. `audit/parser-repro.json` and the root diagnosis reproduce that parser behavior without Office.

`audit/report-v2.json` applies the corrected decode-then-wrap interpretation offline. It derives cleanup, lifecycle, and content success only: four registration rows each say `added: 1` and `removed: true`; the worker recorded 70 paired COM stages, one exact owned close, and four matching current text ranges. It computes and validates 42 input hash records from the request structure instead of assuming that count.

The native font allowlist still fails. PowerPoint reported `Carlito` and unexpected `Aptos`, both with `Embedded: 0` and `Embeddable: -1`. Therefore `embeddingAuthorized` remains false. These are application-reported attributes; they do not prove physical font identity, glyph provenance, substitution cause, or embedded font payloads.

The exact source deck and OPF source are included. The generator, corrected generation record, registry lock, helper scripts, fixture lineage, and OFL license bind their provenance. Font programs are deliberately absent; `OMITTED.json` records each excluded TTF by size and SHA-256. The source PPTX itself contains no `ppt/fonts` entries and no embedded font programs.

The `future-worker02` directory preserves the reviewed parent parser correction and offline pure controls. It was never run against Office and is not evidence from the native attempt. No retry was made because the observed Aptos entry already fails the native font allowlist.

Run `python verify.py` from this directory for a standard-library-only audit. It does not invoke Office, UI automation, font APIs, or the future worker.

## Exact observed content

| Start | Length | Text | Family | Size | Bold | Italic |
| ---: | ---: | --- | --- | ---: | ---: | ---: |
| 1 | 8 | `Regular ` | Carlito | 18 | 0 | 0 |
| 9 | 5 | `Bold ` | Carlito | 20 | -1 | 0 |
| 14 | 7 | `Italic ` | Carlito | 22 | 0 | -1 |
| 21 | 10 | `BoldItalic` | Carlito | 24 | -1 | -1 |

## Scope limits

This evidence establishes a successful owned, read-only PowerPoint observation followed by an offline correction of one parent JSON-array parsing defect. It does not establish font embedding, physical font identity, per-glyph identity, substitution cause, edit/save/reopen fidelity, renderer fidelity, PDF behavior, or installation side effects. The allowlist result is a failure, not a warning or a pass.
