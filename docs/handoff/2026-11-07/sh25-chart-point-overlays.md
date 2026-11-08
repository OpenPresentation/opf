# SH-25 / #1113: chart data-point anchors

Work is on codex/sh-25-chart-point-overlays in the isolated short-path worktree C:/opf-work/sh25-chart-points. Fresh main d19c4bb6172b703d132ebba3fd006e4ec5cdf845 was normally merged forward to the coordinator-reviewed preparation67698fadd1b729526718e3d9e4f74909dd2e465e (codex/integration-034). Its exact SH20–23 rows are preserved. SH24 remains reserved by source #1153, not yet accepted; no status is invented here.

The optioned-doughnut source #1152 at e44c91d9612dbe1b89ec5497becb0bf141a449b6 is unreviewed and has not been merged. Its planned geometry contract is the existing layer.doughnut.pie square and .hole center/radius. The stacked horizontal sibling follow-up is still owned by remaining_core. This item must compose with those reviewed plots rather than independently estimate them.

## Vetoable design decisions

- Add optional point/series references to OverlayAnchor. A point is an authored category label or zero-based row index; a series is an exact unique value-column name or zero-based plotted-series index, default the first. Ambiguous names, null/unplotted points, unknown references and unsupported constructs are located shape-anchor-missing findings and draw no shape; numeric indexes remain available for duplicates.
- For a chart reference, edge selects the mark location: the value end or baseline of a bar, a line/scatter marker, or a slice arc location. The overlay center sits there; offset moves along its outward normal. Existing whole-block outside-edge placement remains unchanged. The ring in the academy fixture must center on the United States bar end.
- Use one shared mark and plot geometry, with core's actual numeric scales, gap-width planner, row alignment and doughnut squares. Pin the native classic inner plot to the same rectangle. Unsupported chartex and 3-D constructs remain explicit rather than allow preview-only drift.
- Every enabled point placement requires native application evidence within4px of the actual native point location. Source/XML/renderer agreement is necessary but does not itself qualify PowerPoint. The coordinator alone owns COM; prepare fixtures/manifests and a read-only native measurement script for that pass, never claim acceptance from generated XML.
- Integrate through existing validated/undoable editor APIs and structured fields. Preserve chart data, metadata and unrelated overlays.

Primary native API references: Microsoft documents [Point.Left](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.point.left) relative to the chart area, [Shape.Left](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.shape.left) relative to the slide, and [Point.PieSliceLocation](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.point.pieslicelocation) for pie slice coordinates. Native measurement must combine these actual coordinate systems correctly.

Implementation, focused regressions, full-slide comparison sheets, source fragment and changed-scope gates are next. No runtime source change or native acceptance is claimed by this reservation checkpoint.

## Candidate implementation checkpoint

Schema and static identities, core shared category/scatter/slice geometry, actual SVG mark bounds, native inner-plot pins, safe current-data import, undoable API/controls and portable/academy examples are implemented as candidates. Core6cases (including72signed/scale/direction category combinations),18actualSVGmark comparisons,16native XML/import/EMU controls and editor transactions pass. A32case ordinary baseline at67698 remains byte-identical in SVG and PPTX. Eight full before/after sheets cover32LTR/RTLcases; all160point placements remain unqualified until independent actual PowerPoint observations meet4px. No native or release acceptance is claimed.

Vetoable bounds: default point overlays have a12reference-pixel shorter-side floor; explicit fractions refer to mark bounds. Table-aligned-row plots,3D,combo,radar andChartEx are explicit missing-anchor findings. Named scatter categories are absent from native chart caches, so numeric point indexes are the portable import identity; a missing native name keeps the current free shape with a finding. Source names/values are never restored to make a stale anchor resolve.

The review generator reads immutable PNG files for sheet composition rather than retaining rasterizer buffers. SVG font-license whitespace is retained exactly. The actual native point measurement helper, final changed-scope/browser checks and reviewed main-aligned merge are next. The branch has not been folded.

## Shipping-first pause (2026-11-08)

The coordinator paused exploratory RTL and SH25 native work until v0.33 publication. The candidate normally merged the reviewed, main-aligned preparation `924a302ef10bf20d37eead5c4724e3f4a9535fe1` (local merge `eed0a7a8`); the sole burndown-log conflict retains both canonical SH24 and SH25 entries. No unreviewed LH93 source is merged.

The additive bounded measurement action reads actual native Point bounds and PieSliceLocation coordinates plus the current native ring center; it never reads or activates ChartData/Excel. It keeps the independently reviewed RR109 lifecycle, snapshots, bounds and latch. Fourteen lifecycle controls and 24 actual-helper chart-point coordinate/strict-4px/failure controls pass without Office. The native helper remains unapproved for actual Office execution; its action-plan-specific malformed-input controls and actual application qualification remain to do.

`check:changed --base 924a302e` began: build, Biome, changes, browser-safe and diagram-image checks passed. Catalog-free failed at composition gzip 260,563 bytes versus the maintained 256,668-byte budget. No ceiling was changed. A reviewed v0.34 source/bundle growth audit is required after final features are accepted. The coordinator-directed shipping pause stopped only the exact owned check process (PID38580), before heavy package suites; remaining root/type/package gates and the editor browser regression are not claimed passed. The branch is a durable draft checkpoint, not a folded or accepted feature.

Native point candidates are under artifacts/sh25-native with build/point-probes manifests; all 160 placements need independent actual native centers within 4px. Rebuild final qualification through the maintained CLI after the branch is clean, using its font profile for both preview and PPTX. Existing API-generated candidates remain explicitly provisional. Primary enum reference: https://learn.microsoft.com/en-us/dotnet/api/microsoft.office.interop.excel.xlpiesliceindex?view=excel-pia .
