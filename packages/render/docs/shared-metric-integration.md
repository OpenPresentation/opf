# Metric source integration (unreleased)

Continue `codex/shared-metric-integration-20260910` alongside the same branch in OpenPresentation/opf, opf-pptx and opf-editor. This source requires the new core `metricLayout` contract; published core 0.9.0 does not provide it. No package version or registry/public-site dependency has changed.

SVG now consumes the shared accepted metric parts, resolved styles, line origins and tab segments. It preserves unit, label, description, zero-valued delta, literal trend text and source mappings. Optional empty fields stay in the source; the empty primary value retains a selectable box. Invalid XML characters fail with a field path and UTF-16 offset. No renderer-specific fitting is performed after composition.

With coordinated local source links, `npm run test:metric` passes 36 wide/portrait/alignment cases and 198 XML-boundary cases on Windows Node 20.20.2 and 24.20.0. Type/syntax/package validation and existing shared-code model/browser suites pass. The full renderer suite currently reaches a failing golden gate: 85 of 805 slide rasters changed against the previous shared-code baseline, with the same 126-deck source digest. These expected metric-related candidates still need individual visual review; the accepted baseline has not been replaced. Tests after that gate still need execution.

The core handoff and `docs/plans/shared-metric-integration.md` carry the coordinated browser/native evidence. Candidate tarball checks, complete CI/review and publication are open. Native metric source recovery passes its tested cases, but a right-aligned Calibri portrait label/unit fixture leaves the accepted cell in one native raster; source-model bounds and actual native pixel fidelity remain separate.
