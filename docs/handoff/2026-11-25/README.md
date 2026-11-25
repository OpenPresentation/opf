# Handoff of 2026-11-25: 0.36.0 is released, 0.37.0 has started

Written by the release supervisor session on the owner's Windows computer. It follows the [handoff of 2026-11-24](../2026-11-24/README.md), whose two owner decisions (the release numbers, the product split) and [working rules](../2026-11-24/working-rules.md) still hold. What changed: 0.36.0 is out and on the three sites, and the owner started 0.37.0 on the Windows computer instead of waiting for the Mac.

## Released

- **0.36.0** is on npm (all seven packages, 2026-11-25, with provenance), tagged `v0.36.0`, with its GitHub release. Release run 45597043175, publish run 45602584638.
- It is live on pptx.gallery (pptx-gallery#201), pptx.dev (pptx-dev#276) and openpresentation.org (openpresentation-site#255) since 2026-11-25.

What 0.36.0 added to the list in the handoff of 2026-11-24:

| Pull request | What |
| --- | --- |
| opf#1448 | The combined fixes branch: the five fixes of the PowerPoint test round, agenda export, pie charts, chart import, languages, the MCP viewer, two checks |
| opf#1449 | The presenter follows a link without changing the slide; the MCP viewer's export shows the font note (closes opf#1403) |
| opf#1450 | The nine chart fallback archives opened in PowerPoint (closes opf#1413, opf#1401) |
| opf#1451, opf#1454 | Leelawadee UI is natively verified (closes opf#1399), with the tracker refresh it needs |
| opf#1452 | The editor's cursor follows a heading's balanced lines |
| opf#1455 | Wrapped lines of right-aligned and centered text are flush: the whitespace at a soft wrap hangs, in the preview and in PowerPoint, for left-to-right, right-to-left and mixed text |
| opf#1456 | The MCP viewer has one expand control in Claude, and Design, Find and replace and Export share one panel |

The three formal PowerPoint runs owed since 0.35.0 are done. The test round's tracking issue opf#1441 is closed.

Left open by 0.36.0, each with its issue: right-to-left text in three places (opf#1458), one-item blocks as narrow columns (opf#1402, part 1), the Keynote differences (opf#1416), the layout sweep's remaining weaknesses (opf#1412).

## What the sites needed for 0.36.0

A site update is not only the version bump. Three things in 0.36.0 changed what the sites' tests see; none is a defect in the release:

- **The Export panel stays open while a file is made** and shows the result at its top. A test that presses something else after an export closes the panel first (Escape), or the press lands on the panel.
- **The PowerPoint row is "PowerPoint"** with ".pptx · editable" as its hint, not "PowerPoint (.pptx)".
- **New content:** two narratives (50 in all) and two docs pages (`conformance`, `governance`), which openpresentation.org lists in its docs directory.

openpresentation.org's Example menu copied the old Export menu's look; it now takes the panel's surface, rows and hover fill. Its video cut files still say "PowerPoint (.pptx)", as records of published videos; the videos' own check flags that the next time a video is made.

The bump workflow opens each site's pull request on the branch `bot/opf-v<version>`; adoption fixes are pushed to that branch. Each site's production deploy refuses its first attempt while the main test workflow on the merged commit is still running, and a second attempt follows when it ends: wait for that one.

## 0.37.0, the format changes

On 2026-11-25 the owner said to start 0.37.0 at once on the Windows computer and that the supervisor "can make good decisions for open items too". The program is [format-requests](../../programs/format-requests/README.md): its burndown has the ten items and their state, and its decision log has every decision with who gave it. Decisions the owner had not answered are taken as the review recommends and marked as the supervisor's; he can overrule any of them.

State when this was written:

- **Merged:** FR-00 (the program documents, opf#1457) and FR-09 (limits on a variable's value, opf#1460).
- **Built, finishing checks, not pushed:** FR-01 (document `id`), FR-02 (ids on list items, bullets, timeline events and table rows), FR-03 (`slide:<id>` links), FR-04 (data sources and the flat dataset, the one breaking change).
- **Not started:** FR-05 to FR-08 and FR-10.

Each item is built by one agent in its own worktree (`C:\opf-work\fr-<nn>-<slug>`) from a brief in `C:\opf-work\037\briefs\` (not in the repository); the supervisor reviews, runs the PowerPoint pass where the export changes, pushes once and merges. What the first items taught, now in the common brief:

- An agent merges `origin/main` into its branch before its final check run and never runs two builds or check runs in one worktree at once (they rebuild `dist` under each other and tests fail with missing files).
- The MCP suite is part of every item's checks. Two tests catch format work: the author skill and the format card must not name an MCP tool (`validate_deck`, `convert`, `show_deck`, `open_editor`), and the lean Worker has size ceilings. FR-09 brought the unminified and minified ceilings back to 3% above the measured size (7,791,000 and 4,953,000 bytes); an item that passes one reports its three sizes and the supervisor decides.
- A new example deck needs its golden recorded: after the push, dispatch `golden.yml` on the branch and merge on the head it produces.
- Five agents on one computer make the three check slots slow, and tests that launch Windows PowerShell time out under that load (`check:native-acceptance`). CI is the quiet run.
- Biome 2.6.7 prints nothing on the Windows computer for some days after its install (a Windows block on a new unsigned binary that clears by itself). CI lints.

## What only the Windows computer can do

As on 2026-11-24. Owed now: the PowerPoint passes of FR-02 (ids restored after an edit and save in PowerPoint), FR-03 (each jump lands on its slide) and FR-04 (the data source keys survive a save), with the files each agent prepared under `C:\opf-work\037\<item>\ppt\`.

## Decisions the owner still has to make

1. Any decision in the program's [decision log](../../programs/format-requests/decisions.md) he wants to overrule. The one that reverses an earlier answer of his: embed (FR-08) is planned for 0.37.0 without waiting for the request text.
2. The platform: which repository becomes openpresentation.com, and what pptx.dev keeps of its accounts and sign-in.
3. The GitHub app's permission on the three sites: each site's "Merge OPF bump" step fails with HTTP 403, so the 0.36.0 bumps were again merged by hand.
4. Whether the default PowerPoint export should write whole paragraphs (opf#1292).
5. A session on the Mac for the Keynote checks (opf#1416).

## How to resume

1. Read `AGENTS.md`, this page, the [handoff of 2026-11-24](../2026-11-24/README.md) for the product split and the working rules, and the program's README, burndown and decision log.
2. For each item the burndown shows in work: look for its branch `codex/fr-<nn>-<slug>` and its pull request; an item without a pull request is in a worktree on the Windows computer and not lost, but only that computer has it.
3. Land the items in the order they become ready; each later branch merges `main` first. Anything that changes what the export draws or writes waits, open, for a PowerPoint pass on the Windows computer.
4. Write a new dated handoff next to this one when the state changes.
