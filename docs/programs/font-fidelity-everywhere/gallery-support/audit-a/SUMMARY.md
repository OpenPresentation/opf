# Dimension audit A: layouts, content blocks, image treatments, backgrounds, headers & footers

Commits: opf `2e838f5`, opf-render `0ce9bb9`, opf-pptx `e4c0c4b`, pptx-gallery `9e8d59a`. Node v24.21.0. Core bundled layout catalog: 100 records.

Method: gallery lib/opf-snippets.ts builders bundled with esbuild; @openpresentation/opf linked to local core dist; opf-render/opf-pptx from source; engine default text measurement for geometry and text; font availability against the gallery preview host model (parity/scripts/font-host.mjs); no Office/COM. Each value's OPF is the exact document the gallery page emits (lib/opf-snippets.ts). Checks: (1) core validatePresentation, (2) catalog/reference resolution, (3) opf-render SVG vs a baseline document without the dimension, (4) opf-pptx export + OPC parts + dimension-specific native XML, (5) opf-pptx fromPptx re-import, (6) docs/evidence + compatibility-matrix hits. "withAssets" re-runs values whose gallery snippet references undeclared `asset:*` ids with a real raster supplied.

| Dimension | Total | works | partial | schema-only | broken | gallery-only | withAssets variant | preview/export disagree |
|---|---|---|---|---|---|---|---|---|
| backgrounds | 6 | 6 | 0 | 0 | 0 | 0 | works 1 | 0 |
| image-treatments | 15 | 15 | 0 | 0 | 0 | 0 | works 15 | 0 |
| headers-footers | 10 | 10 | 0 | 0 | 0 | 0 | works 1 | 0 |
| blocks | 32 | 32 | 0 | 0 | 0 | 0 | n/a | 0 |
| layouts | 485 | 485 | 0 | 0 | 0 | 0 | n/a | 0 |

Preview font host (FF-48): the `gallery` model (parity/scripts/font-host.mjs: the gallery editor's browser registry and font gate, `ensureLazyFonts` and `ensureScripts` on the value's own document, then a strict measured render with that registry). 0/548 values cannot be drawn by the modelled host. A preview that draws the FF-31 policy table's look-alike with the PPTX naming the selected family is not a gap (owner font policy, 2026-09-29), so no value gets a font reason. Geometry, text and diagnostics use the engine's default measurement, as in the parity harness.

Sensitivity: values that would be `works` if (a) a re-import that drops the layout id but emits any diagnostic counted as a pass and (b) gallery narrative slugs absent from the core narrative catalog were ignored: backgrounds 6/6, image-treatments 15/15, headers-footers 10/10, blocks 32/32, layouts 485/485.

## backgrounds

Top reasons (count):


| Value | Class | withAssets | Reasons |
|---|---|---|---|
| solid-color | works |  |  |
| subtle-gradient | works |  |  |
| geometric-pattern | works |  |  |
| photography | works | works |  |
| abstract-shapes | works |  |  |
| minimal-texture | works |  |  |

## image-treatments

Top reasons (count):


| Value | Class | withAssets | Reasons |
|---|---|---|---|
| full-bleed | works | works |  |
| text-overlay | works | works |  |
| side-by-side | works | works |  |
| caption-overlay | works | works |  |
| masked-shape | works | works |  |
| circular-crop | works | works |  |
| rounded-card | works | works |  |
| duotone | works | works |  |
| background-blur | works | works |  |
| image-strip | works | works |  |
| collage-grid | works | works |  |
| device-frame | works | works |  |
| cutout-subject | works | works |  |
| watermark | works | works |  |
| cinematic-crop | works | works |  |

## headers-footers

Top reasons (count):


| Value | Class | withAssets | Reasons |
|---|---|---|---|
| slide-number-only | works |  |  |
| slide-number-progress | works |  |  |
| section-marker-header | works |  |  |
| dated-footer | works |  |  |
| brand-logo-footer | works | works |  |
| client-delivery-footer | works |  |  |
| confidential-legal-footer | works |  |  |
| classification-banner | works |  |  |
| version-control-footer | works |  |  |
| appendix-numbering | works |  |  |

