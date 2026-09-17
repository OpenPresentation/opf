# Furniture SVG paint verification

PPTX follow-up run [34908508746](https://github.com/OpenPresentation/opf-pptx/actions/runs/34908508746)
at `9ba9c393fd38e8c2d43b8348cd7c459e9d8c361a` now correctly fails on Windows.
The Bash wrapper stops after the furniture assertion instead of allowing later
commands to hide it; Linux passes. Its preserved Windows artifact and failed-step
log are in this directory.

The failed field has **zero nonzero mask pixel centers outside its accepted box**
at 1:1 SVG/raster scale with the same 0.05 reference-pixel allowance. Windows
Chromium 153.0.8010.12 Canvas/TextMetrics and SVG bounding rectangles extend left
of the painted pixels. The actual isolated field screenshot was inspected. This
supports correcting the verifier's coverage measurement, not moving content or
relaxing its readability/containment policy. It is not subpixel vector-coverage
or native Office certification.

The next harness keeps all Canvas bounds as advisory observations and checks
actual SVG paint for every measured furniture field. It retains per-field masks,
font and source hashes, and a deliberately displaced text control that must fail
the same containment predicate. Empty fields must have no paint; nonempty fields
must have paint. Source ranges, readability floors, selection, no-op edits,
undo/redo and export/reimport assertions remain unchanged. Production layout,
renderer, font files, and the existing corpus baseline are unchanged.

The local source run completes all sixteen workflows and forty measured fields
with no outside pixels. The displaced control has outside pixels and is correctly
rejected. `local-source-check.json` binds this run to its verifier, bundle, fonts
and complete report hash. Fresh installed-package Windows/Linux follow-up is
required before accepting the correction. Original failures remain in
`../mac-furniture-windows-ci-20260914` and `windows-reproduced/` here.

The Office recovery prerequisite, native tab/image/font gates, and furniture
package publication/public adoption remain separate outstanding requirements.
