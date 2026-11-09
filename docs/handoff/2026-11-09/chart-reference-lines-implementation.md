# Explicit chart reference implementation

Owner approved the concrete representation in [issue1139 comment6737687915](https://github.com/OpenPresentation/opf/issues/1139#issuecomment-6737687915) via “Approve this design for implementation.” This approval supersedes earlier awaiting-design wording. No release is authorized by this focused task.

Branch: `codex/lh-110-explicit-reference-lines`, isolated fresh-main short worktree. Initial normal merge includes reviewed169055e9b5431aab58d3cf16199bf9d2bc38af97. Published core/render checkpoint01f52e3a640141c0b45700566ebf6c01de3b48ff passes 24 focused tests; this remains an unqualified in-progress feature until the PPTX contribution and required checks are complete.

The coordinator owns authoritative schema/core/composition/render plus shared docs/examples/fragment/program state. The parallel PPTX contribution owns helper export/import, legacy/fallback handling, PPTX tests and its package README. It must be normally merged into this one coherent feature PR and then frozen. No producer/controller, vendor, local golden or release changes belong here. Root owns the single CI observer, managed golden regeneration and Office qualification.

Implemented core APIs: `chartReferences(chart)` returns ordered explicit normalized properties; `placeReferences(refs,data,{value,secondary},box,inset,geometry)` adds slide coordinates, scaled stroke width, endpoint row and native/fallback/label placement. `chart.valueAxis` and `chart.secondaryValueAxis` provide exact composed bounds; `chart.layer.plot` is the shared inset. The renderer consumes these directly. No title-number parser API remains.

Meaningful focused coverage: schema and located invalid-axis/nonfinite errors; optional labels/width0; duplicates/data-equal values; own-axis percentages/no clamp; null-only data; same-axis zero anchoring; category-center/native and full-plot fallback spans; RTL; label collision/overflow retention; title/subtitle/focus/end-label invariance in a fixed frame; sibling bounds; actual SVG styles/geometry and fallback drawing. The initial test attempts retained a missing gallery build, a missing public combo-axis export, two incorrect validation assertions and an unconstrained automatic-frame assertion; they were corrected and the 24-test suite passed. This is not a full gate/native claim.

Next: finish/merge reviewed PPTX implementation, inspect representative real renders, run required `pnpm check:changed` on coherent source, retain any original failures, and publish one reviewable PR against the coordinator's integration. Do not start another CI watcher, regenerate local goldens, force-push or publish a release.

Vetoable implementation decisions within the approved contract:

- Keep narrow ChartReferenceStroke and raw axis units; no unrelated general series-stroke or period-band API.
- Use shared combo bounds and defensively apply zero anchoring only to bars on the same axis; the current author model adapts secondary bars away, so explicit secondary references require a real secondary line.
- Reject nonfinite in-memory numbers with located semantic validation as well as schema validation, because the validator's number type alone accepts NaN/Infinity in some call paths.
- Preserve uncertain mixed area/helper groups as all-data combo import with an explicit area-to-column diagnostic where the current OPF model cannot retain the native mixed representation. This is limited preservation, not parity.

- Visual inspection found avoidable singleton overlay endpoint-label overhang. Full-plot horizontal overlay labels now align inward at their logical endpoint; native point labels remain centered. Numeric positions and spans are unchanged. Five pinned-font PNGs and geometry/hash evidence are kept in [chart-reference-lines-evidence](chart-reference-lines-evidence/render-evidence.json).

- Final-plot audit repaired table-aligned bar references after LH-115 alignment and moved label diagnostics to the final shared/aligned placement. Existing no-reference alignment remains covered. SVG dot uses the existing Stroke/DrawingML 1:3 pattern. The expanded focused/neighbor suite passes 44 tests after retaining/correcting a float equality assertion and an incorrect assumed area SVG tag. Coherent required check and PPTX/native remain pending.


## Broader local check and repair

Original official `pnpm check:changed --base 169055e9b5431aab58d3cf16199bf9d2bc38af97` finished 16 passed/7 failed steps in 302.4s. [Original output](chart-reference-lines-evidence/mapped-check-01.log) is retained unchanged. It is not an aggregate-green result.

Owned failures repaired: generated schema reference via maintained generator; generated validator reference plus 98-rule text/explain/corpus integration; new example embeds every catalog record and source inventory now 148; legacy combo-axis test updated for the newly shared axes; final combo plot binds the 400-weight measurer. The focused validation/schema/examples/core/render contract set passes 377 tests, and subsequent full `pnpm typecheck` passes. The original full core and render suites still need a coherent rerun after PPTX integration.

Known original failures left visible: old PPTX overlay code cannot yet export the new explicit example; parallel PPTX contribution is pending. Sparse-worktree fixture failures name `docs/evidence/rr-42-native-20261002/values.json` (gallery tracker), `docs/evidence/rich-input-and-platform-ci-20260915/painting-Linux.json.gz` (text integrity), and `docs/evidence/script-corpora-20261001/script-corpora.json` (full core). No broad hydration, tracker regeneration, tolerance change or bypass was used.

Visual review confirmed that the combo's secondary 25% label crossed its 27% ordinary data line at the last category. Placement now tests actual ordinary line/marker geometry before choosing a side and moves that label below the target; regenerated PNG inspected, values/axes/span unchanged. Final diagnostics include unresolved ink/label collisions. Filled regions do not act as line-ink obstacles; chart typography remains unchanged.

Additional vetoable decisions: finite numeric values are constrained directly by authoritative schema bounds ±Number.MAX_VALUE (every finite JavaScript number remains legal; NaN/Infinity are rejected). This supersedes the earlier WIP semantic finite-value rule; the axis-association semantic rule retains full text/explain/docs/tests. For unchanged owned fallback overlays only, exact authored value may be restored after versioned/hash-bound current line+label and chart plot/axis/frame binding validate, avoiding EMU quantization drift; any edit/uncertainty retains visible shapes without stale references. Native helper values/styles/labels always come from current chart XML.

Post-repair checks: generated schema docs match; the actual text-integrity scan passed across 9,121 files; focused lint has zero errors. The separate fixture-dependent text test remains an original sparse-worktree failure.

A legal 64px reference stroke previously painted through its own endpoint label because spacing ignored thickness. Shared placement now includes half the stroke in adjacent clearance; numeric line coordinates, spans and bounds remain unchanged. Zero-width labels retain ordinary spacing. This placement choice is vetoable and has dedicated native-span/bar/width-zero geometry coverage; native Office label clearance still needs the coordinator's physical qualification.

Final source integration removes the unused period-band color utility/export as well as parser/creation paths. The complete PPTX contribution was independently reviewed against immutable checkpoints; review fixes cover same-axis line role preservation, secondary-axis availability, explicit label font/full paint, multiline/current-label text, scaled maximum-width quantization and genuine legacy band preservation. The final source is still awaiting its one coherent mapped run and coordinator-owned native/CI/golden qualification.

## Combined source awaiting the single gate

The complete PPTX contribution df3e0356351a6a3aa6a56a03b075325760217c6f was independently reviewed and normally merged into current core b4e1fd569729e6960f167b9d69be884c3d087911 at bde4c47e27aae2ef24997c5f3b933db714c7451a. The contribution branch is folded and frozen; qualification must use a new branch, never another push to that leaf. The final cleanup removes dead band-color APIs/callers and completes shared docs.

The durable [PPTX receipt verifier](chart-reference-lines-pptx/verify.mjs) passes: 70 records, 485,025 expanded bytes; historical exact runtime6c426406 has 38 focused controls passing. The earlier 37-pass receipt and original genuine before-RED/faulty-fixture corrections are retained separately. This verifier does not claim the combined core revision was run. Core/render current dedicated suite passes 20 tests; the earlier broader repaired contract set passed 377, and subsequent typecheck passed before final cleanup.

Scheduling is binding: root67306 and then a bounded quiet performance measurement window precede another heavy command. Run exactly one official combined mapped check after coordinator go-ahead. The PPTX contributor may normally merge this combined head into a NEW qualification branch and run that one gate; record exact head/tree and preserve all original output. The lead reuses identical-source results instead of repeating unchanged full suites. All native Office/CI/golden/release acceptance remains coordinator-owned. No release under this feature task.

Final review also covered edited automatic labels, leader lines and manual native label geometry: unsupported visible constructs remain ordinary data with diagnostics; supported label deletion/clearing restores no stale text. Same-axis ordinary line groups remain lines; different-axis all-line groups and area groups receive named representation/axis diagnostics when OPF combo adaptation is necessary. Divergent category vectors are diagnosed, with numeric data/order preserved and first-series category labels used by the single OPF axis.


## Final grouping and finite-axis review corrections

The new frozen PPTX grouping contribution ba665f4f was independently reviewed and normally folded: stacked/percent-stacked helper groups remain ordinary data with diagnostics; standard and omitted-default grouping restore explicit references. The original df3 leaf remains frozen. Its separate durable receipt records genuine 2/2 before-RED and 41 focused after-PASS controls.

Parent's bounded finite-extreme audit reproduced actual silent omission at -Number.MAX_VALUE and ±MAX. Source 5006a625 fixes shared core/SVG tick reconstruction without a value cap or ordinary-case arithmetic changes. Core plot/bar/sibling bounds and renderer scales now agree. The [diagnostic receipt](chart-reference-extremes/README.md) preserves original before logs, a setup refusal, exact source hashes and 23/23 passing focused controls in a 1,052 ms source-only child. This is explicitly not a normal package build/gate claim; the one coherent mapped gate remains required. Additional PPTX extreme-value controls are delegated to the contributor on a new qualification descendant.

Vetoable decision: use overflow-safe axis reconstruction for all composed finite axes rather than silently dropping legal explicit properties or imposing an arbitrary numeric cap. Keep the existing bounded tick count. Native helpers whose grouping no longer represents independent constant lines are ordinary chart data, never reference annotations.