## blocks

Top reasons (count):


| Value | Class | withAssets | Reasons |
|---|---|---|---|
| pitch-deck-intro | works |  |  |
| agenda-overview | works |  |  |
| section-break | works |  |  |
| executive-summary | works |  |  |
| problem-statement | works |  |  |
| solution-overview | works |  |  |
| market-opportunity | works |  |  |
| value-proposition | works |  |  |
| business-model | works |  |  |
| decision-brief | works |  |  |
| kpi-dashboard | works |  |  |
| financial-snapshot | works |  |  |
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
| quote-slide | works |  |  |
| testimonial-wall | works |  |  |
| customer-logo-proof | works |  |  |
| case-study-snapshot | works |  |  |
| closing-cta | works |  |  |
| qa-discussion | works |  |  |
| recap-takeaways | works |  |  |
| appendix-index | works |  |  |

## layouts

Top reasons (count):


Measured class by origin (gallery-only legacy slugs shown by their measured class):

| Origin | works | partial | schema-only | broken |
|---|---|---|---|---|
| core-catalog / master Dark | 15 | 0 | 0 | 0 |
| core-catalog / master Gallery | 70 | 0 | 0 | 0 |
| core-catalog / master OPF | 15 | 0 | 0 | 0 |
| gallery-inline-record / master Dark | 385 | 0 | 0 | 0 |

