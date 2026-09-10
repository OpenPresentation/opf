# Shared metric integration — source checkpoint

Continue `codex/shared-metric-integration-20260910`. The standalone primitive merged in [core PR #58](https://github.com/OpenPresentation/opf/pull/58) as `5cfc944ee7709b54bc2d1e7192cd86b7a52d6cb7`, tree-identical to reviewed `d484a32a910cd9f0c729bcb9e5dc57f1e1cdfaa6`. Complete coordinator `34461397322`, core `34461397297`, Windows/macOS CLI `34461397393` and Bugbot pass. This branch is the next, separately reviewable increment. No package version, release-plan library ref, registry installation or public deployment is advanced by this source checkpoint.

## Core composition and pagination

Composition now measures every metric part while evaluating candidates and again against the final rounded accepted cell. `item.metricLayout` carries that result; compatibility `item.text` and `item.textStyle` alias its value. `grid-score-v4` adds all metric font reductions and charges overflow once per failing metric leaf. Explicit rows/columns/weights/regions and strict ancestor policies remain authoritative. Metric no longer appears in this branch's advance-model `unmeasuredPayloads`; that does not certify renderer/editor/native integration or glyph-outline bounds.

Pagination's existing atomic-payload path now sees complete metric diagnostics. It preserves numeric zero, scalar/object shape and all metadata, persists the selected readability floor, and rejects irreducible metadata all-or-nothing, including empty values after earlier content. No implicit metric splitting or content editing was added.

All 464 core tests and existing composition/nesting, pagination, data, rich-text and list preservation suites pass locally on Windows Node 20.20.2 and 24.20.0. Workspace typecheck and Node 24 CLI checks also pass: 11 unit tests and 69 command checks; Windows file-symlink rejection remains explicitly skipped when privileges are unavailable and covered by Unix CI. Six new tests cover rounded geometry/value aliases, explanation measurement counts, full metadata scoring, strict inherited field paths, explicit placement/weights, and atomic pagination/source types. The initial run exposed obsolete score-version/coverage assertions; those contracts were updated without changing quote/code algorithms. A dense-label fixture was adjusted from 70 to 81 repetitions because the former still fitted both arrangements and therefore did not test overflow selection.

## Prepared repository map

Use GitHub repositories/branches rather than local install artifacts as checkpoints. Fresh sibling clones were prepared for the integration, without altering previous release-verification checkouts:

| Repository | Starting checkpoint | Integration state |
| --- | --- | --- |
| OpenPresentation/opf | reviewed PR #58 source | This branch; core source/tests above |
| OpenPresentation/opf-render | `f4a1b8e1324cbc182b98d43f16528594c8006f86` | Clean source; renderer integration remains to implement |
| OpenPresentation/opf-pptx | `f421c91b7b127c7eeab788acdc0c51969402e057` | Clean source; export/provenance/reimport remains to implement |
| OpenPresentation/opf-editor | `1b05f8ba97f9617b25b1a9d18ac05648419318c9` | Clean source including mobile example labels; integration remains to implement |

Downstream branch name is also `codex/shared-metric-integration-20260910` when implementation begins. Core dependencies were installed with the frozen pnpm 10.33.2 lockfile; downstream npm lockfiles were installed unchanged under Node 24/npm 11.16 with lifecycle scripts disabled. These preparation installs are not candidate or final-registry fidelity evidence.

## Remaining gates before release preparation

1. Audit explicit content alignment through the shared metric API and renderer/export callers. Accepted geometry must honor supported user alignment consistently; do not independently center or refit each field after acceptance.
2. Replace renderer/PPTX's legacy independent metric formulas and truthy metadata joins with accepted `metricLayout`. Preserve scalar paths, zero, literal text and empty-value selection boxes. Reject unrepresentable XML characters explicitly. Consumers must use exact resolved styles and line/tab positions, including the fixed single-line inline search.
3. Implement guarded native metric grouping and reimport. Original scalar/field types are recoverable when native text is unchanged; native edits take precedence. Define changed numeric fields and trend enums explicitly, retaining visible native content with diagnostics when it cannot form a valid metric. Never silently resurrect old tagged text or drop ambiguous shapes. Existing code shape-tag helpers are a useful pattern, not proof that metric behavior already works.
4. Extend editor traces, selection and text/value controls to metric parts. Existing `parseCanvasValue` can validate finite numeric edits and preserve CRLF around string edits; verify the actual canvas paths, no-op, cancellation, validation failure, undo/redo and source changes at wide/portrait viewports.
5. Run coordinated source and installed-candidate checks, actual offline browser author/import/edit/export/reimport, and real PowerPoint edit/save/reopen/reimport and raster observations. Preserve the separate glyph, measurement, source and native-fidelity classifications. Only after review and complete checks prepare versions, dependency-ordered publication, new immutable CI refs, fresh registry gates and all three site adoptions.

The primitive's prior model/browser reports remain a source-bound historical checkpoint; regenerate integration evidence rather than relabelling them as integrated or published-runtime results. The full deterministic repair/Auto arrange, chart/timeline, font/fallback and missing native-platform objective stays open.
