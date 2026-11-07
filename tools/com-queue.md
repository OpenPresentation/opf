# COM queue for the Office owner (after the final v0.33.0 pass)

The supervisor sends these jobs one at a time to the session "v0.33.0 qualification: Windows PowerPoint". Rules: check for another POWERPNT.EXE first; open files read-only; never kill Office.

| # | Item / PR | Deck and slides | What to check | Status |
|---|---|---|---|---|
| 1 | LH-174 (#1110) | `C:\opf-work\lh-layout-work\decks\own-icons.opf.json` slides 2, 3 | Entries without an icon draw a bullet centered under the icon-chip column, at the preview's position (sheet `sheets\lh-173-174.png`) | waiting |
| 2 | LH-176, LH-182, RR-105 finding 5 (charts) | decks and slides from the charts agent's ready message | Gap width and overlap, the doughnut hole surface, histogram bin labels and axis scale against the preview | waiting for the list |
| 3 | SH-10 (#1115), SH-12 (#1109), SH-13 (#1119) | decks from the diagram-langs agent | Grown shape text breaks at the same lines; DOT and PlantUML native shapes | waiting for the list |
| 4 | #1089, #1091 (pptx-0.34) | from the pptx agent | Native-body cards don't re-wrap; the small-run title sits at the preview's baseline | waiting for the PR |
| 5 | RR-87 (#1099) | the PR body's first run | First Office run of the bounded owned-copy playground helper | after merge |
| 6 | SH-08 fixtures | `com-jobs\sh-08.md` (script at 45e87228b, guarded) | Build 17 PowerPoint-made SmartArt slides, the manifest and PNGs | sent 2026-11-07 |
| 6b | SH-08 fixtures, rerun | script at d7651f33c (visible and minimized, layouts read by index) | The first run found 0 layouts | sent |
| 6c | SH-08 fixtures, fourth run | 88196f7f4 | 17 slides built, 15 clean | DONE |
| 7 | SH-20 to SH-23 live-gate sweeps | `com-jobs\sh-live-extras\run.ps1` | Probes 516 live and 516 native decks, the ninth node, trees | sent 2026-11-07 (the 0.33 final pass takes priority) |
