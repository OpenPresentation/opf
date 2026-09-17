# Selectable text and vector PDF export

Status: accepted product requirement on September 10, 2026; implementation and release verification remain open. This plan extends the [ecosystem objective](ecosystem-objective-2026-09-09.md) and [font roadmap](font-roadmap.md). It does not mark any package or deployment as upgraded.

The [Mermaid and general SVG roadmap](diagrams-svg.md) is a coordinated input/export requirement: supported diagram text and drawing primitives must retain vector output and shared geometry, with explicit diagnostics for unsupported effects and raster fallbacks.

## Current behavior

Published renderer 0.7.0 exposes `svgToPdf`, which rasterizes each SVG slide to PNG and embeds that image on a PDF page. Tests cover page counts and dimensions, repeatable bytes, and actual embedded image pixels, including JPEG orientation and WebP transparency. Those checks do not establish selectable text, vector content, logical reading order or tagged accessibility.

## Required outcome

Make selectable, searchable text and vector drawing the default PDF output once the documented acceptance gates pass. Retain image-only PDF as an explicitly selected compatibility mode. All essential PDF generation must work locally and offline with open dependencies and bundled permitted fonts, without accounts, model calls or paid services.

Reuse the same accepted document, pagination, font resolution, shaped text and placement as preview. The PDF backend must not independently wrap, paginate, shrink, truncate or rewrite content. Preserve rich formatting, links and source reading order within the supported scope. The public API and mode names are to be designed; no new option is available merely because it appears in this plan.

Write visible text using PDF text objects with permitted embedded font subsets and correct Unicode mappings. Preserve resolved glyph positions, kerning, ligatures, combining marks and mixed-script behavior. Converting all glyphs to paths, or placing invisible text over a full-slide image, does not satisfy the vector-text requirement. Exact source recovery from copy/extraction needs its own tests; visual similarity is insufficient.

Keep supported shapes, rules, table borders and chart marks as vectors. Photos remain images. Rasterize only unsupported effects or regions when necessary, with path-specific diagnostics and a strict policy that can reject the fallback. A default vector export must not silently turn the entire slide into an image. Record requested/resolved fonts and embedding restrictions; never silently change fonts or bypass their permissions.

## Reviewable milestones

| Milestone | Deliverable | Acceptance gate |
| --- | --- | --- |
| Backend and contract | Evaluate open PDF libraries against accepted layout inputs; define vector and raster modes and fallback diagnostics | A local prototype preserves existing geometry without a second layout pass; API and dependency review complete |
| Text and fonts | Visible PDF text, font embedding/subsetting, Unicode mappings and rich-run placement | Search/copy and independent extraction retain the expected text, Unicode and order; fonts work without host installation |
| Drawing and effects | Vector shapes, tables and supported charts; images, clips, gradients and transparency | Full-slide appearance and geometry pass declared tolerances; every unsupported fallback is reported |
| Product integration | Supported API, CLI, editor/site export controls and documentation | The exact previewed pages export through fresh package installations and public browser workflows; raster mode remains available |
| Default rollout | Reviewed corpus, performance/size measurements and portable evidence | Supported Node versions and independent PDF viewers pass; limitations and remaining accessibility/platform gaps are published before changing the default |

## Verification matrix

- Inspect PDF content streams, fonts and Unicode mappings. Reject a full-slide image or outline-only text masquerading as vector/selectable output; verify no hidden duplicate text contaminates copy or extraction.
- Test actual selection, search and copy in PDF viewers, plus independent text extraction. Include punctuation, whitespace, ligatures, accents, decomposed marks, RTL/mixed scripts, links and symbols within explicitly declared font/script coverage.
- Rasterize the PDF independently and compare it with accepted browser/renderer output at declared sizes, zooms and tolerances. Check line breaks, baselines, clipping, overhangs, collisions, colors and complete slide appearance separately from extraction.
- Cover wide and portrait slides, sparse and dense layouts, nested blocks, rich text, lists, tables, charts, code, quotes and metrics. Include malformed inputs, unavailable/non-embeddable fonts, unsupported effects and irreducible overflow; failures must preserve source and identify the affected path.
- Verify repeatability with pinned font bytes, dependency versions and settings. Measure file size and generation time against the current raster mode without assuming vector output is always smaller or faster.
- Publish fresh registry-install and browser-download results when released. Keep prior raster-PDF evidence distinct from new vector/text evidence and from native PowerPoint fidelity.

Selectable text is a prerequisite for useful document semantics, not a tagged-accessibility certification. Structure tags, reading order, language, alternative text, screen-reader behavior and any PDF/UA or PDF/A claims require separate implementation and validation. No such conformance is claimed by this plan.
