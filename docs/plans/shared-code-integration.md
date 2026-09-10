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

## Remaining integration gates

- Renderer `renderCode` still uses a fixed uppercase label, omits filename and independently fits/normalizes the body. Consume `item.codeLayout.parts`, exact source-line slices, accepted segment positions/styles and explicit geometric precision; preserve trace/source paths and reject unusable parts. Prove no code remeasurement after resolution and test actual loaded-font SVG, not only a constructed harness.
- Converter `addPayload` currently passes accepted quote layout only. Carry accepted code geometry through it, use literal native tabs with explicit stops derived from the accepted segments, and preserve filename/language/body text without an independent fit. Verify readable sizes, blank lines, warning/strict behavior, portrait/scaled cells and actual native output.
- Import currently trims shape text, paragraph text and blank paragraphs in `src/index.js`. Preserve meaningful whitespace, avoid converting whitespace-only text to an unsupported placeholder, and assess how code-part/source-boundary provenance survives native edits. Soft wrapping must not become untracked source newlines; do not claim exact code reconstruction from separate native line boxes without verifying that mapping.
- Editor preview/edit/undo, pagination policy/undo and actual exported/reimported code need offline browser E2E. Confirm metadata paths are editable and source offsets remain correct with tabs, wrapped text and CRLF.
- Run complete source/tarball/registry/browser checks with immutable candidate consumer refs. Review actual changed corpus rasters instead of updating baselines blindly. Native code edit/save/reopen/reimport, visual inspection and exact registry installations remain release gates. Keep published registry refs and public deployments unchanged until the coordinated release is available.

Complete this consumer milestone before advancing other internal payloads, bounded repair, Auto arrange and the full font/native-platform roadmap. No general unattended-quality or pixel-equivalence claim follows from schema validity, regression stability, accepted advance boxes or editability alone.
