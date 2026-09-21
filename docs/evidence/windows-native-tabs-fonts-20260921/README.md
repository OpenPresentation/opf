# Windows native tab and font checkpoint — 2026-09-21

This checkpoint records two bounded native controls on PowerPoint
16.0.20326.20158, Windows build 26200.9457. It follows the
[picture and furniture edits / notes controls](../windows-native-edits-20260921/README.md).
It does not complete native compatibility or alter the published package train.

| Evidence | Result | Remaining limit |
| --- | --- | --- |
| [Plain native tab control](tabs/README.md) | Final worker completes with exact owned cleanup, unchanged content and zero save/reopen numeric drift. Independent binary-double replay matches all stored metrics. | Tab-target maximum 0.022655487060546875pt and tab/literal maximum 0.022678375244140625pt exceed the unchanged 0.02pt gate. Mixed-size table behavior is outside this bundle. |
| [Four-face Carlito edit control](fonts/README.md) | Exact title/body and four font-size/style spans persist; observed bounds drift is zero, edited/reopened PNGs match, and both owned presentations close. All four owned registrations are removed. | Reported native properties do not identify each physical glyph font, rule out fallback/synthesis, or establish browser/native equality. Font embedding is explicitly disabled. |
| Font-owner failure and timeout controls | Eight successful temporary additions across two non-Office dummy controls are removed by the surviving parent. | A terminated helper never proves Office cleanup. |
| Current registry semantic import | Edited title/body survive as current canonical OPF content. | Explicit heading/text reflow diagnostics exclude formatting/geometry reconstruction. |

Original failures are retained, including the first tab worker's shape-name
error, later postprocessing and number-serialization limitations, initial
auditor/checker errors, and fixture-generation environment failures. Their raw
reports are never relabeled as successful runs. Separate correction and recovery
records state what they establish.

The tab harness is delivered by [PPTX PR 48](https://github.com/OpenPresentation/opf-pptx/pull/48).
The font harness and reproducible fixture generator are delivered by
[PPTX PR 49](https://github.com/OpenPresentation/opf-pptx/pull/49).
Run-local verifier/helper snapshots and hashes are authoritative for executed
code. The later fixture generator reproduces all six original source/font/license
payloads; its newer generation record was not an input to the earlier Office run.
Node 24 registry bindings, exact permitted Carlito hashes and OFL license identity
are recorded. Neither package manifests nor native family names bind all
transitive installed bytes or physical glyph usage.

The supervising agent inspected the complete native slide images described in
each child bundle. Longer furniture clipping belongs to the earlier checkpoint;
the finite font edit has no observed clipping. Native tolerance failures and
the separate 0.1px browser gate remain unchanged. No `p:hf` implementation,
restricted Aptos program, package publication or website deployment is included.

## Portable verification

Run `python verify.py` from any directory. Python's standard library verifies
the complete inventory and hashes, then invokes both child portable verifiers.
No Office, registry install, font registration or network request occurs.
Font programs, font-bearing SVG, PDFs, personal workspace screenshots and caches
are excluded. Fonts omitted from the raw input snapshots remain identified by
hash and size. Raw absolute host paths and CRLF bytes are deliberately preserved;
use the portable bundle-relative paths and manifests when relocating evidence.
