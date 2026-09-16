# Developer adoption and full-tooling roadmap

The published baseline is core **0.10.1**, renderer/PPTX/CLI **0.8.1** and
editor **0.7.1** on Node 24. Shared header/footer geometry is in that set as
portable tagged-shape furniture (`OPF_FURNITURE_V1`, vendor `p:hf` off). That
is not native Office Header/Footer objects; those remain
[issue 87](https://github.com/OpenPresentation/opf/issues/87). Read the
[handoff](../handoff-2026-09-15.md) as a dated checkpoint, then
[the compatibility matrix](../compatibility-matrix.md) for current pins.

| Order | Deliverable | Definition of done |
| --- | --- | --- |
| 1 | Release the validated header/footer increment | **Published** portable geometry in core 0.10.1 with renderer 0.8.1, editor 0.7.1 and PPTX 0.8.1 (`furniture-flow-v2`, tagged PPTX shapes). That release does **not** compile headers/footers to native Office Header/Footer objects. Keep Native Office limitations explicit; do not describe PowerPoint furniture as done. |
| 2 | One clear developer starting path | Follow [the quickstart](../quickstart.md): a small independently installable example demonstrates JSON authoring, lint/validation, resolved offline fonts, measured composition/pagination, live editing with undo, SVG/PNG/PDF and editable PPTX export through documented APIs. Keep CLI commands accurate; the [compatibility matrix](../compatibility-matrix.md) is the supported/unsupported feature list. Audit skills and docs that still call released APIs unreleased. Verify TS/module/browser/Node boundaries and clean installation. |
| 3 | Consistent public-site feature adoption | Complete [issue88](https://github.com/OpenPresentation/opf/issues/88): keep home/playground JSON↔preview behavior, contextual choices and code editing; integrate loaded-context choices into pptx.dev Monaco and preview edits into inspector; improve gallery/docs interactive examples. Preserve each site's appearance and actual routes; verify production behavior, not just dependency manifests. |
| 4 | Font and text reliability | Resolve or narrowly split [the archived shaping stack](deferred-shaping-20260915.md) and [renderer24](https://github.com/OpenPresentation/opf-render/issues/24); fix the archived editor coverage-count assertion; define supported scripts/axes/fallback/bidi, caret/selection/IME, face identity and licenses. Keep unchanged native tolerances visible; do not advertise substitute fonts as universally pixel-identical. |
| 5 | Native PowerPoint portability | Finish [issue87](https://github.com/OpenPresentation/opf/issues/87) after host recovery is confirmed: compile OPF headers/footers to native Header/Footer objects (Insert → Header & Footer, notes master, `p:hf` date/slide-number/footer — **not** `OPF_FURNITURE_V1` slide shapes); open/edit/save/reopen pictures and furniture; current-content provenance; tabs; notes-master ordering; font identification/installation/embedding where permitted. Add macOS PowerPoint/Keynote evidence when available. Serialization and self-import do not certify Office. Tagged-shape furniture on npm does not close this row. |
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
