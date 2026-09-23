# Dimension audit A: layouts, content blocks, image treatments, backgrounds, headers & footers

Commits: opf `2634350`, opf-render `e500ed9`, opf-pptx `ef8a158`, pptx-gallery `f17e9ae`. Node v24.21.0. Core bundled layout catalog: 30 records.

Method: gallery lib/opf-snippets.ts builders bundled with esbuild; @openpresentation/opf linked to local core dist; opf-render/opf-pptx from source; engine default text measurement (Office font registry probed separately); no Office/COM. Each value's OPF is the exact document the gallery page emits (lib/opf-snippets.ts). Checks: (1) core validatePresentation, (2) catalog/reference resolution, (3) opf-render SVG vs a baseline document without the dimension, (4) opf-pptx export + OPC parts + dimension-specific native XML, (5) opf-pptx fromPptx re-import, (6) docs/evidence + compatibility-matrix hits. "withAssets" re-runs values whose gallery snippet references undeclared `asset:*` ids with a real raster supplied.

| Dimension | Total | works | partial | schema-only | broken | gallery-only | withAssets variant | preview/export disagree |
|---|---|---|---|---|---|---|---|---|
| backgrounds | 6 | 2 | 4 | 0 | 0 | 0 | partial 1 | 4 |
| image-treatments | 15 | 0 | 0 | 15 | 0 | 0 | partial 9, schema-only 6 | 15 |
| headers-footers | 10 | 0 | 10 | 0 | 0 | 0 | n/a | 10 |
| blocks | 32 | 5 | 27 | 0 | 0 | 0 | n/a | 1 |
| layouts | 485 | 0 | 415 | 0 | 0 | 70 | n/a | 110 |

Font registry probe: 547/548 values throw `font-unavailable: No local font face for 'Aptos Display'.; font-unavailable: No local font face for 'Segoe UI Semibold'.; font-unavailable: No local font face for 'Georgia'.; font-unavailable: No local font face for 'Montserrat'.; font-unavailable: No local font face for 'Poppins'.; font-unavailable: No local font face for 'Grandview Display'.; font-unavailable: No local font face for 'Open Sans'.` when rendered with opf-render's `loadOfficeFontRegistry()` text measurement (the ecosystem-test configuration), because the default Aptos / Aptos Display scheme has no local face in that registry. All classifications below use the engine's default measurement.

Sensitivity: values that would be `works` if (a) a re-import that drops the layout id but emits any diagnostic counted as a pass and (b) gallery narrative slugs absent from the core narrative catalog were ignored: backgrounds 2/6, image-treatments 0/15, headers-footers 0/10, blocks 29/32, layouts 211/485.

## backgrounds

Top reasons (count):

- 3 x export has no native <a:pattFill> background
- 3 x gallery slug collapses to the #
- 3 x re-import does not return background type pattern
- 1 x export has no native <a:blipFill> background
- 1 x gallery snippet references asset:cover without an assets entry
- 1 x preview diagnostics: unresolved-asset
- 1 x re-import does not return background type image

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| solid-color | works |  |  |
| subtle-gradient | works |  |  |
| geometric-pattern | partial |  | export has no native <a:pattFill> background; re-import does not return background type pattern; gallery slug collapses to the same OPF background as abstract-shapes, minimal-texture (treatment identity not representable) |
| photography | partial | partial | export has no native <a:blipFill> background; re-import does not return background type image; preview diagnostics: unresolved-asset; gallery snippet references asset:cover without an assets entry |
| abstract-shapes | partial |  | export has no native <a:pattFill> background; re-import does not return background type pattern; gallery slug collapses to the same OPF background as geometric-pattern, minimal-texture (treatment identity not representable) |
| minimal-texture | partial |  | export has no native <a:pattFill> background; re-import does not return background type pattern; gallery slug collapses to the same OPF background as geometric-pattern, abstract-shapes (treatment identity not representable) |

Preview/export disagreements (4):

- 4 x preview effect=true but export native=false
- 1 x diagnostics differ: preview[unresolved-asset] export[]

## image-treatments

Top reasons (count):

