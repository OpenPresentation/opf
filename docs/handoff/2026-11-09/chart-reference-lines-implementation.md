# Explicit chart reference implementation

Owner approved the concrete representation in [issue1139 comment6737687915](https://github.com/OpenPresentation/opf/issues/1139#issuecomment-6737687915) via “Approve this design for implementation.” This approval supersedes earlier awaiting-design wording. No release is authorized by this focused task.

Branch: `codex/lh-110-explicit-reference-lines`, isolated fresh-main short worktree. Initial normal merge includes reviewed169055e9b5431aab58d3cf16199bf9d2bc38af97. Published core/render checkpoint01f52e3a640141c0b45700566ebf6c01de3b48ff passes24 focused tests; this remains an unqualified in-progress feature until the PPTX contribution and required checks are complete.

The coordinator owns authoritative schema/core/composition/render plus shared docs/examples/fragment/program state. The parallel PPTX contribution owns helper export/import, legacy/fallback handling, PPTX tests and its package README. It must be normally merged into this one coherent feature PR and then frozen. No producer/controller, vendor, local golden or release changes belong here. Root owns the single CI observer, managed golden regeneration and Office qualification.

Implemented core APIs: `chartReferences(chart)` returns ordered explicit normalized properties; `placeReferences(refs,data,{value,secondary},box,inset,geometry)` adds slide coordinates, scaled stroke width, endpoint row and native/fallback/label placement. `chart.valueAxis` and `chart.secondaryValueAxis` provide exact composed bounds; `chart.layer.plot` is the shared inset. The renderer consumes these directly. No title-number parser API remains.

Meaningful focused coverage: schema and located invalid-axis/nonfinite errors; optional labels/width0; duplicates/data-equal values; own-axis percentages/no clamp; null-only data; same-axis zero anchoring; category-center/native and full-plot fallback spans; RTL; label collision/overflow retention; title/subtitle/focus/end-label invariance in a fixed frame; sibling bounds; actual SVG styles/geometry and fallback drawing. The initial test attempts retained a missing gallery build, a missing public combo-axis export, two incorrect validation assertions and an unconstrained automatic-frame assertion; they were corrected and the24-test suite passed. This is not a full gate/native claim.

Next: finish/merge reviewed PPTX implementation, inspect representative real renders, run required `pnpm check:changed` on coherent source, retain any original failures, and publish one reviewable PR against the coordinator's integration. Do not start another CI watcher, regenerate local goldens, force-push or publish a release.

Vetoable implementation decisions within the approved contract:

- Keep narrow ChartReferenceStroke and raw axis units; no unrelated general series-stroke or period-band API.
- Use shared combo bounds and defensively apply zero anchoring only to bars on the same axis; the current author model adapts secondary bars away, so explicit secondary references require a real secondary line.
- Reject nonfinite in-memory numbers with located semantic validation as well as schema validation, because the validator's number type alone accepts NaN/Infinity in some call paths.
- Preserve uncertain mixed area/helper groups as all-data combo import with an explicit area-to-column diagnostic where the current OPF model cannot retain the native mixed representation. This is limited preservation, not parity.

- Visual inspection found avoidable singleton overlay endpoint-label overhang. Full-plot horizontal overlay labels now align inward at their logical endpoint; native point labels remain centered. Numeric positions and spans are unchanged. Five pinned-font PNGs and geometry/hash evidence are kept in [chart-reference-lines-evidence](chart-reference-lines-evidence/render-evidence.json).

- Final-plot audit repaired table-aligned bar references after LH-115 alignment and moved label diagnostics to the final shared/aligned placement. Existing no-reference alignment remains covered. SVG dot uses the existing Stroke/DrawingML 1:3 pattern. The expanded focused/neighbor suite passes44 tests after retaining/correcting a float equality assertion and an incorrect assumed area SVG tag. Coherent required check and PPTX/native remain pending.
