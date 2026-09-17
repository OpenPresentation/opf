# Developer adoption and full-tooling roadmap

The published baseline is core **0.10.1**, renderer/PPTX/CLI **0.8.1** and
editor **0.7.1** on Node 24. Shared header/footer geometry (`furniture-flow-v2`)
is in that set. PPTX furniture is tagged slide shapes (`OPF_FURNITURE_V1`), not
native Office Header/Footer (`p:hf` / notes master). Read the
[16 Sep handoff](../handoff-2026-09-16.md), then
[the compatibility matrix](../compatibility-matrix.md) for current pins.
[PR 91](https://github.com/OpenPresentation/opf/pull/91) merged the in-repo
quickstart onto `main`. Issue88 Inspector overlay/json-options, gallery
Playground+Editor links, and the Header & footer playground example are live
on production (`17de6da` / `c7d3754` / `ea0d032`); GitHub issue 88 stays
**open**. Native Office (issue 87) and renderer issue 24 remain deferred.
**Do not mark this milestone complete.** Do not implement `p:hf`.

| Order | Deliverable | Definition of done |
| --- | --- | --- |
| 1 | Release the validated header/footer increment | **Published** in core 0.10.1 with renderer 0.8.1, editor 0.7.1 and PPTX 0.8.1. Native Office limitations stay explicit. |
| 2 | One clear developer starting path | **On main via [PR 91](https://github.com/OpenPresentation/opf/pull/91).** Follow [the quickstart](../quickstart.md): a small independently installable example demonstrates JSON authoring, lint/validation, resolved offline fonts, measured composition/pagination, live editing with undo, SVG/PNG/PDF and editable PPTX export through documented APIs. Keep CLI commands accurate; the [compatibility matrix](../compatibility-matrix.md) is the supported/unsupported feature list. Bundled tarball copy can still call furniture unpublished — that is stale docs, not a missing API. Browser/production verification of this example is still separate from the Node registry install. |
| 3 | Consistent public-site feature adoption | **Production (2026-09-17):** Inspector overlay + Author json-options on `www.pptx.dev` (`17de6da`); gallery Playground+Editor links on `www.pptx.gallery` (`c7d3754`); Header & footer playground example on `www.openpresentation.org` (`ea0d032`). GitHub [issue88](https://github.com/OpenPresentation/opf/issues/88) remains **open** (homepage `/` baseline, docs/stale API audit, overlay stacked-click intercept). Geometry drafts and homepage-renderer are not this deliverable. |
| 4 | Font and text reliability | Resolve or narrowly split [the archived shaping stack](deferred-shaping-20260915.md) and [renderer24](https://github.com/OpenPresentation/opf-render/issues/24); fix the archived editor coverage-count assertion; define supported scripts/axes/fallback/bidi, caret/selection/IME, face identity and licenses. Keep unchanged native tolerances visible; do not advertise substitute fonts as universally pixel-identical. |
| 5 | Native PowerPoint portability | Finish [issue87](https://github.com/OpenPresentation/opf/issues/87) after host recovery is confirmed: open/edit/save/reopen pictures and furniture, compile furniture into real Office Header/Footer objects (`p:hf` / notes master) rather than tagged slide shapes, current-content provenance, tabs, notes-master ordering and font identification/installation/embedding where permitted. Add macOS PowerPoint/Keynote evidence when available. Serialization, self-import and `OPF_FURNITURE_V1` tags do not certify Office. |
| 6 | Broad deterministic layout and repair | Extend existing shared geometry, candidate scoring, readability floors and pagination into a documented repair loop across nested groups and dense charts/tables. Cover collisions, unseen content, multiple dimensions and bounded failure. Expose the accepted operations consistently through API/CLI/canvas preview+undo, respecting human adjustments. Preserve all content and reading order; regression hashes alone do not establish visual quality. |
| 7 | Full editor interaction coverage | Maintain [the feature matrix](spec-editor-coverage.md) for visual and nonvisual fields separately: table/chart manipulation, contextual catalogs, assets/crop/effects, language/IME/keyboard/accessibility and lifetime cleanup, slide navigation/presenter behavior and media. Schema-property access does not establish full WYSIWYG support. |
| 8 | Selectable vector PDF | Implement [the PDF plan](pdf-export.md) after font reliability: legal embedding/subsetting, real selectable/searchable text, Unicode mapping, exact accepted pages, independent extraction and raster checks. Current PDF is raster-backed. Accessibility/tagged conformance needs separate evidence. |
| 9 | General SVG and semantic diagrams | Follow [the SVG/Mermaid plan](diagrams-svg.md) after the font prerequisite: sanitized local vector assets, a diagram source/model contract, reversible source/canvas editing and supported editable exports; retain the full diagram-family roadmap. Embedded SVG is not automatically native editable primitives. |
| Ongoing | Reliable distribution and hosting | Keep Node24 and locked package managers, safe skill installation/update, meaningful lint/contracts, tested dependency updates, clean package consumers, bundle/font verification, public demos and an honest compatibility matrix. Host persistence/collaboration/optional AI remain explicit application concerns. |

## Developer readiness gate

A developer must be able to follow the quickstart in a fresh Node24 project,
install the published versions, author/validate/edit/paginate a representative
deck, preview with the same resolved fonts, and export supported editable PPTX
without an account, model call or hidden sibling checkout. Source and undo must
survive errors. Any unsupported font, content, asset or native behavior must
produce an actionable documented result. Verify the same example in a real
browser and as an installed package, then link the exact versioned evidence.

This is readiness for a documented supported subset, not universal Office or
all-feature parity. The broader [accepted ecosystem objective](ecosystem-objective-2026-09-09.md)
remains open. Complete work in bounded reviewable milestones, with commits,
PRs, actual checks, registry verification and public deployment evidence.