- 15 x export adds no native picture for design.slideImage
- 15 x gallery snippet references asset:hero without an assets entry
- 15 x no visible effect in preview or export
- 15 x preview diagnostics: unresolved-asset
- 15 x preview identical with and without design.slideImage/imageFill
- 15 x re-import drops design.slideImage (diagnostics: heading-import-reflow)
- 13 x treatment collapses to {#:#,#:#}, #

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| full-bleed | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to text-overlay, caption-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| text-overlay | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, caption-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| side-by-side | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; gallery snippet references asset:hero without an assets entry |
| caption-overlay | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, duotone, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| masked-shape | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to circular-crop, rounded-card, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| circular-crop | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, rounded-card, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| rounded-card | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, collage-grid, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| duotone | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, background-blur, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| background-blur | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, watermark, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| image-strip | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; gallery snippet references asset:hero without an assets entry |
| collage-grid | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, device-frame, cutout-subject; gallery snippet references asset:hero without an assets entry |
| device-frame | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, collage-grid, cutout-subject; gallery snippet references asset:hero without an assets entry |
| cutout-subject | schema-only | schema-only | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"right","fill":"fit"}, identical OPF to masked-shape, circular-crop, rounded-card, collage-grid, device-frame; gallery snippet references asset:hero without an assets entry |
| watermark | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, background-blur, cinematic-crop; gallery snippet references asset:hero without an assets entry |
| cinematic-crop | schema-only | partial | no visible effect in preview or export; preview identical with and without design.slideImage/imageFill; export adds no native picture for design.slideImage; re-import drops design.slideImage (diagnostics: heading-import-reflow); preview diagnostics: unresolved-asset; treatment collapses to {"position":"background","fill":"crop"}, identical OPF to full-bleed, text-overlay, caption-overlay, duotone, background-blur, watermark; gallery snippet references asset:hero without an assets entry |

Preview/export disagreements (15):

- 15 x diagnostics differ: preview[unresolved-asset] export[]

Note: the gallery `/editor?config=image-treatments:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## headers-footers

Top reasons (count):

- 10 x slide number exported as static text run, not an a:fld type=# field (does not renumber in PowerPoint)
- 3 x date requested but no native datetime field in export
- 3 x export diagnostics: unresolved-content
- 3 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted)
- 3 x preview diagnostics: unresolved-content
- 3 x re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow)
- 2 x #
- 2 x gallery config not expressed in snippet: dateFormat # (only date:true emitted); date and slideNumber merged into one footer.right slot
- 2 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat #
- 1 x gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); dateFormat # (only date:true emitted

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| slide-number-only | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); identical OPF to slide-number-progress |
| slide-number-progress | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat "{current} / {total}"; identical OPF to slide-number-only |
| section-marker-header | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted) |
| dated-footer | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); dateFormat "MMM d, yyyy" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| brand-logo-footer | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted) |
| client-delivery-footer | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: dateFormat "MMM yyyy" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| confidential-legal-footer | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint) |
| classification-banner | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: legalLine (classificationLine wins footer.center) |
| version-control-footer | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); date requested but no native datetime field in export; re-import loses furniture (diagnostics: invalid-furniture-provenance,heading-import-reflow); preview diagnostics: unresolved-content; export diagnostics: unresolved-content; gallery config not expressed in snippet: dateFormat "yyyy-MM-dd" (only date:true emitted); date and slideNumber merged into one footer.right slot |
| appendix-numbering | partial |  | slide number exported as static text run, not an a:fld type="slidenum" field (does not renumber in PowerPoint); gallery config not expressed in snippet: hideOnTitleSlide (no slide-level header/footer:false emitted); slideNumberFormat "A-{current}" |

Preview/export disagreements (10):

- 10 x preview effect=true but export native=false

Note: the gallery `/editor?config=headers-footers:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## blocks

Top reasons (count):

- 6 x unresolved references: narrative:pyramid-principle
- 6 x unresolved references: narrative:what-so-what-now-what
- 3 x unresolved references: narrative:data-story
- 3 x unresolved references: narrative:sparkline
- 3 x unresolved references: narrative:star-method
- 2 x export missing # expected strings as native text #
- 2 x preview missing # expected strings #
- 2 x unresolved references: narrative:heros-journey
- 2 x unresolved references: narrative:situation-complication-resolution
- 1 x preview diagnostics: text-overflow

