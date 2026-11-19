# LH-186 review: before and after

The sheets the supervisor approved on 2026-11-07 for [opf#1087](https://github.com/OpenPresentation/opf/pull/1087) at `398532e0d`. Each row is one renderer template-golden slide that moved: before (`origin/main` at `aeee8db93`) on the left, after (LH-186 merged with that main) on the right. The 15 keys are in keys.json. The body sizes and what changed are in `packages/render/test/golden/notes/LH-186.md` on that branch.

- lh-186-sheet-0.png: section, agenda-split, statement, closing, pyramid
- lh-186-sheet-1.png: matrix, cycle, flow, vertical-flow, metrics
- lh-186-sheet-2.png: chart, table, table-beside, the two paginated FAQ pages

The decision and the condition the supervisor recorded are in [vetoable-decision.md](vetoable-decision.md). The agenda trade-off is accepted. The condition: in the build that combines LH-184 and LH-186, the paginated FAQ pages stay in columns, never one column of 85-to-95-character lines. Checked on 2026-11-19 on a build of main at `cd9dddb37` with `render-keys.mjs`: both pages ("paginated faq 4 long page 1" and "paginated faq 6 long page 1") draw their seven entries in two columns.

The sheets, `keys.json` and the three scripts are raw evidence and stay out of main; they are at commit `5ba72b90d1fbf9919550e066da0ce6e474826539` (the head of the closed pull request [opf#1136](https://github.com/OpenPresentation/opf/pull/1136)) under this folder's path.

To rebuild the sheets, run each command from the folder that holds these scripts and edit their absolute paths for the machine:

1. `node render-keys.mjs <render package of a built checkout> <out dir> keys.json`, once for the before checkout and once for the after checkout.
2. `node sheet.mjs` pairs `before/NN.png` with `after/NN.png`.
3. `node sizes.mjs <out.json> <render package>` lists each slide's font sizes.
