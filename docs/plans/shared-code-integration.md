# Code consumer integration checkpoint

This is an unreleased work in progress on `codex/shared-code-integration-20260909`. The core primitive merged in [PR #53](https://github.com/OpenPresentation/opf/pull/53) as `7c978f8b7ef0cc649d8452f8f1b829f36a5ae6e3`, tree-identical to reviewed `f90f7c5152d4075a2c184959164df655ba05fa19`. Full coordinator `34433911033`, core `34433911144`, Windows/macOS CLI `34433911057` and Bugbot pass on that reviewed primitive. The integration changes below need their own final coordinated review. Published versions remain core 0.8.0, CLI 0.6.0, renderer/PPTX 0.6.0 and editor 0.5.0; never republish them.

Fetch these GitHub checkpoints for the consumer work:

| Repository | Base commit |
| --- | --- |
| OpenPresentation/opf | `7c978f8b7ef0cc649d8452f8f1b829f36a5ae6e3` |
| OpenPresentation/opf-render | `7fe9905ad2d8a224efeef51b4a22d0aff0c413fe` |
| OpenPresentation/opf-pptx | `898e3c27919a2488e1e3d384168d6b25aae4bd5c` |
| OpenPresentation/opf-editor | `dba5fe5e5580a4172c052132c4db5851d1decc4c` |

Core composition now accounts for every filename/language/body part in candidate scores and diagnostics, with one overflow charge per leaf. `grid-score-v3` identifies the changed behavior. Final `item.codeLayout` uses rounded accepted cells; compatibility `item.text`/`textStyle` alias the body. Strict ancestor matching already understands internal source paths. Explicit modes, weights and source values stay unchanged. Explanations add no measurements.

Pagination already sliced code at grapheme boundaries and repeated metadata. The new composition measurements make it detect irreducible filenames/language labels as well as body overflow. Tests verify exact code-byte reassembly, CRLF, indentation, tabs, blank/final lines, metadata, contiguous UTF-16 body mappings, repeated floors and all-or-nothing rejection even for empty code after earlier content. Local Node 20.20.2 and 24.20.0 pass all 448 core tests plus composition, nested, pagination, data, rich-text and list suites; core/CLI declaration checks pass.

## Browser correction and native observations

The standalone browser harness found two distinct issues. SVG CSS-only `tab-size: 4` does not position the tabs as measured; explicit source-preserving text/tab segments do. Linux Chromium's default hinting also rounds glyph advances. The harness now requests `text-rendering="geometricPrecision"`, retaining the original 0.1-reference-pixel tolerance. Actual Edge 152 and [Linux Chromium 153 evidence](../evidence/shared-code-browser-linux-2026-09-09.json) pass with identical font/model fingerprints. The rendering hint must be carried into actual SVG output and rechecked there; the controlled harness is not OPF renderer integration.

The [native probe report](../evidence/shared-code-native-2026-09-09.json) binds candidate runtime/source, exact registry package integrities/vendor, local Courier New regular/bold hashes, generated/saved/edited files, Windows build and PowerPoint executable/version. It uses local proprietary reference fonts without copying or embedding their bytes. Eight single-line cases test leading/trailing/repeated tabs, significant spaces and case-sensitive filenames. PowerPoint preserves every text byte and all eight edits through save/reopen. Text immediately after tabs begins at the accepted stop within 0.010544 point against a 0.02-point tolerance. Text-width drift reaches 0.78629 point and is recorded separately; this is not glyph/raster equivalence, a Cousine substitution comparison or integrated OPF export.

The actual registry importer returns schema-valid documents but loses leading/trailing whitespace in original, native-saved and native-edited probes. A whitespace-only shape becomes `PowerPoint shape: code-probe`. Internal tabs/spaces survive in other cases. Successful native preservation therefore does not imply successful OPF reimport. The probe reports the loss rather than asserting it is acceptable future behavior.

Reproduce from a built candidate core checkout with a fresh ordinary registry consumer using the published package set in `release-plan.json`:

```powershell
node scripts/probe-code-native.mjs generate <registry-consumer> artifacts/code-native
& scripts/probe-code-native.ps1 -EvidenceDirectory artifacts/code-native
node scripts/probe-code-native.mjs compare <registry-consumer> artifacts/code-native
```

The PowerShell helper opens only its own generated fixtures and leaves PowerPoint and unrelated user decks open. `compare` rejects stale source/runtime or changed native files; it validates imports and records preservation differences without pretending they passed a fidelity gate. Node 20/24 comparisons agree. No OS settings or new software permissions were needed.

## Consumer implementation and local verification

All four repositories use branch `codex/shared-code-integration-20260909`. Fetch core implementation `8d11fd650eb14fad3473b918713d9caa95321b83`, renderer `343ffea275e2eff478fc6a355551379897b748df`, converter `860e9476520659bf65822c945bf96b253cbe6c01` and editor `52e540b83e441892fd928e9f159bffbb29da5653`. These are unpublished source checkpoints, not registry versions.

Renderer consumes exact accepted source ranges, segment positions, part styles and geometric precision. Traced groups expose editable metadata/body boxes, including empty body and shorthand source; generated labels do not masquerade as editable content. The default code layout now uses automatic composition consistently with core/PPTX; an explicitly chosen `code-1x` preset retains its slots. Complete Node 20/24 renderer suites and actual-font browser checks pass. Every changed raster was reproduced against registry renderer 0.6.0: 43 code changes were visually reviewed in eight paired sheets, including full-resolution checks of all three technical cases and one representative gallery slide. The other 762 hashes remain unchanged. Sparse panels, theme placeholders, estimated corpus measurement and broad typography quality remain separate gaps.

Converter writes one editable shape per accepted line, including blank lines, with literal native tabs and explicit accepted stops. [The source-mapping protocol](https://github.com/OpenPresentation/opf-pptx/blob/860e9476520659bf65822c945bf96b253cbe6c01/docs/code-roundtrip.md) uses standard shape customer-data tags with uppercase hex JSON to preserve case through PowerPoint's Tags API. Complete unique groups recover source and metadata; current native text wins, while original hard boundaries and soft-wrap distinctions survive. Missing, duplicate, damaged or ambiguously tagged shapes, edited generated labels and edited panels fall back to visible native shapes with diagnostics. Generic native text now preserves whitespace, blank paragraphs, run/field ordering and explicit line breaks. Grouped text is retained with an explicit transform/reflow limitation.

Editor tests execute real pointer/keyboard source and filename edits, CRLF no-op/change preservation, literal Tab/cancel, rich-toolbar exclusion, pagination/readability policy undo/redo, browser export and undoable exact code/metadata reimport offline. Its active source textarea uses native browser editing; do not claim its caret geometry is the accepted SVG layout. Committed preview uses the shared SVG geometry. Imported native font scheme and formatting still need reflow review.

[Portable evidence](../evidence/shared-code-consumers/summary.json) records 28 passing existing/targeted consumer script runs plus four new actual code-browser reports across Node 20.20.2/24.20.0. Renderer, PPTX and editor complete suites and existing browser/playground workflows pass on both runtimes. Candidate packages were linked from source; no lockfiles or public versions changed. A legacy typography test now reads nested SVG tspans and retains its original count gate, verifying 36 payload lines.

Real PowerPoint `16.0.20326.20132` on Windows `26200.9445` passes eight wide/portrait slides, shape tags, editable text and save/reopen. All 24 original/saved/edited imports preserve exact code objects, metadata, mixed CR/LF/CRLF, blank/final lines and soft wraps. Four native text-after-tab targets are within 0.007031 point against a 0.02-point gate. Comparisons pass on Node 20/24. Actual OPF exporter output and corresponding resvg images use the same local Courier New regular/bold bytes; representative wide/portrait images were inspected. Source/runtime/font/executable/input/output hashes are recorded. No proprietary font bytes were copied or embedded, and no unrelated presentations were closed.

Reproduce in the converter checkout using `node test/native-code.mjs generate artifacts/native-code`, `& test/native-code.ps1 -EvidenceDirectory artifacts/native-code`, then `node test/native-code.mjs compare artifacts/native-code`. The importer reports that positioning, formatting, font theme and readability policy are not reconstructed. This scope is separate from the historical published-import defect above and does not establish native raster or arbitrary Office round-trip equivalence.

## Remaining integration gates

- Add code source/metadata/guard tests and actual editor/browser workflows to fresh installed-tarball verification. Keep historical registry harnesses pinned to their published implementation; no new code version is released yet.
- Advance coordinated source CI to the exact consumer commits above and the reviewed code raster manifest; complete the full Node 20/24 source/tarball/registry matrices and review before opening/merging release PRs.
- Prepare versions and publish core/CLI and consumers in dependency order, then refresh registry lockfiles, verify exact registry bytes/provenance and update the core published release plan/immutable refs.
- Update public deployments only after the new complete published set passes its public workflows. Continue the full repair, Auto arrange, other payload internals and font/native-platform objective.

Complete this consumer milestone before advancing other internal payloads, bounded repair, Auto arrange and the full font/native-platform roadmap. No general unattended-quality or pixel-equivalence claim follows from schema validity, regression stability, accepted advance boxes or editability alone.
