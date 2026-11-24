# Handoff of 2026-11-24: 0.36.0 is the fixes release, 0.37.0 the format changes

Written by the release supervisor session on the owner's Windows computer. Two owner decisions on the evening of 2026-11-24 changed this page after it was first merged: the release numbers moved by one, and the product split was decided. This version carries both. The rules are in [working-rules.md](working-rules.md) (what changed since 2026-11-07) and the [working rules of 2026-11-07](../2026-11-07/working-rules.md). [KICKOFF.md](KICKOFF.md) is the one prompt to give the next agent.

## The two decisions of 2026-11-24

**The release numbers.** 0.36.0 is the fixes release: every fix made since 0.35.1, cut from the Windows computer as soon as all of them are in. The release gate refuses a patch number, because opf#1425 declares drawing changes for four gallery layouts (`scripts/gallery-stability.mjs`, rule 4). The format changes the owner kept in his review ship as 0.37.0, built later from the Mac mini. The owner also said that no 0.36.1 is to be planned: every known fix goes into 0.36.0.

**The product split.** In the owner's words:

- openpresentation.org: the open source, free OPF format site. No paid or hosted AI chat there; users bring their own API key or connect their own agent via MCP.
- mcp.openpresentation.org: a free MCP about the OPF format, CLI, docs, examples and resources.
- openpresentation.com: takes over the whole pptx.dev platform plan. Developer PaaS/SaaS around OPF: presentations, documents, compute, AI, storage, analysis, retrieval, brand kits.
- mcp.openpresentation.com: MCP for that PaaS/SaaS and the user's own resources, files and data (OAuth lives here).
- storyd.ai builds on openpresentation.com, not pptx.dev.
- pptx.dev becomes a simple microsaas for creating PPTX files in a browser tab, with OPF under the covers.
- Schema IDs stay on openpresentation.org.

So the OPF site does not move to openpresentation.com, no schema id changes, and nothing in OPF planning may assume that the platform, a hosted MCP with sign-in, or STORYD's backend live on pptx.dev. Where the cloud-editor program says pptx.dev adopts each piece first, read openpresentation.com.

## Released

