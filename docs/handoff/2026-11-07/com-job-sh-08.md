> **Handoff note:** `C:\opf-work\...` paths below are from the old machine. Recreate them in your own worktree. The SH-08 fixture scripts live on branch `codex/sh-08-smartart-import` (PR #1126) under `packages/pptx/test/fixtures/`. Regenerate the seed deck with `node packages/pptx/test/fixtures/make-smartart-seeds.mjs`. The SmartArt sweep build and its runner come from the SH-19 tools and the SmartArt agent's sweep script; SH-23's code is on branch `codex/sh-23-smartart-more-entries`. The SH-08 fixture results are committed in #1126 (`packages/pptx/test/fixtures/powerpoint-smartart.*`). The sweep results, if the run finished, are on draft PR #1134.

# COM job SH-08: PowerPoint-made SmartArt fixtures (smartart agent, 2026-11-07)

For the Office owner session. Rules as always: check for another POWERPNT.EXE first; never kill Office; no UI control (object model only).
PowerPoint opens the seed deck read-only, creates one new presentation, saves it, closes both and quits only when no other presentation
is open; the script refuses to start while PowerPoint is running.

## Run (seed route, 2026-11-07)

This PowerPoint build gives scripts no `Application.SmartArtLayouts` list, so each layout comes from a seed deck: `C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx` (17 slides, each a SmartArt whose data model names one built-in layout by id with no layout part, written by `node packages/pptx/test/fixtures/make-smartart-seeds.mjs`). The script opens it read-only, takes slide k's `SmartArt.Layout`, adds a fresh graphic of that layout to its own new presentation and fills it, so the saved deck is PowerPoint-authored (its own data model, drawing and style). A seed slide whose layout PowerPoint does not resolve is recorded as an `error` and skipped.

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\opf-work\sh-08-smartart-import\packages\pptx\test\fixtures\make-powerpoint-smartart.ps1 -Out C:\opf-work\_supervisor\com-jobs\sh-08
```

(Read the script first: it only calls `Presentations.Open` (the seeds, read-only), `Presentations.Add`, `AddSlide`, `AddSmartArt`,
`SmartArt.Nodes`/`AddNode`, `Slide.Export` and `SaveAs`. Script commit a4900d1da7ab0aa663dde64726027895ab98f85d.)

## What it makes (in `C:\opf-work\_supervisor\com-jobs\sh-08\`)

- `powerpoint-smartart.pptx`: a 960 x 540 pt deck, one slide per layout, each slide on "Title Only" with the layout's name as its title
  and one SmartArt at 40, 110, 880 x 400 pt, nodes filled through the object model:

  | Slide | Layout (Id where known; else by Name) | Nodes (indent = child; [b] = bold run; [asst] = assistant; `\v` = line break) |
  |---|---|---|
  | 1 | Basic Pyramid (pyramid1) | Vision [b "Vision"], Strategy, Programs, Teams |
  | 2 | Inverted Pyramid (by name) | Leads, Prospects, Customers |
  | 3 | Basic Matrix (matrix3) | Enterprise, Mid-market, Consumer, Public sector |
  | 4 | Basic Cycle (cycle2) | Plan, Pilot, Measure, Adjust, Scale |
  | 5 | Text Cycle (by name) | Listen, Learn, "Improve" + Japanese 改善 |
  | 6 | Basic Chevron Process (chevron1) | Plan, Build, Test, Ship |
  | 7 | Basic Process (process1) | Research, Design, Run\vthe pilot, Review |
  | 8 | Vertical Process (process2) | Sign up, Set up, Launch |
  | 9 | Accent Process (by name) | Discover > (Interviews, Field visits); Define > (Problem statement); Deliver > (Pilot) |
  | 10 | Basic Block List (default) | Speed, Quality [b "Qual"], Cost, Reach, Trust |
  | 11 | Vertical Bullet List (vList2) | Goals > (Grow revenue 12%, Enter two markets); Risks > (Hiring, Supply chain) |
  | 12 | Basic Venn (venn1) | People, Process, Technology |
  | 13 | Basic Radial (radial1) | Customer > (Sales, Support, Product, Marketing) |
  | 14 | Organization Chart (orgChart1) | Ana Ruiz, CEO > (Sam Lee, Assistant [asst]; Kai Chen, CTO > (Platform, Apps); Lea Park, CFO; Omar Haddad, COO) |
  | 15 | Hierarchy (hierarchy1) | Company > (Sales > (North, South); Engineering > (Web, Mobile)) |
  | 16 | Horizontal Hierarchy (hierarchy2) | the same as 15 |
  | 17 | Name and Title Organization Chart (2008 NameandTitleOrganizationalChart) | Ana Ruiz > (Kai Chen, Lea Park); title boxes "Chief Executive" and "Technology" where the object model reaches them |

- `powerpoint-smartart.json`: per slide the layout's `Id`, `Name` and `Category` as PowerPoint reports them, `GroupItems.Count`, the
  title-box result for slide 17, and every node of `AllNodes` in order (`Level`, `Type`, text, `Shapes.Count`).
- `slide01.png` ... `slide17.png`: each slide exported at 1280 x 720, PowerPoint's drawing of each graphic (the reference for the
  import's overlay shapes).

A layout not found by Id or Name is recorded as `error` in the JSON and skipped; please report which.

## Hand back

Reply to the smartart agent (or the supervisor) with the folder path and any errors from the run. The agent copies the `.pptx` and the
`.json` into `packages/pptx/test/fixtures/` and wires them into `test/sh-08-smartart-import.mjs`.
