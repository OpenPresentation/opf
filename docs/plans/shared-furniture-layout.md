# Shared header and footer reliability candidate

Read-only probes of the shared-timeline product graph reproduce the same defect on Mac Node 20/24: every header/footer run renders at 13px regardless of selected floors 16/32, and authored header/footer words are absent from parsed PPTX output. Core reports no diagnostics. Sources remain unchanged. Retain all four wide/portrait cases per runtime before implementation.

Unify inherited/local header and footer resolution, source/generated values, font styles, readable text measurement and placement. Resolve all three zones, explicit false overrides, literal dates, primary organization, section and slide numbers deterministically. Preserve source strings and whitespace; generated separators or missing-date diagnostics must not rewrite source. Image furniture should keep its original source and supported image-fit behavior.

Provide a core-owned resolved furniture contract that composition, pagination, renderer, editor and converter can share. Reserve sufficient top/bottom space before accepting body layout, with finite bounds, selected minima and actionable paths for irreducible overflow. Keep existing geometry unchanged when no furniture is present; preserve explicit human composition choices. Avoid duplicated independently fitted labels in consumer runtimes.

Render and export the accepted text geometry, with source-aware editing for authored fields and clear handling of generated values. Design a conservative native provenance contract for complete groups that recovers current text without resurrecting old words; preserve explicit inheritance/overrides where supported and report reflow/import limitations. Never infer arbitrary native text as a footer just from position.

Validate inherited and local fields, blank/mixed whitespace, long metadata, images, generated numbering after pagination, readable bounds/collisions, edit/undo, current-native text and malformed provenance. Compare before/after corpus source hashes and all changed rasters, with full-size views. Recheck clean installed packages on Node 20/24 and coordinate CI. Native Office remains a separate Windows acceptance gate after recovery. Versions/releases/deployments remain unchanged in this milestone.

Integration notes from the existing code: core `composeSlide` currently receives only a slide and host options; renderer `bindSlide`, editor `resolveCompositionOptions`, and core `paginatePresentation` each resolve presentation design context. Avoid inventing a renderer-only furniture resolver: expose a core data-resolution helper and pass inherited definition/source context through those call sites. `SlideComposition` can carry accepted furniture separately from body items, so body pagination cannot accidentally split repeated labels. `paginateSlide` must recognize repeated-furniture failures and must use actual output numbering (including already emitted presentation pages) before final acceptance, rather than reusing the source index for generated slide numbers. Literal fields need actual source paths; generated values should not become editable invented source text. Current canvas excludes `.design.` paths, which must be deliberately addressed for direct furniture text editing rather than assuming new trace attributes suffice.

Initial implementation approach: extend composition with optional presentation metadata context so inherited furniture, organization and current output numbering resolve centrally. Carry accepted furniture separately from body items. Lay out each actual literal/generated field as its own source-aware text part in its aligned zone, retaining empty literal fields; use a fixed font size at or above the selected floor and actual outlines where available. Reserve top/bottom space before arranging body content and report repeated furniture that cannot fit. This avoids treating generated organization/date/page values as the literal editable text field. Literal fields can be traced and edited directly, while generated fields remain tied to their controlling metadata. Image and text combinations must be explicit and source-preserving. Native import fidelity should remain conservative and documented; do not solve unrelated arbitrary-document round-tripping by embedding stale source words.

Implementation checkpoint: the source candidate now supplies `layoutFurniture`, `geometry.furniture`, `grid-score-v9`, optional `PaginatedPage.repeatedMappings`, final-number pagination, renderer/editor integration and accepted PPTX drawing. Repeated mappings remain separate from existing body slices after the first draft broke consumers expecting only body mappings. Core's 507 tests pass on Node 20/24; the legacy pagination checks pass after that correction. Thirty-two offline browser cases per runtime cover literal editing, empty fields, generated values, literal dates and undo/redo, with four full-size views reviewed and matching PNG hashes across runtimes. Sixteen PPTX export cases per runtime match current text, box coordinates, font sizes and fitted images, with byte-identical output across runtimes. These counts cover source candidates, not clean installed packages or native Office.

The first browser fixture was invalid because its organization omitted the required `id`; retain the failed fixture/log and the corrected result. The original renderer baseline correctly fails against the candidate: 657 of 805 slides changed, with matching corpus source. The old baseline remains untouched; changed-raster review and a separate candidate baseline are outstanding. Full-size portrait controls show bounded but heavy organization-name wrapping at the 32px floor.

Next native-provenance design work must retain current native text/images, source boundaries, generated-value intent and conservative inheritance/override recovery. Do not reuse body `OPF_TEXT_V1` paths for flags or silently reinterpret arbitrary positioned text as furniture. Empty/false definitions need topology without stale words or fake visible shapes. Standard common-slide customer data is available through [`p:cSld/p:custDataLst`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.commonslidedata.customerdatalist?view=openxml-3.0.1); the [common-slide schema child order](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.commonslidedata?view=openxml-3.0.1) places it after the shape tree. This is a candidate mechanism to assess, not an implemented or native-accepted provenance claim. Test missing/duplicate/edited tags, clearing, reordering, native image edits, metadata disagreement across repeated slides, and fallback without restoring historical words.

