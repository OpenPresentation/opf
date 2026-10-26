# WI-1: content sizing

Core changes how content is sized; the renderer draws what core composes. Every move below comes from one of five engine rules. No gallery record changes, and no move is about colour, fonts or drawing code.

1. **Auto rows.** A body `auto` row is no longer capped at half the content box. When auto rows do not all fit, they shrink together toward their content's height at the minimum font size (`shareHeights`).
2. **Placed measurement.** Content-sized text is measured with its outlines and raster padding. A single-line auto note now draws at 25 px instead of 24 px.
3. **Metric size.** A metric value asks for 76 px whatever its box (it asked for `min(76, 0.28 × box height)`).
4. **Column flow.** A column flow, and a group's blocks in one column, stack at their natural heights, one gap apart, instead of equal shares.
5. **Peer sizes.** Peers side by side share one fitted size per kind.

## Template baseline (`layout-templates-rr96-color-variants.json`)

`node test/layout-template-goldens.mjs --update`, reviewed, then `--promote`: 138 of 485 slides changed, and the source digest is unchanged. The 64 `paginated` slides are pages that core's `paginate` makes from overflowing samples; pagination composes with the same rules, so its pages move with them. The other 74 changes are the template cases:

| Template | Slides |
| --- | --- |
| `dashboard` | 10 |
| `statement` | 10 |
| `chart-beside` | 8 |
| `scorecard` | 6 |
| `table` | 6 |
| `code` | 5 |
| `image-beside` | 4 |
| `metrics` | 4 |
| `timeline` | 4 |
| `closing` | 4 |
| `agenda` | 3 |
| `faq` | 3 |
| `table-beside` | 3 |
| `text` | 1 |
| `list` | 1 |
| `comparison` | 1 |
| `feature` | 1 |

Core's composition goldens of the same samples (`packages/javascript/test/fixtures/template-goldens-0.19.json`) moved in 72 of 336 cases:

- overflow diagnostics went from 416 to 399;
- 94 composed text sizes went up and 5 went down. The 5 downs are overfull stress cases (`comparison 6 long`, `timeline 4 long`, `timeline 5 long`), where rows now shrink together instead of one row overflowing.

The review sheets were inspected:

- `agenda 2 short`: two lists stacked at their heights instead of halves;
- `statement`: the message keeps 25 px;
- `closing 4 long`: 22 px became 25 px;
- `dashboard` and `scorecard`: metric values at 76 px;
- `chart-beside` and `table`: notes at 25 px.

## Example corpus

The `golden` workflow (run 40298942822, pinned Playwright image) changed **82 of 818 slides in 42 decks** (commit `abb321db3`). The source digest is unchanged. All 82 contain a metric: 41 are promoted-region slides, 20 are `dashboard`, 20 are `chart-beside`, and 1 is an automatic composition (`technical/block-composition.opf.json#0`). The corpus has 85 metric slides, so 3 do not move; they already drew their value at 76 px.

The cause is rule 3: metric values that `min(76, 0.28 × box height)` held at roughly 34 to 69 px now ask for 76 px and fit down only where the box cannot hold them. A walk of every changed slide found no slide without a metric.

Rules 1, 2, 4 and 5 move no corpus slide. The corpus decks embed their own layout records and have no `auto` note rows, all-auto stacks or same-role peer columns that fit at different sizes.

The review sheets in the run artifact were inspected: `compliance-readiness-review#5`, `data-platform-migration-plan#5`, the dashboard and chart-beside evidence packs, and the dark variants. Each shows larger metric values and no other change.
