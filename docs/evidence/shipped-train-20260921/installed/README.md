# Shipped train installed acceptance — 2026-09-21

Passed on v24.21.0, macOS, Chromium 153.0.8010.12. Five exact npm packages were freshly installed; all 617 installed archive files match registry integrity. Release tags peel to npm gitHead. All shipped runtime files were unchanged after acceptance.

- Core 0.11.0; CLI 0.9.0; renderer 0.9.0; PPTX 0.9.1; editor 0.8.0.
- Quickstart: 4 authored slides become 6 pages; offline bundled fonts, CLI validation/lint/pagination, editor undo, SVG/PNG/PDF/editable PPTX.
- Furniture: 16 deterministic native OOXML exports; 37 validated provenance imports with 12 damaged-tag controls; 5 focused reimport probes.
- Browser: 16 furniture workflows, 12 renderer code cases, 2 editor code cases plus 2 blank targets. Zero external requests or browser errors.
- ColorRef renderer/export supported paths and fallback controls pass.

See acceptance-summary.json for scope, manifest.json for immutable harness/fixture hashes, package-lock.json and registry-*.json for registry pins and integrity. Original failed setup logs are retained; two verifier-only setup corrections and passing targeted reruns are explicit in the summary.

Local installed acceptance is not CI, native Office/font compatibility, arbitrary PPTX round-trip fidelity, full visual corpus review, release, or deployment approval.
