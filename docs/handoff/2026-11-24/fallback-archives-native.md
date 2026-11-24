# The nine chart fallback archives in PowerPoint (opf#1413, opf#1401)

This note records the native run for the nine chart fallback archives on 2026-11-24:
- [opf#1413](https://github.com/OpenPresentation/opf/issues/1413), the column layout tags regenerated for 0.35.1;
- [opf#1401](https://github.com/OpenPresentation/opf/issues/1401), the `world-category` archive regenerated for the Yu Gothic default.

The run is a check of the archives. It changes no fixture, lock or pin, and no PowerPoint run folder is part of the repository.

## What was run

**The archives.**
- The nine `chartex: 'fallback'` archives of `packages/pptx/test/fixtures/chartex-fallback-main.json` were exported from the assembled 0.36.0 branch (`codex/036-fixes` at `97aac6defd5c499bf85c38586b67ff3a5e93e8e6`). They used the fixture's own caller, `toPptx(structuredClone(deck), {chartex: 'fallback', catalogs: [gallery]})`, as in `packages/pptx/scripts/chartex-fallback-archives.mjs`.
- All nine are byte-identical to their locks, and that fixture is the same on `main` (`cd6e3bb6c`).

**The comparison set.**
- The same nine decks were exported through the published 0.35.1 packages.
- Each is byte-identical to its v0.35.1 lock. These are the archives the two issues were filed about.
- The 0.36.0 archives move again because of the opf#1442 lock refresh. Accepting them covers both issues' changes, which they contain.

| Archive | Slides | 0.36.0 archive = lock (sha256, bytes) | 0.35.1 archive (sha256, bytes) |
| --- | --- | --- | --- |
| treemap-category | 1 | `341c17da3ccd…` (103,528) | `39cfc3bd78b5…` (103,525) |
| histogram-single | 1 | `f6fe5a24bc1b…` (103,532) | `b2340e1e4bdf…` (103,529) |
| histogram-category | 1 | `440415bdae58…` (103,549) | `717d892b49cb…` (103,547) |
| pareto-multi | 1 | `0e9bf647c8ca…` (104,332) | `651e62750251…` (104,319) |
| box-multi | 1 | `fbd9e07fe5b7…` (104,200) | `40be676cf309…` (104,196) |
| waterfall-single | 1 | `bb5f8a176676…` (103,981) | `4dc0754ba336…` (103,977) |
| funnel-category | 1 | `ea117fb48c02…` (103,527) | `1605d0a8d56f…` (103,524) |
| world-category | 1 | `ecd49ced1603…` (102,478) | `151cfa933e1b…` (102,474) |
| all-seven | 7 | `24c6e4c52cd4…` (167,931) | `0ecc5eb814c0…` (167,904) |

**The read-only opens.**
- These used the repository's reviewed worker, `packages/pptx/test/native-font-inventory.ps1 -ControlDeck`, on PowerPoint 16.0.
- One process ran at a time. Each opened one copy with `ReadOnly=-1` and no window, read `Presentation.Fonts`, the theme font slots and the text fonts, and closed only its own presentation. Nothing was saved and PowerPoint was not quit by the worker.
- The runs covered the eight one-slide archives of 0.36.0, plus the 0.35.1 `world-category` archive for the comparison.
- Each run folder was then checked with `packages/pptx/test/native-font-inventory-audit.mjs`.

**The pictures.** Every slide of both sets, 38 slides with the Leelawadee UI deck of opf#1399, was exported by PowerPoint and compared at 960 by 540 pixels. A pixel counts when a channel differs by more than 40 of 255.

## Read-back

| Archive | Opened read-only | Audit | Presentation.Fonts | Theme East Asian (major / minor) |
| --- | --- | --- | --- | --- |
| treemap-category | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| histogram-single | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| histogram-category | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| pareto-multi | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| box-multi | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| waterfall-single | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| funnel-category | yes | passed | Aptos Display, Aptos | Aptos Display / Aptos |
| world-category (0.36.0) | yes | passed | Yu Gothic | Yu Gothic / Yu Gothic |
| world-category (0.35.1) | yes | passed | Yu Gothic | Yu Gothic / Yu Gothic |

For every run:
- the worker exited 0;
- the opened file was the archive (its hash matched);
- the presentation was closed once;
- there were no semantic failures, no bounds exceeded and no error.

A repair prompt or a refusal would have failed the read-only open. None did.

## Pictures

**0.36.0 against 0.35.1 in PowerPoint.** 13 of the 15 slides are identical. Two moved:

| Slide | Pixels that differ from 0.35.1 | Pixels that differ from OPF's preview |
| --- | --- | --- |
| pareto-multi | 5.3% (the plot sits lower under its legend) | 0.7% |
| all-seven, slide 7 | 1.2% (the same kind of move) | 3.4% |

Both moves are the plot-box change of opf#1442, made on purpose, and both bring the slide closer to OPF's preview.

**Other results.**
- The seven slides of `all-seven` match the seven one-chart archives.
- `world-category` draws its Japanese title and labels in PowerPoint in both archives.

**Why the slides are not compared with the preview.** In `chartex: "fallback"` mode, PowerPoint draws treemap, histogram, box, waterfall, funnel and the world chart as clustered column charts. OPF's preview draws each one as its authored kind. This is the documented form of the mode: the exporter writes the classic clustered column chart of the same data and no chartex part (`packages/pptx/README.md`, "Modes"). The large differences from the preview for those slides (3% to 56% of pixels) are that documented form, not a finding. The run checks the archives against each other and against PowerPoint's opening of them, not against the preview.

**Previews without fonts.** The previews made beside the run were drawn with `toSvg` and `toPng` called with no font handle and no font packs. They therefore show empty boxes for the Japanese text of `world-category`. Drawn through the CLI, which loads its font packs, the same deck shows the Japanese title and labels in Noto Sans JP, the substitute for Yu Gothic:

```sh
opf convert world-category.opf.json "world-s-{n}.png"
```

The CLI reports `fonts/font-substituted` for Calibri (Carlito) and Yu Gothic (Noto Sans JP). This is not a finding.

## What the object model could not read, and why

- **`all-seven` (7 slides).** The read-only worker reads at most 2 slides and ends a larger deck as incomplete. Its bounds stay as reviewed. `all-seven` was therefore checked by the picture pass only. Its seven charts are those of the seven one-chart archives, which were opened read-only.
- **Yu Gothic inside the world chart's labels.** No reviewed worker reads chart-label fonts through the chart object model. The evidence is the theme's East Asian slots and `Presentation.Fonts` read back as Yu Gothic, together with the pictures.
- **The repair dialog itself.** The workers run without a window, so a repair or refusal shows as a failed read-only open rather than as a visible dialog. Every open succeeded.

## Result

- opf#1413: the nine archives open read-only in PowerPoint without repair and draw as their 0.35.1 versions, apart from the intended opf#1442 plot move.
- opf#1401: the `world-category` archive opens read-only and reads back Yu Gothic in both the 0.36.0 and the 0.35.1 archive.

Both issues can be closed with a link to this note.
