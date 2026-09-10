# Shared metric layout — standalone candidate

Branch `codex/shared-metric-layout-20260910`, [core PR #58](https://github.com/OpenPresentation/opf/pull/58), starts from core PR #57's merged `115f3e915b9b36f0518e55ac6a4f8014ac7114cc`. Its initial `4ec5795a12a71a3cd427ba69a0add099bd896dea` records the [actual published defects](../evidence/metric-layout-gap-2026-09-10.node24.json): omitted unit/zero-delta/trend, a label below the selected floor, and strict composition accepting content that render/export later reject. The complete published package set and all three public deployments remain intact.

This milestone adds `layoutMetric` as a standalone shared primitive. [API rules](../dynamic-composition.md#metric-internals-unreleased-standalone-api) document exact scalar/field paths, source types and ranges, empty fields, styles, inline/stacked candidates, compact spacing, bounded fitting and strict failures. It introduces no schema, dependency, runtime network or provider requirement. It does not remove metric from `unmeasuredPayloads`, change composition scoring/pagination, or claim to fix the published consumers. No version bump or publication is warranted yet.

## Verification

Windows Node 20.20.2 and 24.20.0 pass all 457 core tests plus the existing composition/nesting, pagination, data, rich-text and list preservation suites. Nine focused metric tests cover zero/scalar types, exact text/ranges, alignment, long metadata, font-style resolution, scaled floors, empty fields, grapheme/CRLF/tab preservation, invalid measurements/dimensions and bounded deterministic failure. Root and focused public TypeScript declarations compile. Workspace typecheck and lint pass (existing lint warnings remain).

The [geometry report](../evidence/shared-metric-layout-2026-09-10.json) is byte-identical across both runtimes. It binds the candidate source/runtime, all 33 installed font files and 535 published core/renderer files checked against prior verified registry archives. The registry renderer supplies outer cells and font advances only. Sixty schema-valid scenarios cover Carlito, Caladea and Roboto on 1280×720 and 540×960 canvases: 50 fit, six irreducible labels reject strictly, and four expected font-coverage failures reject without altering source. Carlito lacks U+0301 combining acute in these bytes; Caladea lacks U+03A9 Ω. Composed/decomposed Unicode is never silently normalized to evade those gaps.

The [controlled SVG report](../evidence/shared-metric-browser-2026-09-10.json) is also byte-identical across both runtimes in Edge 152.0.4191.66. All 50 accepted cases load exact resolved font faces offline, preserve every displayed source line and match advances/segment starts/ends within 0.1 reference pixel under `geometricPrecision`. The harness records 16 Canvas ink overhangs up to one reference pixel beyond part advances, no inter-part ink collisions, and separate SVG font boxes. These measurements do not establish glyph-outline containment or pixel equivalence. The two representative rasters were inspected, exposing and correcting an excessive percentage gap between value and metadata. These are test-harness SVG images, not integrated OPF renderer output.

```sh
pnpm --filter @openpresentation/opf test
node scripts/test-metric-layout-geometry.mjs <verified-registry-consumer> artifacts/metric-layout-geometry.json
node scripts/test-metric-layout-browser.mjs <verified-registry-consumer> artifacts/metric-layout-geometry.json artifacts/metric-layout-browser.json <renderer-checkout>
```

Use Node 20/24 without source aliases, loaders or `NODE_OPTIONS`. The actual registry consumer must match the preserved complete-set archive evidence. The renderer checkout supplies Playwright only. Coordinated CI now executes these separate candidate checks and preserves reports/rasters; complete Linux CI and review remain required before merge. The report intentionally distinguishes local candidate code from installed published runtime behavior.

## Next integration gates

1. Consume complete metric parts in candidate scoring and final composition against the exact rounded accepted cell. Preserve explicit modes/weights/regions and inherited strict floors. Only then update coverage and the score version. Keep `item.text` mapped to the value, even when metadata leads a trace.
2. Treat metric metadata and scalar types as atomic during explicit pagination unless a separately reviewed policy permits splitting. Reject irreducible content all-or-nothing, including empty values with metadata. Preserve existing document intent and mappings.
3. Make SVG and native PPTX reuse accepted field geometry, styles, literal text and segment positions. Add field source paths, zero handling, XML representability guards and explicit native grouping/reimport behavior. No source mutation, independent fit or silent omission.
4. Verify actual browser source/inline edits, numeric/type-safe edits, metadata, selection, cancel and undo/redo at wide and portrait viewports. Use real PowerPoint to open/edit/save/reopen and reimport generated metrics, measuring positions/font sizes and comparing representative rasters separately from source preservation.
5. Finish source/candidate tests and review, then prepare coordinated versions. Publish in dependency order, update immutable refs, rerun fresh registry/native tests, and adopt the set on all three sites. Do not republish existing versions.

The larger repair/Auto arrange, timeline/chart internals, richer font/glyph bounds, multilingual fallback and missing macOS PowerPoint/Keynote evidence remain explicit work in the [full objective](ecosystem-objective-2026-09-09.md).
