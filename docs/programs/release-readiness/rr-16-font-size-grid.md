# RR-16: composed font sizes on PowerPoint's 0.01 pt grid

Item: [opf#213](https://github.com/OpenPresentation/opf/issues/213), tracked as RR-16 in the [burndown](burndown.md). PRs: [opf#247](https://github.com/OpenPresentation/opf/pull/247) (the snap, closes opf#213), [opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91) (golden baseline and CI pin), [opf-pptx#135](https://github.com/OpenPresentation/opf-pptx/pull/135) (chart text size). Not released: this is a geometry change for the lockstep release.

## Decision (supervisor, 2026-10-01, vetoable)

Quantize in core; do not widen the parity tolerance. The issue offered two options: quantize composed sizes (rounding down) in core with regenerated golden hashes and a lockstep floor, or treat a difference below PowerPoint's own 0.01 pt resolution as equal in the parity harness. The second only hides that the engines still measure and break lines at different sizes: a preview at 14.145 pt breaks lines on 14.145 pt advances while the PPTX text runs at 14.15 pt, up to 0.005 pt apart on every run. Snapping before line breaking removes the difference at its source, and the harness then compares run sizes exactly (0.001 pt, the preview's print resolution; it was 0.005 pt).

## The rule

PowerPoint stores a run size (`sz`) in hundredths of a point. Composition pixels are CSS pixels (96 per inch), so a point is 4/3 px and 0.01 pt is **1/75 px**. Every size composition produces is a whole multiple of 1/75 px (`FONT_SIZE_GRID_PER_PX`), so `Math.round(px * 0.75 * 100)` in the export is exact and the preview draws `sz / 100` pt.

- **Trial sizes round down.** Every fit loop (`fitAtSizes`, and the heading loop that places text with font outlines) evaluates `snapFontSizeDown(start - trial * step)`: the candidates stay anchored to the unsnapped request (no drift from repeated subtraction) and the snap happens *before* line breaking, measuring and placement. A size that fit before snapping still fits (a smaller size never wraps more), and every accepted result was measured at the size it carries, so the snap cannot make a fit overflow: the loop either finds a fitting size or ends at the floor, as before. Fitting is monotone: a larger box never gives a smaller size.
- **Floors round up.** `minFontSize` (times the canvas scale) goes through `snapFontSizeUp` and the final trial is that size, so a floor is never undercut. When the floor is already on the grid (16 px, the default, is 12 pt) nothing changes; at slide sizes whose scale is not a whole number (A4, Letter, 16:10) the floor rises by less than one grid step (0.0133 px).
- **Requested sizes** are `snapFontSizeDown(max(request, floor))`, so the first trial is on the grid.
- **A tolerance of 1e-6 grid units** absorbs binary noise: a size already on the grid never drops a step.
- **`wrapText`** (a public measuring helper, not a fit) still measures at exactly the size it is given.

Where sizes come from, and how each follows the rule:

