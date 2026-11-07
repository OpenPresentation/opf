# SH-19 spike: OPF-authored SmartArt layout definitions in PowerPoint

Date: 2026-11-07. PowerPoint for Microsoft 365 on Windows 11, through COM only (visible and minimized, files opened read-only, only our
presentations closed, quit when none was open). Every layout definition here was written from ECMA-376 Part 1 §21.4 by the spike's own
builder (`spike/make.mjs`); none was copied from a PowerPoint part. The package shell is an OPF export (OPF's master, theme, quick style
and colors). Scripts and raw COM records are in `spike/` (`exp0` to `exp6`, `measure.ps1`, `edit.ps1`, `canon.mjs`, `analyze*.mjs`).

## Format facts found on the way

- **Names must be unique in the whole definition.** Two `layoutNode` (or `forEach`) elements with one name, even in different `if`
  branches of a `choose`, make PowerPoint reject the definition silently: it opens the SmartArt live but on Basic Block List
  (`exp0/c-*`, `d-*`; the same definition with per-branch names, `n3_1` and so on, opens on OPF's layout).
- **`hideLastTrans="0"`** on the `forEach` over `followSib`/`sibTrans` is what draws the last node's transition (a loop's closing
  arrow); the default hides it (`exp3b`).
- Absolute constraint values (`val`) of lengths are millimeters (begPad 5 = 14.173 pt).

## 1a. Algorithms