- **0.35.0 and 0.35.1** are on npm (all seven packages, 2026-11-23) and live on openpresentation.org, pptx.gallery and pptx.dev since 2026-11-24.
- The new homepage is live on openpresentation.org (openpresentation-site#253).

## 0.36.0, the fixes release

If the tag `v0.36.0` exists, it is released. If not, it is still being assembled on the Windows computer: the release tracker (below) and the open pull request from the branch `codex/036-fixes` say where it stands.

On `main` for it:

| Pull request | What |
| --- | --- |
| opf#1423 | The release workflow's site bump checks out `packages/render` (closes opf#1417) |
| opf#1424 | Two guardrails: the `opf/shape-path-units` warning, and `updateJsonSource` can refuse a repeated key |
| opf#1425 | The layout sweep's fixes (LH-193 to LH-199), the negative-bar plot area for Keynote, 267 regenerated golden slides, one lock refresh |
| opf#1426 | The MCP viewer's footer says when the assistant can see the deck |
| opf#1427 | The preview paints every path's fill before every path's line (`chartX`, `chartStar`, `chartPlus`, `cloudCallout` match PowerPoint) |
| opf#1432 | The Keynote differences measured on the 0.34.0 corpus, in the export skill and the compatibility matrix |
| opf#1442 | PowerPoint shows what the preview shows: one-series chart legends, one-line data labels, link shapes, the plot box of charts below a heading (the fix for a defect opf#1425 caused), centered bodies in the paragraph export; one lock refresh on the owner's word |
| opf#1420 | A type test between core and the renderer (opf#1408) |
| opf#1421, opf#1428 | Languages survive a PowerPoint round trip (opf#1404), with the fix for a Hebrew slide that holds a Latin word |
| opf#1419 | The conformance suite, the governance document and two narratives |

Built and checked in PowerPoint on 2026-11-24, combined on `codex/036-fixes`:

- the five fixes of the PowerPoint test round, opf#1436 to opf#1440, with the edge cases an independent review found
- opf#1429: an `agenda` with seven or more entries exports
- opf#1430: pie and doughnut charts have lines between their slices and the preview's size
- opf#1431: a chart with a reference line keeps its highlight on import, and data labels that were turned off stay off
- opf#1405 and opf#1406: a check that failed on Windows, and an editor timing test that failed on one slow sample

Still to look at for 0.36.0 when this was written: opf#1402 (two layout results from the site decks), opf#1403 (the viewer's export does not show the note about fonts a viewer's PowerPoint may lack), a likely presenter bug (a click on a link also advances the slide), and the three formal PowerPoint runs owed since 0.35.0 (opf#1413, opf#1401, opf#1399).

After the release: the three sites are updated to 0.36.0, one pull request at a time per site, with the site gate in the working rules. This needs no PowerPoint.

Not in 0.36.0: the Keynote fixes of opf#1416 (each needs a check in Keynote), the opt-in Keynote export (opf#1298, where the opaque background of opf#1418 goes), the weaknesses the layout sweep left open (opf#1412), and the region map chart (opf#924, parked by the owner for after version 1).

## 0.37.0, the format changes

The plan and the tracker are pages in the owner's Claude account. A Claude session on his account can read and update them; another agent records state in this folder instead.

- Plan (still titled "OPF 0.36 Plan"; a note at its top gives the new numbers): https://claude.ai/artifact/YSMnrQySEPmarTqGH3jevR
- Release tracker: https://claude.ai/artifact/8rscq4FkNnuazfDnEk3x1K (remaining work only)
- OPF 0.37 Review: https://claude.ai/artifact/9MfLFtDMZmNFSEjgocinhB (each format change, its decisions and a recommendation)
- Three studies for the release after it: Slide Templates and Narratives (https://claude.ai/artifact/KgWtnp6PdnbsW854Bqjsjt), Brand Kits (https://claude.ai/artifact/HUBcTmFeY6yGV4yqvkbhvY), Data-Bound Variables (https://claude.ai/artifact/TtWQhSmbHNYD6Pz2kj5Cb5)
- OPF Open Choices: https://claude.ai/artifact/Ez2mZEZrQKGvXeUvx83t8S (seven drawing choices, all decided on 2026-11-24)

Snapshot:

- **What it holds.** The changes the owner kept in round 1 of his review on 2026-11-24, landing on `main` in order: ids (CR 6, CR 7, slide links), data (CR 1 to 4, then CR 5), embed (CR 11), variables (CR 14, CR 15).
- **Moved or cut in that review.** CR 8, 10, 13 and 17 moved to the release after, with a study page each; two studies recommend pulling CR 10 and CR 13 back. CR 9, 12 and 16 became issues (opf#1433, opf#1434, opf#1435).
- **None of it is built yet.** It waits for rounds 2 and 3 of the review (CR 1 was redesigned as a flat dataset with a `datasources` map) and for the three studies. The full analysis is `docs/plans/format-requests-0.36.md` on the branch `claude/opf-v0.35-analysis-s1lwbd`. The program folder `docs/programs/format-requests/` is opened once the review is answered.
- **Open question, not decided:** whether the default PowerPoint export should write whole paragraphs. Today it writes one text box per wrapped line and paragraphs are the opt-in `--body-text native`. It is opf#1292. The owner's choice of 2026-11-24 that a list stays centered when lines are added in PowerPoint applies to the paragraph export only.

## The PowerPoint test round of 0.35.1

The owner had every 0.35.0 and 0.35.1 feature and fix opened in PowerPoint by another agent on the Windows computer on 2026-11-24: 303 decks, 1,422 slides, all copies saved by PowerPoint imported. Its record is the tracking issue opf#1441. It found five defects (opf#1436 to opf#1440), which the same agent fixed on the owner's authorization; they are in the 0.36.0 list above. Its evidence stays on the Windows computer under `C:\opf-work\ppt-035\`.

## What only the Windows computer can do

- Open exported decks in PowerPoint (the pass every export-drawing change needs before merge).
- Refresh sealed files that carry a PowerPoint measurement.

Tools from the passes of 2026-11-24 are on that computer and not in the repository: `C:\opf-work\c34\scratch-sup\render-list.ps1` (PowerPoint pictures of a list of decks), `append-and-render.ps1` (add lines to a shape on a copy), `text-bounds.ps1` (PowerPoint's own text bounds), `save-copy.ps1` (a copy written by PowerPoint), `labeled-sheet.mjs` (labeled before-and-after sheets), and `C:\opf-work\c34\sweep-ppt\` (`run.mjs`, `compare.mjs`, `delta.mjs`: export a folder of decks, score preview against PowerPoint, compare two versions).

What those passes established: column, bar and pie charts match the preview in PowerPoint. What still differs is older than 0.35.1: waterfall, box, histogram, Pareto and funnel charts, whose PowerPoint form has no plot box the export can set.

## What only the Mac can do

Keynote checks: the negative-bar fix that landed in opf#1425 has not been opened in Keynote, and every opf#1416 item needs one. The owner starts Keynote; the agent never saves in it.

## Decisions the owner still has to make

1. Rounds 2 and 3 of the review and the three studies (for 0.37.0).
2. The free MCP's address: when it moves to mcp.openpresentation.org, and whether the address people have already added (`https://www.openpresentation.org/mcp`) keeps answering. The DNS record and the route are his to set.
3. The platform: which repository becomes openpresentation.com, and what pptx.dev keeps of its accounts and sign-in.
4. The GitHub app's permission on the three sites: each site's "Merge OPF bump" step fails with HTTP 403, so the 0.35.1 bumps were merged by hand.
5. The request texts and answers from STORYD, to confirm the shapes that differ from its requests.
6. A session on the Mac for the Keynote checks, and one on the Windows computer whenever a PowerPoint pass is owed.

## How to resume

1. Read `AGENTS.md`, this page, [working-rules.md](working-rules.md) and the working rules of 2026-11-07.
2. Check whether `v0.36.0` is released. If not, finish it from the state the tracker gives; what needs PowerPoint has to happen on the Windows computer.
3. If it is released and the sites are not on it yet, update them.
4. Read the plan page if you can; otherwise the snapshot above.
5. Start the format changes only when the owner has answered the review. Anything that changes what the export draws waits, open, for a PowerPoint pass on the Windows computer.
6. Write a new dated handoff next to this one when the state changes.
