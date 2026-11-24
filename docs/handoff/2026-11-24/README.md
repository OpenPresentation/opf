# Handoff of 2026-11-24: after 0.35.1, toward 0.36.0

Written by the release supervisor session on the owner's Windows computer, which is being wrapped up. The owner plans to build 0.36 from the Mac mini. This page is the state, what is left, and who has to do what. The rules are in [working-rules.md](working-rules.md) (what changed since 2026-11-07) and the [working rules of 2026-11-07](../2026-11-07/working-rules.md). [KICKOFF.md](KICKOFF.md) is the one prompt to give the next agent.

## Released

- **0.35.0 and 0.35.1** are on npm (all seven packages, 2026-11-23) and live on openpresentation.org, pptx.gallery and pptx.dev since 2026-11-24.
- The new homepage is live on openpresentation.org (openpresentation-site#253).

## On `main` after 0.35.1 (ships in 0.36.0)

| Pull request | What |
| --- | --- |
| opf#1423 | The release workflow's site bump checks out `packages/render` (closes opf#1417) |
| opf#1424 | Two guardrails: the `opf/shape-path-units` warning, and `updateJsonSource` can refuse a repeated key |
| opf#1425 | The layout sweep's fixes (LH-193 to LH-199), the negative-bar plot area for Keynote, 267 regenerated golden slides, one lock refresh |
| opf#1426 | The MCP viewer's footer says when the assistant can see the deck |
| opf#1427 | The preview paints every path's fill before every path's line (`chartX`, `chartStar`, `chartPlus`, `cloudCallout` match PowerPoint) |
| opf#1432 | The Keynote differences measured on the 0.34.0 corpus, in the export skill and the compatibility matrix |

## Open when this was written

**opf#1442, the second batch.** Five changes that make PowerPoint show what the preview shows: one-series chart legends, one-line data labels, link shapes, the plot box of charts below a heading (the fix for the defect opf#1425 caused), and centered bodies in the paragraph export. It closes opf#1415. Every approval it needs is given: the owner chose each change on 2026-11-24, it was checked in PowerPoint, an independent review's findings are fixed, and its sealed files were refreshed once on his word with the PowerPoint measurement repeated. It carries the `full-ci` label because it touches the Windows worker. If it is still open, merge it when `verify` and Full CI are green (`node scripts/pr-gate.mjs "OpenPresentation/opf#1442" --expect-head <sha> --required all`), then watch `main`.

Five fix pull requests from the review session, green and waiting for the owner's word to merge: opf#1419 (conformance suite and governance document), opf#1420 (opf#1408, a type test between core and the renderer), opf#1421 (a declared slide language survives PowerPoint), opf#1428 (no invented deck language; stacked on opf#1421, so that one first) and openpresentation-site#252 (the llms schema chunk, site#247). Dependabot: opf#1409, opf#1410 (move all eleven Playwright image tags together), opf#1411 (its gallery leg is red).

## The 0.36 plan

The plan and the tracker are pages in the owner's Claude account. A Claude session on his account can read and update them; another agent records state in this folder instead.

- OPF 0.36 Plan: https://claude.ai/artifact/YSMnrQySEPmarTqGH3jevR (the single place for 0.36)
- Release tracker: https://claude.ai/artifact/8rscq4FkNnuazfDnEk3x1K (remaining work only)
- OPF 0.36 Review: https://claude.ai/artifact/9MfLFtDMZmNFSEjgocinhB (each format change, its decisions and a recommendation; now in round 2)
- Three studies for 0.37: Slide Templates and Narratives (https://claude.ai/artifact/KgWtnp6PdnbsW854Bqjsjt), Brand Kits (https://claude.ai/artifact/HUBcTmFeY6yGV4yqvkbhvY), Data-Bound Variables (https://claude.ai/artifact/TtWQhSmbHNYD6Pz2kj5Cb5)
- OPF Open Choices: https://claude.ai/artifact/Ez2mZEZrQKGvXeUvx83t8S (seven drawing choices, all decided on 2026-11-24)

Snapshot of the plan:

- **One release.** 0.36.0 carries the work begun after 0.35.1 (group 0), then the format changes the owner kept in his review of 2026-11-24, landing on `main` in order: A ids (CR 6, CR 7, slide links), B data (CR 1 to 4, then CR 5), D embed (CR 11), E variables (CR 14, CR 15). The same release moves the project from openpresentation.org to openpresentation.com.
- **Moved or cut in that review.** CR 8, 10, 13 and 17 moved to 0.37 with a study page each; two studies recommend pulling CR 10 and CR 13 back into 0.36. CR 9, 12 and 16 became issues (opf#1433, opf#1434, opf#1435).
- **None of the format changes is built yet.** They wait for round 2 of the review (six revised cards with 16 decisions, and eight decisions about the release itself) and for the three studies. The full analysis is `docs/plans/format-requests-0.36.md` on the branch `claude/opf-v0.35-analysis-s1lwbd`. The program folder `docs/programs/format-requests/` is opened once round 2 is answered.
- **Group 0, still open:**
  - the PowerPoint test round of 0.35.1 (below) and whatever it finds
  - opf#1429: an `agenda` with seven or more entries fails to export
  - opf#1430: a pie chart in PowerPoint has no lines between slices and is larger than the preview's
  - opf#1431: importing the export of a chart with a reference line loses its highlight and data labels
  - opf#1412: the weaknesses the layout sweep found and did not fix
  - opf#1416: the Keynote differences that can be fixed (radar fills, secondary axis steps, tiled backgrounds, the rest), each with a Keynote check
  - opf#1298: the opt-in Keynote export, where the opaque background color of opf#1418 goes (the owner's choice of 2026-11-24)
  - PowerPoint runs still owed, all on the Windows computer: opf#1413 (the nine chart fallback archives; run it on the archives as the second batch leaves them), opf#1401 and opf#1399
  - opf#1278 to close after its checks
  - pptx.dev's embedded test decks to re-embed; a Dependabot ignore for `@openpresentation/*` on openpresentation-site and pptx-dev
  - a small homepage fix: the prompt buttons shift when they get check marks
- **Open question for 0.36, not decided:** whether the default PowerPoint export should write whole paragraphs. Today it writes one text box per wrapped line and paragraphs are the opt-in `--body-text native`. It is opf#1292, and the plan lists "reflowing PowerPoint body text by default" under what STORYD's launch needs. The owner's choice of 2026-11-24 that a list stays centered when lines are added in PowerPoint applies to the paragraph export only.

## The PowerPoint test round of 0.35.1

The owner decided on 2026-11-24 to open every 0.35.0 and 0.35.1 feature and fix in PowerPoint and to put the results, fixes and improvements into 0.36. He started it the same day with another agent on the Windows computer. It reports in the tracking issue opf#1441, with one issue per defect, titled `PowerPoint 0.35.1: ...` (opf#1436 to opf#1440 were the first five). Its findings become group 0 rows. It tests and reports only; it changes no code. Its evidence stays on the Windows computer under `C:\opf-work\ppt-035\`.

## What only the Windows computer can do

- Open exported decks in PowerPoint (the pass every export-drawing change needs before merge).
- Refresh sealed files that carry a PowerPoint measurement.

Tools from the passes of 2026-11-24 are on that computer and not in the repository: `C:\opf-work\c34\scratch-sup\render-list.ps1` (PowerPoint pictures of a list of decks), `append-and-render.ps1` (add lines to a shape on a copy), `text-bounds.ps1` (PowerPoint's own text bounds), `save-copy.ps1` (a copy written by PowerPoint), `labeled-sheet.mjs` (labeled before-and-after sheets), and `C:\opf-work\c34\sweep-ppt\` (`run.mjs`, `compare.mjs`, `delta.mjs`: export a folder of decks, score preview against PowerPoint, compare two versions). The evidence of the pass over the layout sweep's 91 decks is in the same folder.

What that pass established: with the label fix, the sweep's column and bar charts match the preview in PowerPoint. What still differs is older than 0.35.1: waterfall, box, histogram, Pareto and funnel charts (their PowerPoint form has no plot box the export can set), and opf#1430.

## What only the Mac can do

Keynote checks: the negative-bar fix that landed in opf#1425 has not been opened in Keynote, and every opf#1416 item needs one. The owner starts Keynote; the agent never saves in it.

## The owner's own steps

1. Answer round 2 of the review and the three studies, and say whether the five fix pull requests may merge.
2. Point openpresentation.com at the site: DNS, the Worker's custom domain and, last, the redirect rule.
3. Give the GitHub app its permission on the three sites: each site's "Merge OPF bump" step fails with HTTP 403, so the 0.35.1 bumps were merged by hand.
4. Get the request texts and answers from STORYD, to confirm the shapes that differ from its requests.
5. Start a session on the Mac for the Keynote checks, and one on the Windows computer whenever a PowerPoint pass is owed.

## How to resume

1. Read `AGENTS.md`, this page, [working-rules.md](working-rules.md) and the working rules of 2026-11-07.
2. Read the plan page if you can; otherwise the snapshot above.
3. Look at the open pull requests and the tracking issue of the PowerPoint test round.
4. Work group 0 first. Anything that changes what the export draws waits, open, for a PowerPoint pass on the Windows computer.
5. Start the format changes only when the owner has answered round 2 of the review.
6. Write a new dated handoff next to this one when the state changes.