September 14 continuation: all four furniture branches are integrated onto the current Node 24 defaults under `codex/shared-furniture-20260914`. Node 20 references above describe historical evidence only. The new PPTX candidate implements dedicated `OPF_FURNITURE_V1` shape/picture tags and a common-slide manifest. Only topology, identities, inactive flags and source separators are stored. Current native text, image bytes and alt text remain authoritative. Global inheritance requires complete coverage and agreement; metadata conflicts and damaged groups fall back to current native content. Reordered slides retain unmatched visible numbers as ordinary text, and cleared fields do not recover old words or shape descriptions. The common-slide mechanism is now implemented and tested through XML conversion, but is still not natively accepted in Office.

The resumed evidence directory is `docs/evidence/mac-shared-furniture-resume-20260914`. It retains the initial eleven failed reimport checks and subsequent passing source/installed results. `test-furniture-workflow.mjs` now supports the existing installed consumer and verifies actual inline editing, undo/redo, PPTX export and semantic reimport with HTTP(S) blocked. Its loop contains 16 workflows per runtime; earlier prose claiming 32 per runtime overstated the loop count. The original raw evidence is unchanged. Native/font compatibility, the 657 changed corpus slides, final coordinated CI and release acceptance remain outstanding; do not update the accepted timeline raster baseline based only on these focused checks.

September 14 visual checkpoint: the predecessor was regenerated from current Node 24 default source and reproduced all 805 timeline baseline entries exactly. The candidate reproduced the same 657 changes and unchanged source digest. All 83 paired contact sheets and seven original-size before/after controls were visually reviewed. Renderer commit `d0ff86abe6e67436a5674778605bc8562314ad1c` retains the paired evidence, manifests, initial failures and review decision under `docs/evidence/furniture-corpus-review`; it introduces a separate `opf-examples-png.furniture.sha256.json` baseline. The timeline baseline is unchanged. The full local renderer suite now passes, including all 805 rasters. This accepts regression stability of the furniture change, not general visual quality or native/font compatibility.

Coordinated draft PRs are core #79, renderer #20, editor #17 and PPTX #34. The first pass passed core package verification, Mac/Windows CLI, editor, and Linux/Windows PPTX checks. Core ecosystem and renderer CI failed at the retained 657-slide raster gate, as expected before review; their remaining later steps were not established by those first runs. The current CI pins the reviewed renderer/baseline so those steps can complete. Native Office recovery and image/font/tab acceptance, final coordinated CI and registry release/public-site adoption remain required. The separately prioritized homepage JSON editor was merged in website PR29 and passed all nine production browser tests; it uses published core validation and does not imply furniture package publication.

September 14 CI audit correction: all status badges were green, but the full PPTX
Windows log contains a failed installed furniture browser assertion that was
masked by later successful commands in a PowerShell multiline step. The field
`design.header.left.text` has a Canvas-derived left ink estimate outside the
accepted box by 0.07001078651686px, beyond the existing 0.05px allowance. Linux
completes the sixteen workflows; Windows does not. The 37 Windows provenance
imports pass separately. `docs/evidence/mac-furniture-windows-ci-20260914` retains
all original logs and the failed artifact. Fix failure propagation first, then
inspect exact SVG paint and geometry before changing placement or measurement.
The harness gains failure capture, with no tolerance or runtime changes. Native
Office recovery remains required; no COM call is authorized by a green CI badge.

The fail-fast rerun reproduces the Windows assertion and now correctly fails.
Its isolated SVG paint has zero outside pixels while Canvas and SVG conservative
bounds exceed the box. `docs/evidence/mac-furniture-svg-paint-20260914` retains
the actual failure capture. The verifier now checks nonzero SVG mask pixel centers
for all measured fields at 1:1 scale and the unchanged 0.05 allowance, retains
Canvas observations, and requires a displaced-text control to fail. Mac source
passes sixteen workflows and forty measured field masks. This changes verification
of actual paint, not production geometry or the corpus baseline. Fresh Windows
installed-package verification remains required.

The stronger paint verifier found a distinct real Linux overflow: two nonzero
pixels at x=89 (coverage 7/255) extend beyond the field's x=89.6 edge in run
34909245051; Windows passes all forty field masks. Do not discard faint pixels or
widen the 0.05 containment allowance. The `furniture-flow-v2` candidate reserves
two reference pixels around measured furniture outlines by default, while explicit
`textRasterPadding` values remain authoritative. The body default remains one.
SVG and PPTX receive the same core placement. Mac passes eight core furniture
checks, sixteen browser workflows/forty masks and sixteen PPTX geometry exports.
Four before/after wide/portrait local/inherited screenshots were reviewed: content
and body separation remain intact; the narrow 32px organization label wraps one
character earlier while preserving all words. This is a scoped clearance fix,
not general visual-quality approval. Fresh coordinated source, installed Linux
and Windows, and unchanged-corpus checks remain required.

Final clearance acceptance: all six coordinated CI runs pass at core `8a322c1`,
renderer `3d4fa8c`, editor `40023fb` and PPTX `ee89b26`. The evidence and verifier
in `docs/evidence/mac-furniture-clearance-20260914` retain exact heads, full logs,
field masks and original failures. Core passes 508 tests; both renderer and core
ecosystem pass all 805 unchanged furniture baseline slides. Mac/Linux/Windows
each pass sixteen installed workflows and forty field masks; negative controls
fail as intended. Accepted geometry, semantic imports and PPTX bytes agree across
platforms. Native Office recovery and font/tab/image/provenance acceptance remain
required before release/public adoption. The overall ecosystem goal remains open.
