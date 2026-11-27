# Native-app testing (NT)

Opened 2026-11-25. Branches `codex/nt-<nn>-<slug>`, pull request titles `NT-<nn>: `. Items and status: [burndown.md](burndown.md). Every
decision, with who gave it: [decisions.md](decisions.md). The corpus study: [corpus-study.md](corpus-study.md).

## Goal

OPF exports one `.pptx`. People open it in PowerPoint, Keynote and LibreOffice Impress, on Windows, macOS and Linux. Today each of those
is checked a different way, by a different session, with tools that mostly live outside the repository. This program gives them one
corpus, one command (`pnpm native <target>`), one result format, one driver per application behind the same five verbs, known
differences as data instead of prose, and a place in the release process. The proposal is opf#1468; its first use is the Keynote round
of 0.36.0, opf#1466. State on 2026-11-27: items NT-00 to NT-09 are built, NT-02 and NT-05 are done (the first Keynote run and the smoke gate of
0.37.0 ran that day), and NT-10 to NT-16 follow the corpus study ([corpus-study.md](corpus-study.md), decision D7): stress decks, a
coverage report, a changed-slide tier, tiers for LibreOffice, Keynote warnings and the PowerPoint driver.

## What exists today

| Application | How it is checked | Where the tools are | Gates a release |
| --- | --- | --- | --- |
| PowerPoint, Windows | COM scripts open the file, export pictures and probe the objects; the qualification corpus and its manifest | Partly in `scripts/native-acceptance/`; the tools of the current pass are on the owner's Windows computer | No; a working rule asks for a pass before merge |
| Impress, Linux | `scripts/libreoffice/run.mjs` converts the corpus with a pinned LibreOffice in `nightly.yml` | In the repository | No; experimental, and `release.yml` turns it off in the release gate |
| Keynote, macOS | An agent session on the Mac, once per round | Only on the evidence branch `codex/evidence-mac-036` | No; a review. Decision D1 makes it a gate for OPF's defects ([docs/native-testing.md](../../native-testing.md)) |
| PowerPoint, macOS | Never run (opf#1314) | None | No |

## Targets

| Target | System | Driven by | Who runs it |
| --- | --- | --- | --- |
| `keynote` | macOS | AppleScript through Keynote's own scripting dictionary; computer use only for what the dictionary cannot reach | An agent session or the owner on the Mac |
| `powerpoint` | Windows | COM | The release supervisor session on the owner's Windows computer |
| `impress` | Linux, in CI | LibreOffice's headless conversion | GitHub's runners (`nightly.yml`) |
| `powerpoint-mac` | macOS | A reserved slot with the same five verbs; no driver now ([D3](decisions.md#d3-powerpoint-for-mac)) | Nobody yet |

## The four questions

Every target answers the same four questions for every file and every slide:

1. **Does it open?** With no repair prompt; the application's own import warnings are recorded word for word.
2. **Does it look right?** The application's picture of each slide against OPF's preview.
3. **Is it native?** What each object became, in one vocabulary shared by all targets: `title`, `body`, `text`, `list`, `table`,
   `chart`, `shape`, `connector`, `group`, `picture`, `link`, `notes`, `footer`.
4. **Does it come back?** The application's own PowerPoint copy of the file, imported with OPF, with what was lost.

Editing checks need the application's user interface and stay a short agent task on the slides these four flag.

## The five verbs

Each driver implements the same five verbs and writes only the shared result format (NT-01):

| Verb | What it does |
| --- | --- |
| `check` | Says whether this machine can run this target now: application version, fonts, screen unlocked, no documents the run did not open. It never starts or quits the application. |
| `open` | Opens each file and records whether it opened and the application's import warnings. |
| `render` | Exports a picture of each slide. |
| `probe` | Lists what each object became, in the shared vocabulary. |
| `resave` | Exports the application's own PowerPoint copy into the run's output folder; the input is never saved. |

## Tiers

| Tier | What it runs |
| --- | --- |
| `smoke` | About ten decks; gates every release. |
| `candidate` | The smoke tier plus the files with a changed slide (NT-13, D7). |
| `release` | The qualification corpus (`scripts/native-acceptance/qualification/`). |
| `full` | The corpus, the stress decks (NT-10), the example decks, the gallery layouts with little, ordinary and a lot of content, and the language decks. |

NT-05 defines the exact lists from the qualification manifest (`tiers` in `qualification/manifest.json`, read by
`qualification/tiers.mjs`). The `full` tier's sources beyond the corpus are not built by the runner yet; a `full` run lists them as
"not run".

## Layout

The layout as built, all under `scripts/native-acceptance/`. How a run is started and read, and the release gate:
[docs/native-testing.md](../../native-testing.md).

| Path | What it holds |
| --- | --- |
| `core/result/` | The shared result format: schemas, validators, fixtures from the 0.36.0 Keynote round (NT-01). |
| `core/compare/` | OPF's preview against the application's picture, and the labeled sheet (NT-04a). |
| `core/roundtrip/` | The objects of the exported file and of the application's copy, their outcomes, OPF's import of the copy (NT-04b). |
| `core/classify/` | Classify, the summary format, the one-time baseline importer (NT-04c). |
| `apps/keynote/` | The Keynote driver behind the five verbs, and the importer of the 0.36.0 round's recorded output (NT-02, NT-04a). |
| `apps/impress/` | The LibreOffice runner's output in the shared format (NT-06). |
| `known/` | `known/<target>.json`, its schema, and the generator of the Keynote table in the export skill (NT-03). |
| `runs/<version>/<target>.json` | The small summary of one release's run on one target; `runs/0.36.0/keynote.json` is the first (NT-04c). |
| `native.mjs` | `pnpm native <target>`, the one entry point (NT-05). |

## Definition of done

1. Every row of [burndown.md](burndown.md) is merged.
2. `pnpm native keynote --tier smoke` runs end to end on the Mac.
3. The LibreOffice nightly job's artifact is in the shared result format.
4. The PowerPoint driver on Windows writes the same files, as agreed on opf#1468.
5. The Keynote table in `skills/opf-export/SKILL.md` is generated from the known-difference data, and a check fails when they drift.
6. `docs/release-process.md` says where a native run sits, who starts it and what blocks a release.

## Invariants

- One result format; a driver writes nothing else. One classify step, shared by all targets.
- `check` never starts or quits an application. It refuses when the screen is locked or when a document the run did not open is open.
- In an application: never save, never quit it, close only the documents the run opened, and never approve an operating-system
  permission prompt. The owner starts Keynote. One job per application per machine at a time.
- `open` and export are scripted through the application's own scripting interface; computer use only for what that interface cannot
  reach.
- Shared code is Node (`.mjs`). AppleScript only drives Keynote and PowerShell appears only in the Windows driver. No compiled helpers and
  no new runtime in CI.
- No file of Apple's or Microsoft's goes into the repository: no scripting dictionaries, themes or fonts.
- Evidence stays out of `main`: pictures, sheets, saved decks and logs go to an evidence branch or a workflow artifact. Only the small
  JSON summary per release and target is committed.
- Every statement in a report says whether it was run or inferred. A check that did not run is "not run", never "passed".
- The PowerPoint driver is written and run on Windows by the release supervisor. This program does not write PowerShell it cannot run.
- The tests of the pure parts (format, compare, classify, known differences, argument parsing) run in CI without any application.

## Resume protocol

Read this file, [burndown.md](burndown.md) and [decisions.md](decisions.md), then the latest comments on opf#1468. Before sending
Keynote any event, check on opf#1466 whether another session is driving it. The 0.36.0 round's recorded output on the Mac
(`~/opf-work/keynote-036/`) is read-only: compare against it, never write into it. Work in your own worktree
(`node scripts/agent-worktree.mjs add nt-<nn>-<slug>`) from a fresh `origin/main`, run `pnpm check:changed` before you report, and in the
pull request that changes an item's state, edit its row in the burndown and append a line to the progress log.
