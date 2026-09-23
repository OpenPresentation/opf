# Dimension audit A: layouts, content blocks, image treatments, backgrounds, headers & footers

Commits: opf `33d636d`, opf-render `bc436f3`, opf-pptx `9092954`, pptx-gallery `f17e9ae`. Node v24.21.0. Core bundled layout catalog: 30 records.

Method: gallery lib/opf-snippets.ts builders bundled with esbuild; @openpresentation/opf linked to local core dist; opf-render/opf-pptx from source; engine default text measurement (Office font registry probed separately); no Office/COM. Each value's OPF is the exact document the gallery page emits (lib/opf-snippets.ts). Checks: (1) core validatePresentation, (2) catalog/reference resolution, (3) opf-render SVG vs a baseline document without the dimension, (4) opf-pptx export + OPC parts + dimension-specific native XML, (5) opf-pptx fromPptx re-import, (6) docs/evidence + compatibility-matrix hits. "withAssets" re-runs values whose gallery snippet references undeclared `asset:*` ids with a real raster supplied.

| Dimension | Total | works | partial | schema-only | broken | gallery-only | withAssets variant | preview/export disagree |
|---|---|---|---|---|---|---|---|---|
| backgrounds | 6 | 2 | 4 | 0 | 0 | 0 | works 1 | 1 |
| image-treatments | 15 | 0 | 15 | 0 | 0 | 0 | partial 13, works 2 | 15 |
| headers-footers | 10 | 1 | 9 | 0 | 0 | 0 | n/a | 0 |
| blocks | 32 | 29 | 3 | 0 | 0 | 0 | n/a | 1 |
| layouts | 485 | 289 | 126 | 0 | 0 | 70 | n/a | 66 |

Font registry probe: 547/548 values throw `font-unavailable: No local font face for 'Aptos Display'.; font-unavailable: No local font face for 'Segoe UI Semibold'.; font-unavailable: No local font face for 'Georgia'.; font-unavailable: No local font face for 'Montserrat'.; font-unavailable: No local font face for 'Poppins'.; font-unavailable: No local font face for 'Grandview Display'.; font-unavailable: No local font face for 'Open Sans'.` when rendered with opf-render's `loadOfficeFontRegistry()` text measurement (the ecosystem-test configuration), because the default Aptos / Aptos Display scheme has no local face in that registry. All classifications below use the engine's default measurement.

Sensitivity: values that would be `works` if (a) a re-import that drops the layout id but emits any diagnostic counted as a pass and (b) gallery narrative slugs absent from the core narrative catalog were ignored: backgrounds 2/6, image-treatments 0/15, headers-footers 1/10, blocks 29/32, layouts 307/485.

## backgrounds

Top reasons (count):

- 3 x gallery slug collapses to the #
- 1 x export diagnostics: unresolved-asset
- 1 x export has no native <a:blipFill> background
- 1 x gallery snippet references asset:cover without an assets entry
- 1 x preview diagnostics: unresolved-asset
- 1 x re-import does not return background type image

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| solid-color | works |  |  |
| subtle-gradient | works |  |  |
| geometric-pattern | partial |  | gallery slug collapses to the same OPF background as abstract-shapes, minimal-texture (treatment identity not representable) |
| photography | partial | works | export has no native <a:blipFill> background; re-import does not return background type image; preview diagnostics: unresolved-asset; export diagnostics: unresolved-asset; gallery snippet references asset:cover without an assets entry |
| abstract-shapes | partial |  | gallery slug collapses to the same OPF background as geometric-pattern, minimal-texture (treatment identity not representable) |
| minimal-texture | partial |  | gallery slug collapses to the same OPF background as geometric-pattern, abstract-shapes (treatment identity not representable) |

Preview/export disagreements (1):

- 1 x preview effect=true but export native=false

## image-treatments

Top reasons (count):

