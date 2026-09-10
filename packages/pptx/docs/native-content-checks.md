# Bounded native tables, code and quotes

Use fresh generated directories and run one Office verifier at a time. Each hidden helper defaults to 45 seconds, with a maximum of 60. A timeout kills only that helper and does not establish Office cleanup. Preserve failures, inspect Office before further native work, and never automatically retry a blocked call. Workers reject already-open fixtures, close only presentations they opened, and never quit or kill Office.

Tables use one six-slide fixture per invocation:

```powershell
node test/native-table-colors.mjs generate artifacts/tables-new
powershell.exe -NoProfile -NonInteractive -File test/native-table-colors.ps1 -EvidenceDirectory artifacts/tables-new
node test/native-table-colors.mjs compare artifacts/tables-new
```

Tables require 72 original/reopened/edited native cell observations, exact source character colors and six actual body-cell edits. Original/reopened raster hashes must match. All current cell text must survive native save/reimport and two more export/import cycles. Those extra cycles do not certify formatting, geometry or native rendering of their outputs. Intentional low-contrast and translucent cases remain in the fixtures.

Code and quotes select exactly one wide or portrait deck per invocation:

```powershell
node test/native-code.mjs generate artifacts/code-new
powershell.exe -NoProfile -NonInteractive -File test/native-code.ps1 -EvidenceDirectory artifacts/code-new -Deck code-1280
node test/native-code.mjs compare-deck artifacts/code-new code-1280

node test/native-quote.mjs generate artifacts/quote-new
powershell.exe -NoProfile -NonInteractive -File test/native-quote.ps1 -EvidenceDirectory artifacts/quote-new -Deck quote-1280
node test/native-quote.mjs compare-deck artifacts/quote-new quote-1280
```

Repeat with `code-540` or `quote-540` only after understanding the previous result. Full `compare` requires both selected run records; `compare-deck` is explicitly partial. Raw worker logs/progress/failures/native records live under `runs/<deck>`. The generators fingerprint both shared lifecycle scripts. Local Courier New/Calibri reference bytes are hashed and used for measurement; no proprietary font bytes or outlines are copied into evidence, and the checks do not establish Office's physical font-file selection.

Code checks preserve exact code source and filename/language metadata, including tabs, blank lines, CR/LF/CRLF and native body/filename edits. Tab tolerance remains 0.02 points; character-bound tolerance remains 0.1 points. All measured outliers are collected and written before the comparison fails. Quote checks retain the 0.1-point character-bound and body/footer separation gates, compare native rasters descriptively, and require exact current body/footer text blocks in order and multiplicity plus actual native title edits. Character-bound checks are distinct from independent visible-ink containment.

On 2026-09-10, Node 20.20.2 and 24.20.0 both passed the table suite (978 native character-color observations and 54 slide imports per runtime) and code suite (24 slide imports per runtime; zero tab/character-bound outliers). Both completed the quote native calls with passing character bounds and separation, but the stronger import check found that all six portrait quote slides promote their first body line to `subtitle`. The text is present, but its role changes; the exact-block import gate correctly fails on both runtimes. Wide quotes pass this gate. Earlier footer-only comparisons missed the classification problem and remain preserved as weaker evidence. Quotes currently reimport as generic text blocks rather than semantic quote payloads even where their line roles pass. This harness change does not fix the importer or widen acceptance criteria.
