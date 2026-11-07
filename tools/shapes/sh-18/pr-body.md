SH-18 of the shapes program: live SmartArt for cycles, built on SH-09's arrangement design and SH-16's fallback.

## Names

- Arrangement value: `cycle` (a region's `arrangement`, next to `pyramid` and `matrix`).
- Gallery layout: `cycle` (title beside, region `stages`). Neither collides with a layout id or a region name on `origin/main` (`steps` and `process` are taken; `cycle` and `stages` are free).

## PowerPoint's geometry, measured and fitted in core

Basic Cycle (`urn:microsoft.com/office/officeart/2005/8/layout/cycle2`) was measured through COM (2,300+ shapes over 70 frames, counts 1 to 10):

- PowerPoint lays it out from the frame alone, never from the text, and the layout is **exactly proportional to the frame at a fixed width over height** (largest difference across frames 230 to 920 pt wide: 0.0004 pt).
- At other proportions it is not a closed form: the circle size is a ten-bit binary fraction of the frame width found by a search, and the ring is fitted in a second step, so circles move by up to 0.4 pt between frames a few points apart.
- So OPF gives the SmartArt frame one proportion per count, **1.8 : 1 for two entries, 1.15 : 1 otherwise**, the largest such frame centered in the region (`cycleFrame`), and reproduces the geometry from the frame width W (`cycleNodes`):
  - circles (`ellipse`), diameter `CYCLE_DIAMETER[n]`·W: 890/1024, 818/2048, 774/2048, 570/2048, 538/2048, 890/4096, 830/4096, 723/4096 for 1 to 8;
  - centers on a ring of radius `CYCLE_RADIUS[n]`·W, first at the top, clockwise (two: left and right), an odd count's ring moved down so the bounds are centered;
  - after each circle a `rightArrow` (adj1 60000, adj2 50000), 0.3375 of a diameter thick, 0.53 of the gap long, starting 0.22 of the gap after the circle, turned along the line between centers; two entries: arrows over and under the gap (`CYCLE_TWO`);
  - text rectangle: the ellipse's inscribed square, 0.1 em margins.
- The fitted model matches every circle and arrow PowerPoint drew within 0.0001 pt.

## OPF's own cycle

Where the circles do not hold the entries at the list's size, or the instance is outside the domain: the larger-text of a ring of rounded rectangles on an ellipse filling the region (two entries side by side, or stacked in a tall region) and a loop of two or three rows with exactly one node on every place of its edge, a shorter row widening its nodes so no place is ever empty (`cycleRing`, `cycleLoop`), with one arrow size. Arrows are the primary lightened 40%; right-to-left decks run counterclockwise. A list stays only past 8 entries or when no design holds the text (`opf/arrangement-adapted`), and that list now fills the region: the largest size up to 1.5 times the role size at which it fits, centered in the region's height. This is SH-09's shared fallback, so it also applies to pyramids and matrices (core composition goldens: 9 long-content samples of pyramid, matrix and cycle moved, the list centered).

## List blocks as entries (review)

A region of two or more list blocks draws each block as an entry with its list inside, the same way for every count and for the three arrangements: a cycle's on cards on the ring or a loop with an arrow from each to the next, a matrix's on a grid of cards, a pyramid's beside the levels of OPF's stepped pyramid, at one size from 1.5 times the role size down to the lists' own, never breaking a word. Where a pyramid's levels or a cycle's ring and loops do not hold the lists: a grid of cards with `opf/arrangement-adapted`. Lists that overflow their region keep its composition, which pagination splits. A region with an arrangement keeps its whole cell under LH-48's centering. Before, pyramid and matrix blocks were bare lists in the region too (main), so this covers them.

The overlapping long samples (cycle 4 to 6 long, pyramid 6 long on main) are pre-existing: a `flow: "none"` region takes only the blocks that fit, and LH-43 draws the rest below the grid, which on an unpaginated slide overlaps it; pagination splits them.

## Domain and gate

| | Cycle |
| --- | --- |
| Entries | 1 to 8 |
| Frame | exactly 1.8 : 1 (two entries) or 1.15 : 1 |
| Lines | at most 2 an entry (stable at ±4% width); no total limit |
| Text | Latin, left to right |

Sweep: 1 to 8 entries × short/medium/long × 16:9, 4:3, 1:1, plus Arabic and Japanese decks of 3, 4, 5 (78 decks), each exported live and as shapes and drawn by PowerPoint. A first pass with the domain open drew 35 live: all at 0.000 pt and equal sizes; the 9 misses were RTL (PowerPoint lays Basic Cycle out clockwise regardless), Japanese (text 11 px off) and entries of 3 or 4 lines (native gate 1.03 to 1.62). Final (after review): **25 live, 25 pass** (rects and arrows 0.000 pt, rotations equal, sizes equal, native gate mad ≤ 0.84 / 1.29, no hot block, text ≤ 1.03 px; their data, drawing and slide parts byte-identical to the first final sweep), 44 OPF design (shapes mad ≤ 1.04, no hot block), 9 lists filling their regions. In each list case every design breaks a readability floor at the role size: a word wider than its node (never broken) or entries taller than their node (never shrunk); for example 8 long entries on 16:9: the 4 + 4 loop's nodes are 109 px wide for "Customers" at 143 px, the 3 + 1 + 1 + 3 loop is 16 px short.

COM: `HasSmartArt`, Basic Cycle, every entry a node; a node edit keeps OPF's size; Change Layout works; a PowerPoint re-save and a PowerPoint-authored Basic Cycle import back as `cycle`; with an unknown `Requires` namespace PowerPoint draws SH-16's fallback as the preview (mean difference 0.94 to 1.05).

## Pinned files that move (not regenerated here)

- render layout-template goldens (regenerated on the branch by the coordinator's helper, ee73777e9, then again here for the list-block entries: 18 keys, all pyramid, matrix or cycle; promoted) (`packages/render/test/golden/layout-templates-rr96-color-variants.json`: 12 new `cycle` entries; `layout-template-goldens.mjs` fails on the fixture hash, 32 → 33 templates);
- the chartex fallback fixture (`packages/pptx/test/fixtures/chartex-fallback-main.json`: one more slide layout in every export);
- the MCP docs budget and the catalog-free budget do **not** move (`mcp.test.mjs` passes; `pnpm check:catalog-free` is within budget).

Core composition goldens were regenerated in this branch: 12 entries added for `cycle`; 9 long-content samples (pyramid 1, 5, 6; matrix 1, 5, 6; cycle 1, 5, 6) moved because a fallback list is now centered in its region. The render layout-template goldens move for the same samples.

## Tests

Run on Windows 11: `pnpm check:changed` (its build step stops at the MCP app build, a Windows-only path bug on main: `packages/mcp/scripts/build-app.mjs` passes `new URL(...).pathname`, `/C:/...`, to esbuild; built here with a local `fileURLToPath` patch, not committed), then every test file of core, render, pptx, gallery, cli and mcp on its own, and the editor's `design-menu-browser.mjs` after a build (passes, 33 layouts). Failures: the two pinned fixtures above (render `layout-template-goldens.mjs`, pptx `chartex.mjs`), and three environmental ones that do not depend on this change: core `script-width-estimates.test.mjs` and cli `image-placeholder-count.test.mjs` read `docs/evidence`, which the blobless agent worktree leaves out, and pptx `keynote-registry-runtime.mjs` needs symlink rights Windows does not grant. Generated docs (`generate-schema-docs.mjs`, `build-validate-docs.mjs`) and `pnpm check:changes` are current.

New: `packages/javascript/test/sh-18-cycle.test.mjs`, `packages/render/test/sh-18-cycle.mjs`, `packages/pptx/test/sh-18-smartart.mjs`; layout counts 32 → 33 in the core, render, pptx, gallery, cli and editor tests; SH-09's constant asserts extended.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