- 15 x export adds no native picture for design.slideImage
- 15 x gallery snippet references asset:hero without an assets entry
- 15 x preview diagnostics: unresolved-asset
- 13 x treatment collapses to {#:#,#:#}, #

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| full-bleed | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to text-overlay, caption-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| text-overlay | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, caption-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| side-by-side | partial | works | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; gallery snippet references asset:hero without an assets entry |
| caption-overlay | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| masked-shape | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to circular-crop, rounded-card, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| circular-crop | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, rounded-card, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| rounded-card | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| duotone | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| background-blur | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| image-strip | partial | works | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; gallery snippet references asset:hero without an assets entry |
| collage-grid | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| device-frame | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, collage-grid, cutout-subject; gallery snippet references asset:hero without an assets entry |
| cutout-subject | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, collage-grid, device-frame; gallery snippet references asset:hero without an assets entry |
| watermark | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, background-blur, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| cinematic-crop | partial | partial | export adds no native picture for design.slideImage; preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, background-blur, watermark; gallery snippet references asset:hero without an assets entry |

Preview/export disagreements (15):

- 15 x preview effect=true but export native=false
- 15 x diagnostics differ: preview[unresolved-asset] export[]

Note: the gallery `/editor?config=image-treatments:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## headers-footers

Top reasons (count):

- 3 x date requested but no native datetime field in export
- 3 x export diagnostics: unresolved-content
- 3 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted)
- 3 x preview diagnostics: unresolved-content
- 3 x re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow)
- 2 x #
- 2 x gallery config not expressed in snippet: dateFormat # (only date:true emitted); date and slideNumber merged into one footer.right slot
- 2 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat #
- 1 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); dateFormat # (only date:true emitted
- 1 x gallery config not expressed in snippet: legalLine (classificationLine wins footer.center)

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| slide-number-only | partial |  | gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); identical OPF to slide-number-progress |
| slide-number-progress | partial |  | gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat "{current} / {total}"; identical OPF to slide-number-only |
| section-marker-header | partial |  | gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted) |
| dated-footer | partial |  | date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); dateFormat "MMM d, yyyy" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| brand-logo-footer | partial |  | gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted) |
| client-delivery-footer | partial |  | date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: dateFormat "MMM yyyy" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| confidential-legal-footer | works |  |  |
| classification-banner | partial |  | gallery config not expressed in snippet: legalLine (classificationLine wins footer.center) |
| version-control-footer | partial |  | date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: dateFormat "yyyy-MM-dd" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| appendix-numbering | partial |  | gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat "A-{current}" |

Note: the gallery `/editor?config=headers-footers:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## blocks

Top reasons (count):

- 2 x export missing # expected strings as native text #
- 2 x preview missing # expected strings #
- 1 x preview diagnostics: text-overflow
- 1 x re-import loses payload kinds #)

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| pitch-deck-intro | works |  |  |
| agenda-overview | works |  |  |
| section-break | works |  |  |
| executive-summary | works |  |  |
| problem-statement | works |  |  |
| solution-overview | works |  |  |
| market-opportunity | partial |  | preview missing 1 expected strings (e.g. 0:$420M beachhead); export missing 1 expected strings as native text (e.g. 0:$420M beachhead) |
| value-proposition | works |  |  |
| business-model | works |  |  |
| decision-brief | works |  |  |
| kpi-dashboard | works |  |  |
| financial-snapshot | partial |  | preview missing 4 expected strings (e.g. 0:Revenue +22%); export missing 4 expected strings as native text (e.g. 0:Revenue +22%); preview diagnostics: text-overflow |
| traction-metrics | works |  |  |
| data-story-insight | works |  |  |
| comparison-table | works |  |  |
| before-after-story | works |  |  |
| swot-snapshot | works |  |  |
| pricing-options | works |  |  |
| roadmap-timeline | works |  |  |
| milestone-timeline | works |  |  |
| process-overview | works |  |  |
| customer-journey | works |  |  |
| implementation-plan | works |  |  |
| team-grid | works |  |  |
| quote-slide | partial |  | re-import loses payload kinds 0:quote (diagnostics: heading-import-reflow) |
| testimonial-wall | works |  |  |
| customer-logo-proof | works |  |  |
| case-study-snapshot | works |  |  |
| closing-cta | works |  |  |
| qa-discussion | works |  |  |
| recap-takeaways | works |  |  |
| appendix-index | works |  |  |

Preview/export disagreements (1):

- 1 x diagnostics differ: preview[text-overflow] export[]

Note: the gallery `/editor?config=blocks:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## layouts

Top reasons (count):

- 70 x legacy gallery slug with no OPF canonical id; portable only via inline catalogs.layouts.records
- 69 x layout resolves but geometry is identical to the no-layout default in both preview and export (no distinguishable effect)
- 66 x export shape placement ignores layout that changes preview (preview/export disagree)
- 24 x re-import loses payload kinds image
- 12 x export diagnostics: small-cell,text-overflow
- 12 x preview diagnostics: small-cell,text-overflow
- 6 x export diagnostics: text-overflow
- 6 x preview diagnostics: text-overflow
- 3 x re-import loses payload kinds quote

Measured class by origin (gallery-only legacy slugs shown by their measured class):

| Origin | works | partial | schema-only | broken |
|---|---|---|---|---|
| core-catalog / master Dark | 0 | 15 | 0 | 0 |
| core-catalog / master OPF | 1 | 14 | 0 | 0 |
| gallery-inline-record / master Dark | 288 | 97 | 0 | 0 |
| gallery-inline-record / master Gallery | 18 | 52 | 0 | 0 |

Works (289): chart-1x-slideimage, chart-1x-title-center-slideimage, chart-1x-title-left-slideimage, chart-2x-slideimage, chart-2x-title-center-slideimage, chart-2x-vertical-title-left, chart-2x-vertical-title-left-slideimage, chart-3x-bottom-vertical-title-left, chart-3x-bottom-vertical-title-left-slideimage, chart-3x-left, chart-3x-left-slideimage, chart-3x-left-title-center, chart-3x-left-title-center-slideimage, chart-3x-right, chart-3x-right-slideimage, chart-3x-right-title-center, chart-3x-right-title-center-slideimage, chart-3x-slideimage, chart-3x-title-center-slideimage, chart-3x-top-vertical-title-left, chart-3x-top-vertical-title-left-slideimage, image-1x-crop, image-1x-crop-title-center, image-1x-crop-title-left, image-2x-crop, image-2x-crop-slideimage, image-2x-crop-title-center, image-2x-crop-title-center-slideimage, image-2x-crop-vertical, image-2x-crop-vertical-slideimage, image-2x-crop-vertical-title-left, image-2x-crop-vertical-title-left-slideimage, image-2x-fit-slideimage, image-2x-fit-title-center-slideimage, image-2x-fit-vertical, image-2x-fit-vertical-slideimage, image-2x-fit-vertical-title-left, image-2x-fit-vertical-title-left-slideimage, image-3x-crop, image-3x-crop-slideimage, image-3x-crop-title-center, image-3x-crop-title-center-slideimage, image-3x-crop-vertical, image-3x-crop-vertical-slideimage, image-3x-crop-vertical-title-left, image-3x-crop-vertical-title-left-slideimage, image-3x-fit, image-3x-fit-slideimage, image-3x-fit-title-center-slideimage, image-3x-fit-vertical, image-3x-fit-vertical-slideimage, image-3x-fit-vertical-title-left, image-3x-fit-vertical-title-left-slideimage, image-only-2x-crop-slideimage, image-only-2x-crop-title-center-slideimage, image-only-2x-crop-vertical, image-only-2x-crop-vertical-slideimage, image-only-2x-crop-vertical-title-left, image-only-2x-crop-vertical-title-left-slideimage, image-only-2x-fit-slideimage, image-only-2x-fit-title-center-slideimage, image-only-2x-fit-vertical, image-only-2x-fit-vertical-slideimage, image-only-2x-fit-vertical-title-left, image-only-2x-fit-vertical-title-left-slideimage, image-only-3x-crop, image-only-3x-crop-slideimage, image-only-3x-crop-title-center-slideimage, image-only-3x-crop-vertical, image-only-3x-crop-vertical-slideimage, image-only-3x-crop-vertical-title-left, image-only-3x-crop-vertical-title-left-slideimage, image-only-3x-fit, image-only-3x-fit-slideimage, image-only-3x-fit-title-center-slideimage, image-only-3x-fit-vertical, image-only-3x-fit-vertical-slideimage, image-only-3x-fit-vertical-title-left, image-only-3x-fit-vertical-title-left-slideimage, list-1x-box, list-1x-box-slideimage, list-1x-box-title-center, list-1x-box-title-center-slideimage, list-1x-box-vertical, list-1x-box-vertical-slideimage, list-1x-box-vertical-title-center, list-1x-box-vertical-title-center-slideimage, list-1x-box-vertical-title-left, list-1x-box-vertical-title-left-slideimage, list-1x-itemimage-slideimage, list-1x-itemimage-title-center-slideimage, list-1x-itemimage-vertical-slideimage, list-1x-itemimage-vertical-title-center-slideimage, list-1x-itemimage-vertical-title-left-slideimage, list-1x-slideimage, list-1x-title-center-slideimage, list-1x-vertical-slideimage, list-1x-vertical-title-center-slideimage, list-1x-vertical-title-left-slideimage, list-2x-box, list-2x-box-slideimage, list-2x-box-title-center, list-2x-box-title-center-slideimage, list-2x-box-vertical, list-2x-box-vertical-slideimage, list-2x-box-vertical-title-center, list-2x-box-vertical-title-center-slideimage, list-2x-box-vertical-title-left, list-2x-box-vertical-title-left-slideimage, list-2x-itemimage-slideimage, list-2x-itemimage-title-center-slideimage, list-2x-itemimage-vertical, list-2x-itemimage-vertical-slideimage, list-2x-itemimage-vertical-title-center, list-2x-itemimage-vertical-title-center-slideimage, list-2x-itemimage-vertical-title-left, list-2x-itemimage-vertical-title-left-slideimage, list-2x-slideimage, list-2x-title-center-slideimage, list-2x-vertical, list-2x-vertical-slideimage, list-2x-vertical-title-center, list-2x-vertical-title-center-slideimage, list-2x-vertical-title-left, list-2x-vertical-title-left-slideimage, list-3x-box, list-3x-box-slideimage, list-3x-box-title-center, list-3x-box-title-center-slideimage, list-3x-box-vertical, list-3x-box-vertical-slideimage, list-3x-box-vertical-title-center, list-3x-box-vertical-title-center-slideimage, list-3x-box-vertical-title-left, list-3x-box-vertical-title-left-slideimage, list-3x-itemimage, list-3x-itemimage-slideimage, list-3x-itemimage-title-center-slideimage, list-3x-itemimage-vertical, list-3x-itemimage-vertical-slideimage, list-3x-itemimage-vertical-title-center, list-3x-itemimage-vertical-title-center-slideimage, list-3x-itemimage-vertical-title-left, list-3x-itemimage-vertical-title-left-slideimage, list-3x-slideimage, list-3x-title-center-slideimage, list-3x-vertical, list-3x-vertical-slideimage, list-3x-vertical-title-center, list-3x-vertical-title-center-slideimage, list-3x-vertical-title-left, list-3x-vertical-title-left-slideimage, list-4x-box, list-4x-box-slideimage, list-4x-box-title-center, list-4x-box-title-center-slideimage, list-4x-box-vertical, list-4x-box-vertical-slideimage, list-4x-box-vertical-title-center, list-4x-box-vertical-title-center-slideimage, list-4x-box-vertical-title-left, list-4x-box-vertical-title-left-slideimage, list-4x-itemimage-slideimage, list-4x-itemimage-title-center-slideimage, list-4x-itemimage-vertical, list-4x-itemimage-vertical-slideimage, list-4x-itemimage-vertical-title-center, list-4x-itemimage-vertical-title-center-slideimage, list-4x-itemimage-vertical-title-left, list-4x-itemimage-vertical-title-left-slideimage, list-4x-slideimage, list-4x-title-center-slideimage, list-4x-vertical, list-4x-vertical-slideimage, list-4x-vertical-title-center, list-4x-vertical-title-center-slideimage, list-4x-vertical-title-left, list-4x-vertical-title-left-slideimage, list-5x-box, list-5x-box-slideimage, list-5x-box-title-center, list-5x-box-title-center-slideimage, list-5x-box-vertical, list-5x-box-vertical-slideimage, list-5x-itemimage-slideimage, list-5x-itemimage-title-center-slideimage, list-5x-itemimage-vertical, list-5x-itemimage-vertical-slideimage, list-5x-itemimage-vertical-title-center, list-5x-itemimage-vertical-title-center-slideimage, list-5x-itemimage-vertical-title-left, list-5x-itemimage-vertical-title-left-slideimage, list-5x-slideimage, list-5x-title-center-slideimage, list-5x-vertical, list-5x-vertical-slideimage, list-5x-vertical-title-center, list-5x-vertical-title-center-slideimage, list-5x-vertical-title-left, list-5x-vertical-title-left-slideimage, list-6x-box, list-6x-box-slideimage, list-6x-box-title-center, list-6x-box-title-center-slideimage, list-6x-heading-title-center, list-6x-heading-title-center-slideimage, list-6x-itemimage-slideimage, list-6x-itemimage-title-center-slideimage, list-6x-itemimage-vertical, list-6x-itemimage-vertical-slideimage, list-6x-slideimage, list-6x-title-center-slideimage, list-6x-vertical, list-6x-vertical-slideimage, number-1x-box, number-1x-box-slideimage, number-1x-box-title-center, number-1x-box-title-center-slideimage, number-2x-box, number-2x-box-slideimage, number-2x-box-title-center, number-2x-box-title-center-slideimage, number-3x-box, number-3x-box-slideimage, number-3x-box-title-center, number-3x-box-title-center-slideimage, number-4x-box, number-4x-box-slideimage, number-4x-box-title-center, number-4x-box-title-center-slideimage, number-5x-box, number-5x-box-slideimage, number-5x-box-title-center, number-5x-box-title-center-slideimage, number-6x-box, number-6x-box-slideimage, number-6x-box-title-center, number-6x-box-title-center-slideimage, text-1x-box-title-center, text-1x-box-title-left, text-1x-center-box, text-1x-center-box-title-center, text-1x-center-box-title-left, text-1x-center-slideimage, text-1x-center-title-center-slideimage, text-1x-center-title-left-slideimage, text-1x-left-box, text-1x-left-slideimage, text-1x-title-center-slideimage, text-1x-title-left-slideimage, text-2x-box-title-center, text-2x-box-vertical-title-left, text-2x-center-box, text-2x-center-box-title-center, text-2x-center-box-vertical-title-left, text-2x-center-slideimage, text-2x-center-title-center-slideimage, text-2x-center-vertical-title-left, text-2x-center-vertical-title-left-slideimage, text-2x-left-box, text-2x-left-slideimage, text-2x-title-center-slideimage, text-2x-vertical-title-left, text-2x-vertical-title-left-slideimage, text-3x-box-title-center, text-3x-box-vertical-title-left, text-3x-center, text-3x-center-box, text-3x-center-box-title-center, text-3x-center-box-vertical-title-left, text-3x-center-slideimage, text-3x-center-title-center-slideimage, text-3x-center-vertical-title-left, text-3x-center-vertical-title-left-slideimage, text-3x-left, text-3x-left-box, text-3x-left-slideimage, text-3x-title-center-slideimage, text-3x-vertical-title-left, text-3x-vertical-title-left-slideimage, title-center-slideimage, title-center-slideimage-bottom, title-center-slideimage-top, title-left-slideimage, title-left-slideimage-bottom, title-left-slideimage-left, title-left-slideimage-right, title-left-slideimage-top, image-bleed

Preview/export disagreements (66):

- 66 x preview effect=true but export native=false

