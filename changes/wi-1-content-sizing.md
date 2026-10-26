---
type: changed
packages: [opf, render, gallery]
---
WI-1 (output-changing: content sizing): content takes the size and height it asks for before anything shrinks, and peers share one size.
    - An `auto` row of a layout takes what its content needs, up to the space the headings and the numeric rows' content leave, instead of at most half the content box. When the auto rows do not all fit, each gives up the same fraction of what it can give up above its content's height at the minimum font size, so three detailed passages in an all-auto stack keep 25 px (were 22/20/18 px), a code payload no longer overflows at 16 px, and a one-line note keeps nearly its need beside a dense row.
    - Content-sized text is measured the way the fit that places it measures it (outlines and raster padding included), so a single-line auto note draws at its 25 px starting size instead of 24 px: the closing next step, the comparison verdict and the notes of `metrics`, `chart`, `table` and `timeline`.
    - A metric value asks for its 76 px role size whatever its box and fits down only when it does not fit; it asked for `min(76, 0.28 × box height)`, which drew 46.27 px in a compact region and about 50 px on `dashboard`.
    - A region whose blocks flow in a `column`, and a group's blocks in one column, stack at the heights they need, one gap apart, placed by the region's `anchor`, instead of an equal share each (a one-line paragraph sat 248 px above its long sibling). Charts, pictures, tables, timelines and videos take what the measured blocks leave; a column with explicit `weights` keeps its tracks.
    - Peers side by side share one fitted size per kind (prose, lists): regions of one role in the same rows (`two-column`, `comparison`, three columns) and the blocks of one row of a `grid` or `row` flow. Three peer lists draw at one size (were 32/30/27 px).
    - The gallery's `dashboard`, `faq` and `statement` layout previews are regenerated with the new engine (metric values at 76 px, FAQ pairs stacked one gap apart); no gallery record changes.