Every algorithm type evaluates in an OPF-written definition (`exp6`: `lin`, `snake`, `cycle`, `pyra`, `hierRoot`/`hierChild`, `tx`,
`sp`, `conn`, `composite` all open live on OPF's layout). Swept over 1 to 8 nodes and four frames (600x400, 400x400, 800x250, 300x500):

| alg | Result against its spec description | Worst residual |
| --- | --- | --- |
| `composite` with `l/t/w/h` constraints as shares of the root's `w` and `h` | every child exactly at its constraints, **when the children's bounds fill the frame or a hidden full-frame child is present**; otherwise PowerPoint moves the bounds to the frame's center, and scales an axis down where the bounds exceed it (each axis on its own) | **0.0001 pt** (60 nodes, 3 frames, 1 to 4 nodes, `exp1`) |
| `sp` (an empty node, or `hideGeom="1"`) | placed by its constraints; a hidden one is not in `GroupItems` and fixes the bounds | exact |
| `tx` | text of the node; see 1d | exact |
| `conn` (`dim` 2D, `begPts`/`endPts` `ctr`, explicit `srcNode`/`dstNode`) | a connector shape on the line between the two centers: rotation = the line's angle, length = center distance − `begPad` − `endPad`, thickness = its `h`, from `begPad` after the source center | exact to 0.0001 pt (`exp3`) |
| `conn` with `auto` points | from the nodes' outlines (ellipses: exact boundary points); not modeled | — |
| a shape's `rot` | PowerPoint does not keep the constrained `w`×`h`: it draws the **largest-area rectangle at that rotation inside the constraint box** (at 45° always a square; at θ the aspect is at most cot θ folded to 0–45°). Modeled exactly (`exp2`, 48 shapes) | exact once modeled |
| `lin` | nodes scaled to the frame on each axis separately (the height no longer follows the width), centered with a 0.1 to 0.4 pt offset; heights clamped (0.9 H) | 0.39 pt offsets on top of non-proportional scaling (the SH-09 spike's 0.47 pt) |
| `snake` | its own grid choice and fit (800x250, 4 nodes: not the best grid), small offsets | 9 to 343 pt against the best-grid closed form |
| `cycle` | node size searched (8 nodes: 110.6 pt for a constrained 150), not the spec's `diam` | up to 215 pt |
| `pyra` | levels H/n tall, but 0.67 W at the base (its own text-space rule), not W | not the spec's closed form |
| `hierRoot`/`hierChild` | evaluates; a tree engine per layout (SH-09's finding) | not measured further |

## 1b. Composite placement

**Yes.** A definition can use only `composite`, with a `choose` of one `if func="cnt" axis="ch" ptType="node" op="equ" val="k"` per node
count, each holding the root's `alg`, the `l/t/w/h` constraints of its nodes as shares of the frame (`refType="w"`/`"h"`, `fact`), a
hidden full-frame `sp` child (`shape type="rect" hideGeom="1"`), and one `forEach axis="ch" ptType="node" st="i" cnt="1"` per node. Arrows
are `forEach axis="followSib" ptType="sibTrans" cnt="1"` children: axis-aligned ones (0, 90, 180, 270°, where `rot` keeps the box) as
`sp` shapes, other angles as `conn` between the two node centers with absolute pads and thickness. Every node then lands within
0.0001 pt of its constraint at any frame size (`exp1`, `exp3`). PowerPoint evaluates no formula of its own, so OPF's interpreter only
has to evaluate the same table: there is nothing to fit.

## 1c. Change Layout and editing

- PowerPoint opens the SmartArt live on OPF's layout and reports its title, description and category (`Layout.Name` "OPF text primSz",
  `Layout.Id` OPF's `uniqueId`, `Category` "other").
- `Application.SmartArtLayouts` (176 built-ins) does not list it, before or after a switch; the Change Layout gallery itself was not
  inspected (COM only, no UI).
- **Switching to a built-in and back works**: `SmartArt.Layout = Basic Block List`, then `SmartArt.Layout = <the layout object read
  before>` restores OPF's layout with every node exactly where it was (`exp5/edit.json`, `back.png`). The file saved after the switch back
  keeps OPF's part.
- **Node edit**: the text changes, the node keeps its rectangle and OPF's `sz` (24 pt stays 24 pt).
- **Added node**: the layout takes the next count's branch (4 nodes on the 2x2 table); the new node gets the `primFontSz` constraint OPF
  writes for every node (20 pt here; without it PowerPoint's default 36 pt). **Deleted nodes**: the layout takes the smaller count's
  branch. The layout stays OPF's and live throughout.

## 1d. Text with explicit `sz`

- Under OPF's layout the run `sz` with `custT="1"` holds exactly as under the built-ins (24 and 30 pt kept, `AutoSize` 0): the text is
  never fitted again, also with long text that overflows its node.
- A `ruleLst` shrinking `primFontSz` (`<rule type="primFontSz" val="5"/>`) does not touch `custT` text (identical result).
- The margins are `lMarg`/`rMarg`/`tMarg`/`bMarg` with `refType="primFontSz"` times the run size (fact 0.2 → 4.8 pt at 24 pt, 0.6 →
  14.4 pt).
- The data model's paragraph alignment (`algn`) wins over the `tx` alignment parameters; `txAnchorVert` sets the vertical anchor (default
  middle). Japanese and Arabic text keep their size and margins (their placement is for the pixel gate).

## 1e. Round trip

`SaveCopyAs` and reopen keep the custom layout part, **not byte for byte but semantically identical**: PowerPoint rewrites it (adds empty
`sampData`/`styleData`/`clrData` with `useDef="1"`, drops attributes at their schema defaults such as `fact="1"` and `st="1"`, reorders
attributes, adds `r:blip=""`); after normalizing those, the saved part equals OPF's (`canon.mjs`: resaved, edited and switched-back copies
all EQUAL). The `uniqueId`, title and description stay; the reopened SmartArt is on OPF's layout with the same geometry.

Also: **two frames with one `uniqueId` and different content each use their own part** (`exp4/same-uid`), so a per-instance constraint
table under one `uniqueId` per design is safe.

## The engine chosen

**`composite` with explicit constraint tables**, plus `sp` (hidden bounds, axis-aligned arrows), `tx` (text) and `conn` between centers
(rotated arrows). Why: it is the only placement PowerPoint evaluates without an algorithm of its own (0.0001 pt residual, any frame size);
`lin`, `snake`, `cycle` and `pyra` each search or clamp in ways their spec description does not say, which would need PowerPoint's solver
modeled per algorithm (the SH-09 spike's 0.47 pt residual, a height clamp, an inset). OPF therefore writes, per instance, the table of its
own design for every count from 1 to the design's maximum at the instance's frame (so an added or deleted node keeps OPF's design), and
OPF's interpreter evaluates that same table. Rotated arrows: `conn` (exact) rather than `rot` (whose largest-area rule changes an arrow's
proportions). Every node carries a `primFontSz` constraint at OPF's size and margins as shares of the font size.

Risks for the build: the gate's text placement (pixel gate), which these measurements do not settle; the Change Layout gallery's display,
which COM does not show.