| source | how it snaps |
|---|---|
| plain text, headings (tag, title, subtitle), generic content cells | `fitText` and the outline loop: trial sizes on the grid, floor up |
| rich text | `fitRichText` and the shared layouter: the base size and every painted run size (authored sizes, superscript and subscript at 0.7) are snapped from the unsnapped ratio, never below the floor; each fragment carries its own snapped size |
| lists | the list size comes from `fitAtSizes`; the marker uses it; description text is `0.82` of it, snapped through the rich layouter; the picture bullet side is `0.65 * marker.fontSize`, so it derives from the snapped size (`bulletBox`) |
| tables | `layoutTable`: requested and floor snapped once, the natural-height and fit paths use the same snapped sizes (rich cells through the rich layouter) |
| quote, code, metric, timeline | the part's requested size and floor are snapped, and the candidate sizes of their searches (`requested - step * scale`) round down to the grid, clamped to the floor |
| furniture (header, footer) | one snapped size per part, used for measuring, outline placement and the reported `requestedFontSize` |
| chart text | drawn through the same core fits (the 14 px request and the floor); opf-pptx writes it from `chartTextSize`, which now rounds like the fit (opf-pptx#135) |

## Evidence

### Tests

`packages/javascript/test/font-size-grid.test.mjs` (in `pnpm test`): the snap is exact, idempotent and monotone (every hundredth of a point from 0.01 to 200 pt round-trips to its own `sz`); seeded property cases for plain, rich, list, table, quote, code, metric and timeline text at awkward scales (1, 1.5, 0.9722, 1.1333, 0.3, 2.2222) check that every size is on the grid, floors hold, results are deterministic, a result reporting no overflow really fits, an overflowing result is the irreducible floor, the accepted size re-measures identically, and fitting is monotone in box size; and every font size composed from the 805 example slides on four canvases (16:9, 4:3, Letter, an odd 1280 x 700) is on the grid. `test/lists.mjs` now expects the 20 px description floor to round up to 24.4 px (`snapFontSizeUp(20 / .82)`).

### Geometry impact on the example corpus

`node docs/programs/release-readiness/rr-16-corpus-impact.mjs --render <opf-render> --before <base core dist> --after <core dist>` renders the 805 example slides (126 decks) with each core and compares the SVGs element by element (the run of 2026-10-01 is core `c64b3a9` against `448c47f`, opf-render `9e5d616`):

| measure | value |
|---|---|
| slides whose SVG changes | 318 of 805 (70 decks); 487 are byte-identical; none changes its element count |
| slides whose size changes by at most 0.018 px | 303 (one grid step is 0.0133 px); everything else on them moves by at most 0.13 px |
| text elements with a changed `font-size` | 3504 (of 5847 in the changed slides), median delta 0.010 px, p95 0.011 px |
| text origins that moved (more than 0.001 px) | 4025 |
| non-text boxes that moved | 2427 elements, median 0.013 px, p95 0.025 px, max 0.099 px |
| slides with a neighbouring metric fit candidate | 15 (slide 6 of 15 gallery decks: 7 `number-4x`, 6 `number-6x`, 2 `number-1x`); value and label trade up to 2.2 px with the same total reduction and no new overflow |

The 15 are the one discrete effect: the metric layout search scores its candidate sizes by total font reduction, and a sub-pixel change in a trial's fit can pick the neighbouring candidate (for example the value at 41.387 px and the label at the 17.653 px floor instead of 39.19 px and 19.848 px). Both fit; neither overflows.

### Renderer raster golden

[opf-render#91](https://github.com/OpenPresentation/opf-render/pull/91): on Windows, Node 26.4.0, scale 0.25, `systemFonts: false`, the previous baseline first reproduced byte-for-byte against the base core, then **316 of 805** slide hashes changed against the core with the snap and 489 did not (the source digest is unchanged). The 316 are inside the 318 changed SVGs; the other 2 change by less than a pixel at that scale. The baseline is regenerated as a whole file, but only those 316 entries differ.

### Parity (exact run sizes)

The harness tolerance for run sizes is tightened from 0.005 pt to 0.001 pt (`TOL.sizePt` in `parity/scripts/parity.mjs`). Run of 2026-10-01 on the 850 gallery values (`PARITY-2026-10-01-rr-16-font-size-grid.md`, results in `parity-results-2026-10-01-rr-16-font-size-grid.json`):

| heads | tolerance | perfect | near | mismatch |
|---|---|---|---|---|
| core `c64b3a9`, opf-render `9e5d616`, opf-pptx `e3fe3ce` (before) | 0.005 pt (old) | 739 | 111 | 0 |
| the same heads | 0.001 pt (exact) | 719 | 131 | 0 |
| core `448c47f`, opf-render `f392fa6`, opf-pptx `b679524` (after) | 0.001 pt (exact) | **741** | **109** | 0 |

Under the exact tolerance the unsnapped core had 22 values with a run size off the grid, not only the two of the issue: the `list-6x-heading-title-center` and `-slideimage` layouts (14.145 vs 14.15 pt), 18 more layouts such as `number-4x` (51.547 vs 51.55 pt), and the `kpi-dashboard` and `traction-metrics` blocks (47.084 vs 47.08 pt); they passed the old tolerance by 0.001 to 0.005 pt. After the snap all 22 are `perfect`, none regresses, and no value has a run-size difference of any kind.

### Chart text on non-integer scales

The gallery values are all 16:9, where the chart text size (12 pt) is on the grid either way, so the parity run cannot see this: on an A4 slide (scale 1.10267) opf-pptx wrote 13.23 pt (`Math.round`) where the preview now draws 13.24 pt. `chartTextSize` in opf-pptx rounds like the fit (opf-pptx#135), and `test/chart-text-size.mjs` gains two A4 settings that fail without it.

## Release and floors

A geometry change: renderer, PPTX and editor floors on core are raised together at the lockstep release (release-prep PR: versions, changelog, dependency ranges, lockfile only), and the renderer's golden baseline moves with it. Until then the PRs above pin the core PR commit in CI. No renderer source changes (its committed `dist/` is unchanged); opf-pptx's only change is `chartTextSize` and its rebuilt `dist/`. The explanation `algorithm` (`grid-score-v9`) does not change: scoring is untouched.

## Reproduce

```
# core, in a worktree of the branch (pnpm install && pnpm build), and the base commit in another
node docs/programs/release-readiness/rr-16-corpus-impact.mjs --render ../opf-render \
  --before ../opf-base/packages/javascript/dist --after packages/javascript/dist

# renderer golden against a local core
node --import <core>/scripts/register-local-opf.mjs test/golden.mjs

# parity (docs/programs/font-fidelity-everywhere/gallery-support/parity/run.ps1 sets up the worktrees)
run.ps1 -Prefix rr16 -Baseline <before results> -Out out\rr16.json
```
