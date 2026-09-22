# Windows native edit evidence — 2026-09-21

This directory is a byte-preserving evidence bundle for the bounded B and C gates. B covers native picture and shared-furniture edits, current-content import, damaged-provenance fallback, and measured geometry. C covers production notes packaging and two controlled native refusals. D and E evidence is outside this bundle.

The runs used PowerPoint `16.0.20326.20158` on Windows build `26200.9457`; each worker report records its own environment, inputs, process result, durable stages, hashes, and cleanup state. The tested PPTX worker implementation is also preserved in each run's `inputs/` snapshot and is represented by [OpenPresentation/opf-pptx PR 47](https://github.com/OpenPresentation/opf-pptx/pull/47) at head `08850fc`.

## B — current content, safe fallback, and native edits

The three picture runs independently altered crop/geometry/alt text, replaced the image, and deleted it. Each saved the exact owned presentation, closed it, reopened it read-only, and recorded the current embedded-picture state and raster. These finite observations do not imply general PowerPoint picture fidelity.

The ten furniture lifecycles cover the inherited/local baseline, explicit empty and false definitions, edited and cleared text, a separately performed supported-UI Change Picture followed by worker reopen, image deletion, slide movement, tagged-shape duplication, tag deletion, tag mutation, and organization disagreement. Completed worker reports have `cleanupConfirmed: true`; the offline audits bind the action plans, source and saved hashes, ordered stages, current shapes/tags/text, ZIP/XML validity, and save/reopen state.

The public-registry semantic audit passes all nine applicable baseline/action-plan runs. Exact baseline summaries retain inherited and local definitions and explicit false/empty flags. Valid edited provenance consumes current native text and image bytes. Missing, duplicated, changed, or conflicting provenance is refused for the affected role and current visible content is retained as ordinary content; unaffected roles and slides remain recoverable. This is the tested safe fallback. It is not a claim that arbitrary PowerPoint content can be reconstructed.

`furniture-ui-replace-01` preserves the raw failed comparison, its frozen failed copy, and the corrected comparison. The corrected inspector fixes directory-entry filtering and resolves current tag relationships rather than requiring PowerPoint to preserve relationship part names or IDs. It verifies the selected replacement bytes, exact provenance payload, current empty alt, unchanged non-target content, and public-registry reimport. `furniture-ui-reopen-native-01` then records a successful save, close, read-only reopen, and cleanup of that UI-edited deck.

Geometry is evidence with limits. Worker audits allow at most `0.02` point drift between the edited and reopened native observations. The supported UI picture replacement retained shape identity and provenance but changed the picture from `54 × 27` points at left `165` to `13.5 × 27` points at left `185.25`; the bundle records this separately from content correctness. Visual review of `furniture-text-clear-native-01/reopened-slide-01.png` also found that the longer current string `  Native edited header\twords` is semantically retained while the fixed native text box visibly clips the trailing `words`. The duplicated tagged header also visibly overlaps adjacent text. There is no native text reflow or fit acceptance, no preview pixel-identity claim, and no general layout-fidelity claim.

The two independent auditor versions and six offline synthetic controls are included. Each synthetic control changes copied evidence and must fail on exactly the intended condition: missing raster, mismatched plan snapshot, failed worker, geometry over tolerance, current-text mismatch, or missing close stage. Synthetic mutations are auditor tests, not PowerPoint behavior. Duplicate synthetic raster copies are omitted from this bundle; `B/furniture/synthetic-controls/artifacts.json` records every source artifact, hash, size, and omission.

## C — notes ordering

The production `notes-control` archive uses the current production order, `p:sldIdLst` before `p:notesMasterIdLst`. Its bounded native lifecycle opened, saved, closed, reopened, preserved current notes titles/body, and completed with confirmed cleanup.

The first controlled reordered archive parsed and imported identically offline but PowerPoint refused `Presentations.Open` with HRESULT `0x80070570`. The latest isolated variant removed the ZIP-entry-order confound: `unchanged-ascii.pptx` is byte-identical to the production archive, while `reordered-ascii.pptx` preserves the same ASCII ZIP order and changes only `ppt/presentation.xml`. PowerPoint also refused that isolated XML-order variant with `0x80070570`. Production ordering therefore remains unchanged.

Both refusal workers stopped without retry and record `cleanupConfirmed: false`. Separate supervisor UI inspections found one empty PowerPoint workspace with no document, repair/recovery dialog, save prompt, or modal. That UI observation does not retroactively turn either failed worker's cleanup state into confirmed cleanup. The result is a bounded observation on these files and this Office build, not a universal statement about all OOXML element orders or Office versions.

`notes-packaging-controls-01` preserves the initial offline generator type failure. `notes-packaging-controls-02` preserves the corrected ASCII/locale packaging controls and exact part-order inventories. Only the `notes-control` source, original archive, reordered archive, manifest, and generator are copied from the larger 21-deck registry set.

## Reading the bundle

`artifact-manifest.json` lists every bundled file with its source-relative path, byte length, and SHA-256. Files under native run directories are unchanged copies, including scripts, JSONL stages, worker logs, reports, PPTX bytes, and slide rasters. Raw reports intentionally retain captured host paths; use the bundle-relative inventory and hashes for portable inspection rather than expecting those historical absolute paths to resolve elsewhere.

The builder refuses an existing destination, copies only its explicit whitelist, rejects font programs, PDFs, screenshot/recents names, and emits `.gitattributes` with `** -text` so Git does not normalize evidence bytes. It neither invokes Office nor seals or commits the bundle.

`visual-review.json` binds the supervisor's full-slide observations to the reviewed raster hashes. The final manifest records the subsequent supervisor finalizer as well as the initial builder. Run `python verify.py` from this directory for a portable standard-library inventory, hash, JSON, ZIP/XML and font-program check; this makes no Office calls.