Works (485): title-slide, two-column, image-focus, data-visualization, quote-highlight, section-divider, agenda, thank-you-cta, bullet-list, three-column, icon-grid, faq, stats-metrics, comparison, swot-analysis, matrix-quadrant, funnel-pyramid, timeline, process-flow, photo-grid, before-after, testimonial-grid, team-bio, pricing-table, roadmap, product-feature, executive-summary, key-takeaway, chapter-recap, qa-discussion, single-message-statement, one-column-explainer, case-study, pros-cons, feature-comparison-matrix, venn-overlap, decision-tree, kpi-scorecard, dashboard, waterfall-bridge, benchmark-target-table, heatmap-cohort, risk-heatmap, forecast-scenario, swimlane-process, gantt-project-plan, circular-lifecycle, customer-journey, org-chart, capability-map, logic-tree, hub-and-spoke, architecture-stack, ecosystem-map, network-dependency-map, wheel-radial, geographic-map, screenshot-walkthrough, market-size, persona-grid, competitive-landscape, business-model-canvas, customer-logos, executive-decision, status-rag, raci-matrix, action-plan, assumptions-dependencies, appendix-index, detailed-data-table, chart-1x, chart-1x-slideimage, chart-1x-title-center, chart-1x-title-center-slideimage, chart-1x-title-left, chart-1x-title-left-slideimage, chart-2x, chart-2x-slideimage, chart-2x-title-center, chart-2x-title-center-slideimage, chart-2x-vertical-title-left, chart-2x-vertical-title-left-slideimage, chart-3x, chart-3x-bottom-vertical-title-left, chart-3x-bottom-vertical-title-left-slideimage, chart-3x-left, chart-3x-left-slideimage, chart-3x-left-title-center, chart-3x-left-title-center-slideimage, chart-3x-right, chart-3x-right-slideimage, chart-3x-right-title-center, chart-3x-right-title-center-slideimage, chart-3x-slideimage, chart-3x-title-center, chart-3x-title-center-slideimage, chart-3x-top-vertical-title-left, chart-3x-top-vertical-title-left-slideimage, image-1x-crop, image-1x-crop-slideimage, image-1x-crop-title-center, image-1x-crop-title-center-slideimage, image-1x-crop-title-left, image-1x-crop-title-left-slideimage, image-1x-fit, image-1x-fit-slideimage, image-1x-fit-title-center, image-1x-fit-title-center-slideimage, image-1x-fit-title-left, image-1x-fit-title-left-slideimage, image-2x-crop, image-2x-crop-slideimage, image-2x-crop-title-center, image-2x-crop-title-center-slideimage, image-2x-crop-vertical, image-2x-crop-vertical-slideimage, image-2x-crop-vertical-title-left, image-2x-crop-vertical-title-left-slideimage, image-2x-fit, image-2x-fit-slideimage, image-2x-fit-title-center, image-2x-fit-title-center-slideimage, image-2x-fit-vertical, image-2x-fit-vertical-slideimage, image-2x-fit-vertical-title-left, image-2x-fit-vertical-title-left-slideimage, image-3x-crop, image-3x-crop-slideimage, image-3x-crop-title-center, image-3x-crop-title-center-slideimage, image-3x-crop-vertical, image-3x-crop-vertical-slideimage, image-3x-crop-vertical-title-left, image-3x-crop-vertical-title-left-slideimage, image-3x-fit, image-3x-fit-slideimage, image-3x-fit-title-center, image-3x-fit-title-center-slideimage, image-3x-fit-vertical, image-3x-fit-vertical-slideimage, image-3x-fit-vertical-title-left, image-3x-fit-vertical-title-left-slideimage, image-only-1x-crop, image-only-1x-crop-slideimage, image-only-1x-crop-title-center, image-only-1x-crop-title-center-slideimage, image-only-1x-crop-title-left, image-only-1x-crop-title-left-slideimage, image-only-1x-fit, image-only-1x-fit-slideimage, image-only-1x-fit-title-center, image-only-1x-fit-title-center-slideimage, image-only-1x-fit-title-left, image-only-1x-fit-title-left-slideimage, image-only-2x-crop, image-only-2x-crop-slideimage, image-only-2x-crop-title-center, image-only-2x-crop-title-center-slideimage, image-only-2x-crop-vertical, image-only-2x-crop-vertical-slideimage, image-only-2x-crop-vertical-title-left, image-only-2x-crop-vertical-title-left-slideimage, image-only-2x-fit, image-only-2x-fit-slideimage, image-only-2x-fit-title-center, image-only-2x-fit-title-center-slideimage, image-only-2x-fit-vertical, image-only-2x-fit-vertical-slideimage, image-only-2x-fit-vertical-title-left, image-only-2x-fit-vertical-title-left-slideimage, image-only-3x-crop, image-only-3x-crop-slideimage, image-only-3x-crop-title-center, image-only-3x-crop-title-center-slideimage, image-only-3x-crop-vertical, image-only-3x-crop-vertical-slideimage, image-only-3x-crop-vertical-title-left, image-only-3x-crop-vertical-title-left-slideimage, image-only-3x-fit, image-only-3x-fit-slideimage, image-only-3x-fit-title-center, image-only-3x-fit-title-center-slideimage, image-only-3x-fit-vertical, image-only-3x-fit-vertical-slideimage, image-only-3x-fit-vertical-title-left, image-only-3x-fit-vertical-title-left-slideimage, list-1x, list-1x-box, list-1x-box-slideimage, list-1x-box-title-center, list-1x-box-title-center-slideimage, list-1x-box-vertical, list-1x-box-vertical-slideimage, list-1x-box-vertical-title-center, list-1x-box-vertical-title-center-slideimage, list-1x-box-vertical-title-left, list-1x-box-vertical-title-left-slideimage, list-1x-itemimage, list-1x-itemimage-slideimage, list-1x-itemimage-title-center, list-1x-itemimage-title-center-slideimage, list-1x-itemimage-vertical, list-1x-itemimage-vertical-slideimage, list-1x-itemimage-vertical-title-center, list-1x-itemimage-vertical-title-center-slideimage, list-1x-itemimage-vertical-title-left, list-1x-itemimage-vertical-title-left-slideimage, list-1x-slideimage, list-1x-title-center, list-1x-title-center-slideimage, list-1x-vertical, list-1x-vertical-slideimage, list-1x-vertical-title-center, list-1x-vertical-title-center-slideimage, list-1x-vertical-title-left, list-1x-vertical-title-left-slideimage, list-2x, list-2x-box, list-2x-box-slideimage, list-2x-box-title-center, list-2x-box-title-center-slideimage, list-2x-box-vertical, list-2x-box-vertical-slideimage, list-2x-box-vertical-title-center, list-2x-box-vertical-title-center-slideimage, list-2x-box-vertical-title-left, list-2x-box-vertical-title-left-slideimage, list-2x-itemimage, list-2x-itemimage-slideimage, list-2x-itemimage-title-center, list-2x-itemimage-title-center-slideimage, list-2x-itemimage-vertical, list-2x-itemimage-vertical-slideimage, list-2x-itemimage-vertical-title-center, list-2x-itemimage-vertical-title-center-slideimage, list-2x-itemimage-vertical-title-left, list-2x-itemimage-vertical-title-left-slideimage, list-2x-slideimage, list-2x-title-center, list-2x-title-center-slideimage, list-2x-vertical, list-2x-vertical-slideimage, list-2x-vertical-title-center, list-2x-vertical-title-center-slideimage, list-2x-vertical-title-left, list-2x-vertical-title-left-slideimage, list-3x, list-3x-box, list-3x-box-slideimage, list-3x-box-title-center, list-3x-box-title-center-slideimage, list-3x-box-vertical, list-3x-box-vertical-slideimage, list-3x-box-vertical-title-center, list-3x-box-vertical-title-center-slideimage, list-3x-box-vertical-title-left, list-3x-box-vertical-title-left-slideimage, list-3x-itemimage, list-3x-itemimage-slideimage, list-3x-itemimage-title-center, list-3x-itemimage-title-center-slideimage, list-3x-itemimage-vertical, list-3x-itemimage-vertical-slideimage, list-3x-itemimage-vertical-title-center, list-3x-itemimage-vertical-title-center-slideimage, list-3x-itemimage-vertical-title-left, list-3x-itemimage-vertical-title-left-slideimage, list-3x-slideimage, list-3x-title-center, list-3x-title-center-slideimage, list-3x-vertical, list-3x-vertical-slideimage, list-3x-vertical-title-center, list-3x-vertical-title-center-slideimage, list-3x-vertical-title-left, list-3x-vertical-title-left-slideimage, list-4x, list-4x-box, list-4x-box-slideimage, list-4x-box-title-center, list-4x-box-title-center-slideimage, list-4x-box-vertical, list-4x-box-vertical-slideimage, list-4x-box-vertical-title-center, list-4x-box-vertical-title-center-slideimage, list-4x-box-vertical-title-left, list-4x-box-vertical-title-left-slideimage, list-4x-itemimage, list-4x-itemimage-slideimage, list-4x-itemimage-title-center, list-4x-itemimage-title-center-slideimage, list-4x-itemimage-vertical, list-4x-itemimage-vertical-slideimage, list-4x-itemimage-vertical-title-center, list-4x-itemimage-vertical-title-center-slideimage, list-4x-itemimage-vertical-title-left, list-4x-itemimage-vertical-title-left-slideimage, list-4x-slideimage, list-4x-title-center, list-4x-title-center-slideimage, list-4x-vertical, list-4x-vertical-slideimage, list-4x-vertical-title-center, list-4x-vertical-title-center-slideimage, list-4x-vertical-title-left, list-4x-vertical-title-left-slideimage, list-5x, list-5x-box, list-5x-box-slideimage, list-5x-box-title-center, list-5x-box-title-center-slideimage, list-5x-box-vertical, list-5x-box-vertical-slideimage, list-5x-box-vertical-title-center, list-5x-box-vertical-title-center-slideimage, list-5x-box-vertical-title-left, list-5x-box-vertical-title-left-slideimage, list-5x-itemimage, list-5x-itemimage-slideimage, list-5x-itemimage-title-center, list-5x-itemimage-title-center-slideimage, list-5x-itemimage-vertical, list-5x-itemimage-vertical-slideimage, list-5x-itemimage-vertical-title-center, list-5x-itemimage-vertical-title-center-slideimage, list-5x-itemimage-vertical-title-left, list-5x-itemimage-vertical-title-left-slideimage, list-5x-slideimage, list-5x-title-center, list-5x-title-center-slideimage, list-5x-vertical, list-5x-vertical-slideimage, list-5x-vertical-title-center, list-5x-vertical-title-center-slideimage, list-5x-vertical-title-left, list-5x-vertical-title-left-slideimage, list-6x, list-6x-box, list-6x-box-slideimage, list-6x-box-title-center, list-6x-box-title-center-slideimage, list-6x-box-vertical, list-6x-box-vertical-slideimage, list-6x-box-vertical-title-center, list-6x-box-vertical-title-center-slideimage, list-6x-box-vertical-title-left, list-6x-box-vertical-title-left-slideimage, list-6x-heading-title-center, list-6x-heading-title-center-slideimage, list-6x-itemimage, list-6x-itemimage-slideimage, list-6x-itemimage-title-center, list-6x-itemimage-title-center-slideimage, list-6x-itemimage-vertical, list-6x-itemimage-vertical-slideimage, list-6x-itemimage-vertical-title-center, list-6x-itemimage-vertical-title-center-slideimage, list-6x-itemimage-vertical-title-left, list-6x-itemimage-vertical-title-left-slideimage, list-6x-slideimage, list-6x-title-center, list-6x-title-center-slideimage, list-6x-vertical, list-6x-vertical-slideimage, list-6x-vertical-title-center, list-6x-vertical-title-center-slideimage, list-6x-vertical-title-left, list-6x-vertical-title-left-slideimage, number-1x, number-1x-box, number-1x-box-slideimage, number-1x-box-title-center, number-1x-box-title-center-slideimage, number-1x-title-center, number-2x, number-2x-box, number-2x-box-slideimage, number-2x-box-title-center, number-2x-box-title-center-slideimage, number-2x-title-center, number-3x, number-3x-box, number-3x-box-slideimage, number-3x-box-title-center, number-3x-box-title-center-slideimage, number-3x-title-center, number-4x, number-4x-box, number-4x-box-slideimage, number-4x-box-title-center, number-4x-box-title-center-slideimage, number-4x-title-center, number-5x, number-5x-box, number-5x-box-slideimage, number-5x-box-title-center, number-5x-box-title-center-slideimage, number-5x-title-center, number-6x, number-6x-box, number-6x-box-slideimage, number-6x-box-title-center, number-6x-box-title-center-slideimage, number-6x-title-center, text-1x-box-title-center, text-1x-box-title-left, text-1x-center, text-1x-center-box, text-1x-center-box-title-center, text-1x-center-box-title-left, text-1x-center-slideimage, text-1x-center-title-center, text-1x-center-title-center-slideimage, text-1x-center-title-left, text-1x-center-title-left-slideimage, text-1x-left, text-1x-left-box, text-1x-left-slideimage, text-1x-title-center, text-1x-title-center-slideimage, text-1x-title-left, text-1x-title-left-slideimage, text-2x-box-title-center, text-2x-box-vertical-title-left, text-2x-center, text-2x-center-box, text-2x-center-box-title-center, text-2x-center-box-vertical-title-left, text-2x-center-slideimage, text-2x-center-title-center, text-2x-center-title-center-slideimage, text-2x-center-vertical-title-left, text-2x-center-vertical-title-left-slideimage, text-2x-left, text-2x-left-box, text-2x-left-slideimage, text-2x-title-center, text-2x-title-center-slideimage, text-2x-vertical-title-left, text-2x-vertical-title-left-slideimage, text-3x-box-title-center, text-3x-box-vertical-title-left, text-3x-center, text-3x-center-box, text-3x-center-box-title-center, text-3x-center-box-vertical-title-left, text-3x-center-slideimage, text-3x-center-title-center, text-3x-center-title-center-slideimage, text-3x-center-vertical-title-left, text-3x-center-vertical-title-left-slideimage, text-3x-left, text-3x-left-box, text-3x-left-slideimage, text-3x-title-center, text-3x-title-center-slideimage, text-3x-vertical-title-left, text-3x-vertical-title-left-slideimage, title-center, title-center-box, title-center-slideimage, title-center-slideimage-bottom, title-center-slideimage-top, title-left, title-left-box, title-left-slideimage, title-left-slideimage-bottom, title-left-slideimage-left, title-left-slideimage-right, title-left-slideimage-top, blank, code-1x, image-1x, image-2x, image-3x, image-bleed, media-1x, quote-1x, table-1x, text-1x, text-2x, text-3x, timeline-1x, title, title-subtitle