| Value | Class | withAssets | Reasons |
|---|---|---|---|
| pitch-deck-intro | works |  |  |
| agenda-overview | partial |  | unresolved references: narrative:what-so-what-now-what |
| section-break | partial |  | unresolved references: narrative:pyramid-principle |
| executive-summary | partial |  | unresolved references: narrative:pyramid-principle |
| problem-statement | works |  |  |
| solution-overview | works |  |  |
| market-opportunity | partial |  | preview missing 1 expected strings (e.g. 0:$420M beachhead); export missing 1 expected strings as native text (e.g. 0:$420M beachhead); unresolved references: narrative:situation-complication-resolution |
| value-proposition | partial |  | unresolved references: narrative:sparkline |
| business-model | partial |  | unresolved references: narrative:pyramid-principle |
| decision-brief | partial |  | unresolved references: narrative:pyramid-principle |
| kpi-dashboard | partial |  | unresolved references: narrative:data-story |
| financial-snapshot | partial |  | preview missing 4 expected strings (e.g. 0:Revenue +22%); export missing 4 expected strings as native text (e.g. 0:Revenue +22%); unresolved references: narrative:data-story; preview diagnostics: text-overflow |
| traction-metrics | partial |  | unresolved references: narrative:sparkline |
| data-story-insight | partial |  | unresolved references: narrative:data-story |
| comparison-table | partial |  | unresolved references: narrative:pyramid-principle |
| before-after-story | partial |  | unresolved references: narrative:change-story |
| swot-snapshot | partial |  | unresolved references: narrative:situation-complication-resolution |
| pricing-options | works |  |  |
| roadmap-timeline | partial |  | unresolved references: narrative:vision-roadmap |
| milestone-timeline | partial |  | unresolved references: narrative:what-so-what-now-what |
| process-overview | partial |  | unresolved references: narrative:what-so-what-now-what |
| customer-journey | partial |  | unresolved references: narrative:heros-journey |
| implementation-plan | partial |  | unresolved references: narrative:what-so-what-now-what |
| team-grid | partial |  | unresolved references: narrative:star-method |
| quote-slide | partial |  | re-import loses payload kinds 0:quote (diagnostics: heading-import-reflow); unresolved references: narrative:heros-journey |
| testimonial-wall | partial |  | unresolved references: narrative:star-method |
| customer-logo-proof | partial |  | unresolved references: narrative:sparkline |
| case-study-snapshot | partial |  | unresolved references: narrative:star-method |
| closing-cta | works |  |  |
| qa-discussion | partial |  | unresolved references: narrative:what-so-what-now-what |
| recap-takeaways | partial |  | unresolved references: narrative:what-so-what-now-what |
| appendix-index | partial |  | unresolved references: narrative:pyramid-principle |

Preview/export disagreements (1):

- 1 x diagnostics differ: preview[text-overflow] export[]

Note: the gallery `/editor?config=blocks:<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.

## layouts

Top reasons (count):

- 167 x re-import drops layout id (diagnostics: heading-import-reflow)
- 110 x export shape placement ignores layout that changes preview (preview/export disagree)
- 98 x layout resolves but geometry is identical to the no-layout default in both preview and export (no distinguishable effect)
- 81 x re-import drops layout id silently (geometry flattened)
- 70 x legacy gallery slug with no OPF canonical id; portable only via inline catalogs.layouts.records
- 52 x re-import drops layout id (diagnostics: heading-import-reflow,text-import-reflow)
- 48 x re-import drops layout id (diagnostics: content-card-reflow,heading-import-reflow)
- 24 x re-import drops layout id (diagnostics: content-card-reflow)
- 23 x re-import drops layout id (diagnostics: heading-import-reflow,unsupported-image-crop)
- 16 x re-import drops layout id (diagnostics: content-card-reflow,heading-import-reflow,text-import-reflow)

Measured class by origin (gallery-only legacy slugs shown by their measured class):

| Origin | works | partial | schema-only | broken |
|---|---|---|---|---|
| core-catalog / master Dark | 0 | 15 | 0 | 0 |
| core-catalog / master OPF | 0 | 15 | 0 | 0 |
| gallery-inline-record / master Dark | 0 | 385 | 0 | 0 |
| gallery-inline-record / master Gallery | 0 | 70 | 0 | 0 |

Works (0): none

Preview/export disagreements (110):

- 110 x preview effect=true but export native=false

