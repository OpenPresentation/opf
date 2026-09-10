# Code consumer integration checkpoint

This is unreleased [PR #54](https://github.com/OpenPresentation/opf/pull/54) on `codex/shared-code-integration-20260909`. The core primitive merged in [PR #53](https://github.com/OpenPresentation/opf/pull/53) as `7c978f8b7ef0cc649d8452f8f1b829f36a5ae6e3`, tree-identical to reviewed `f90f7c5152d4075a2c184959164df655ba05fa19`. Full coordinator `34433911033`, core `34433911144`, Windows/macOS CLI `34433911057` and Bugbot pass on that reviewed primitive. The integration changes below need their own final coordinated review. Published versions remain core 0.8.0, CLI 0.6.0, renderer/PPTX 0.6.0 and editor 0.5.0; never republish them.

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

## Fresh installation and native verification

[Installed evidence](../evidence/shared-code-installed/summary.json) records fresh candidate packages built from core `9980ed4ddf87359dae1542fb6284f3ba6c3688ae` (runtime implementation `8d11fd650eb14fad3473b918713d9caa95321b83`) and the three exact consumer commits above. All four tarball hashes and installed runtime bytes match across Node 20.20.2/24.20.0. The local preview version labels are staging identities, not npm releases.

`scripts/test-installed-code.mjs`, invoked by `test:packed-ecosystem`, verifies contained ordinary installs, tarball/lock integrity, staged runtime hashes and actual browser bundle inputs. It runs 15 core source/layout/pagination tests, converter source/metadata guards, renderer measurements and the real offline editor/renderer workflows against installed public APIs. No source loader or linked runtime package is accepted. `scripts/test-installed-code-guards.mjs` tests changed bytes, wrong integrity, external modules and loader environment rejection and restores its generated artifacts. All seven existing installed browser suites and 69 CLI commands/global/npx-style local-pack installation also pass on both runtimes.

The complete Node 20 source/package command passes. The initial Node 24 command passed source stages and failed the new harness's CommonJS Playwright import; after correcting the harness, all remaining installed/tarball/browser/CLI/guard stages pass. A subsequent harness attempt exposed esbuild's empty disabled-module records; only zero-byte, import-free stubs are accepted, with every real browser input still verified inside installed modules. Full Linux CI remains required. Separate fresh published-registry ecosystem, seven browser and pinned fidelity suites pass on both runtimes; no candidate feature is attributed to those older releases.

The actual installed converter passes the Windows PowerPoint workflow again: eight slides, all 24 original/saved/edited imports, exact code/metadata and save/reopen. Both Node versions compare successfully. Four native text-after-tab targets stay within 0.007031 point (gate 0.02). Source and native wide/portrait PNGs were inspected; glyph appearance and baselines differ, so no raster-equivalence claim is made. Reproduce after the fresh candidate workflow:

```powershell
node scripts/prepare-installed-code-native.mjs
# Change to the verified consumer directory printed by that command.
node test/native-code.mjs generate artifacts/native-code
& test/native-code.ps1 -EvidenceDirectory artifacts/native-code
node test/native-code.mjs compare artifacts/native-code
```

Preparation verifies lock/runtime fingerprints before copying the exact consumer-native harness and records source/adapted script hashes. Use Windows PowerPoint only for this compatibility check; it is not a package dependency. Local Courier New bytes are neither redistributed nor embedded. Unrelated presentations remain open.

## Remaining integration gates

The format-boundary review found schema-valid XML-forbidden controls and unpaired UTF-16 surrogates were not handled safely. Renderer `b5a3722725338e8d964783e8b7f1f7b80ce28cd3` and converter `b4f4645cdaa2f5eff8a883f68533875d3b63f239` now reject them explicitly with `invalid-code-text`, the exact OPF field path and UTF-16 offset. The source document remains unchanged; the core schema and layout API are not tightened to an XML-specific character repertoire. Both engines pass 132 negative cases and accepted character boundaries on Node 20/24, including supplementary Unicode serialization without a glyph-coverage claim. The full Node 24 coordinated source/tarball/browser/CLI/guard command passes again. Renew the Node 20 and installed-native evidence before release. Earlier reports above retain their exact original source/runtime fingerprints.

The prior PR head `4f4a0b44584be945420f2b8d519f9417ee073e7d` passes coordinator `34440657844`, core `34440657756`, Windows/macOS CLI `34440657695` and Bugbot. The updated two consumer pins require their own renewed coordinated CI/review.

- Complete the full Linux Node 20/24 source/tarball/registry matrices and review with the new installed-code gates, exact consumer commits and reviewed code raster manifest now wired into coordinated CI. Keep historical registry harnesses pinned to their published implementation; no new code version is released yet.
- Prepare versions and publish core/CLI and consumers in dependency order, then refresh registry lockfiles, verify exact registry bytes/provenance and update the core published release plan/immutable refs.
- Update public deployments only after the new complete published set passes its public workflows. Continue the full repair, Auto arrange, other payload internals and font/native-platform objective.

Complete this consumer milestone before advancing other internal payloads, bounded repair, Auto arrange and the full font/native-platform roadmap. No general unattended-quality or pixel-equivalence claim follows from schema validity, regression stability, accepted advance boxes or editability alone.
