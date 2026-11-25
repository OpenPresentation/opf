# Native-app testing

Read this page before you run OPF's exported files in a native application: Keynote, PowerPoint or LibreOffice Impress. It says
what a run is for, how to start one, how to read the result, and where a run sits in a release. The program that builds the
tools is [docs/programs/native-testing/](programs/native-testing/README.md); its decisions D1 to D6, given by the owner on
2026-11-25, are in [decisions.md](programs/native-testing/decisions.md). The command's own reference is "One command: pnpm
native" in [scripts/native-acceptance/README.md](../scripts/native-acceptance/README.md).

## What a run is for

OPF's preview does not prove what an application draws. A native run opens every exported `.pptx` of a tier in one application
and answers four questions for every file and slide:

1. **Does it open?** With no repair prompt; the application's own import warnings are recorded word for word.
2. **Does it look right?** The application's picture of each slide against OPF's preview.
3. **Is it native?** What each object became (`native`, `changed`, `picture`, `dropped`), in the 13 kinds of the shared result
   format ([core/result/README.md](../scripts/native-acceptance/core/result/README.md)).
4. **Does it come back?** The application's own PowerPoint copy of the file, imported with OPF.

Editing in the application's user interface is not part of a run.

## Targets

| Application | System | How it is driven | Who runs it | State today |
| --- | --- | --- | --- | --- |
| Keynote (`keynote`) | macOS | AppleScript through Keynote's own scripting dictionary ([apps/keynote/](../scripts/native-acceptance/apps/keynote/README.md)) | An agent session or the owner on the Mac | The driver is in the repository and tested without Keynote. Not run in Keynote yet |
| PowerPoint (`powerpoint`) | Windows | COM | The release supervisor session on the owner's Windows computer | Its driver runs there and writes a run directory in the shared format, which `pnpm native powerpoint --from-run` classifies. The format is proposed to that session on opf#1468: to be agreed |
| LibreOffice Impress (`impress`) | Linux, in CI | LibreOffice's headless conversion, `scripts/libreoffice/run.mjs` in `nightly.yml` | GitHub's runners | The runner writes the shared format into its artifact ([libreoffice.md](libreoffice.md)); the first real run is the nightly after that change merges. The nightly does not run the classify step, and there is no `known/impress.json` yet |
| PowerPoint for Mac (`powerpoint-mac`) | macOS | A reserved slot, no driver (decision D3) | The owner's: it needs a license and an install (opf#1314) | The command says "no driver yet" |

Native runs are not CI jobs (decision D4): an agent or the owner starts Keynote and PowerPoint runs on their own machines. Only
Impress runs on GitHub's runners.

## The command

```sh
pnpm native <target> [--tier smoke|release|full] [--decks a,b] [--baseline <opf version>|none] [--out <dir>]
                     [--from-run <dir>] [--warnings-dir <dir>] [--look deck#slide,...] [--release <x.y.z>]
                     [--write-summary] [--force-summary] [--json]
```

The steps are select, check, build, run, classify and report. `check` runs before the build and before every file; a refusal
opens nothing. The full list of flags is in the command's reference.

| Tier | What it runs today |
| --- | --- |
| `smoke` (the default) | About ten decks named in `tiers.smoke` of the qualification manifest, plus the decks that unreleased changelog fragments name in `native:` |
| `release` | Every deck and variant of the qualification corpus (`scripts/native-acceptance/qualification/`) |
| `full` | The corpus. The other sources (example decks, gallery layouts at three content sizes, language decks) cannot be built by the runner yet: they are listed as "not run" and the run exits with 2 |

In every tier, the slides that unreleased fragments name and the slides given with `--look` are reported as `new` whatever their
score, so someone looks at each one.

**Output.** `--out` must be a new or empty folder outside the repository. Without it the run goes to
`~/opf-work/native/<target>-<date>-<time>` when `~/opf-work` exists, else to the system's temporary folder. `<out>/build` holds
the exported files and OPF's previews; `<out>/run` the run directory, `classify.json` and a labeled sheet for every new slide
(`<out>/run/sheets/`). All of it is evidence and stays out of `main`.

**Exit codes.** 0: nothing new. 1: something new; look at each item. 2: refused, something not run, or the run could not finish.

```sh
pnpm native keynote --tier smoke --release 0.37.0 --warnings-dir ~/opf-work/warnings-0.37.0
pnpm native keynote --tier release --release 0.37.0 --out ~/opf-work/native/keynote-0.37.0
pnpm native powerpoint --from-run D:/opf-work/native/run --inputs D:/opf-work/native/build --previews D:/opf-work/native/build/preview
```

The baseline is, by default, the newest version under `scripts/native-acceptance/runs/` that has the target, below the
`--release` version when one is given; today that is 0.36.0 for Keynote. A run is never its own baseline.

**A release candidate** is built from a workspace that still carries the previous release's version
(`packages/cli/package.json`). `--release <x.y.z>` names the version the candidate will be released as. The report then names
both, for example "OPF workspace 0.36.0 at <commit>, release candidate 0.37.0": the workspace version is the previous release's,
and the commit identifies the candidate. `run.json` and every `result.json` keep the workspace's version and commit; only the
summary carries the release.

## Before a Keynote run

- The checkout is the commit you mean to test, installed and built (`pnpm install --frozen-lockfile`, `pnpm build:packages`).
- The owner starts Keynote. The run never starts, activates or quits Keynote.
- The screen stays unlocked for the whole run.
- No other Keynote document is open; `check` refuses when one is.
- One job at a time on the machine, and only the session that runs the command sends Keynote events. Before you start, read the
  tracking issue of any round that may be running (for 0.36.0, opf#1466).
- The run never saves and closes only the documents it opened.
- macOS permission prompts are the owner's to answer. An agent never approves one.
- Keynote shows its import warnings only while it is in front. An agent with computer use reads the Warnings window of each file
  and puts the text in `<dir>/<fileId>.txt`, passed with `--warnings-dir <dir>`; the run reads it when it opens that file. Without
  it, the warnings are recorded as `not-read`.

## Reading the result

Each slide gets one class:

| Class | Meaning |
| --- | --- |
| `same` | The picture matches OPF's preview (score at or below the threshold). |
| `known-present` | A known record names the slide, or the baseline reviewed it and the score has not moved beyond the tolerance. |
| `known-gone` | A known record names the slide, but the slide now matches the preview: the difference is gone. |
| `new` | Look here. Nobody has reviewed this difference, the score moved since the baseline, or a change names the slide. |
| `not-compared` | There is no picture pair (a hidden slide, or the render did not run). |

The file-level findings follow the same idea: an `open` that was not `done`, an import-warning line no record explains, a failed
import of the application's copy, and object outcome counts that differ from the baseline.

`new` means "look here". It never means that every other slide is unchanged. The classify step
([core/classify/README.md](../scripts/native-acceptance/core/classify/README.md), "What the rule cannot see") does not see:

- small shifts inside text that already differs (a one-space shift of wrapped lines under Keynote's Helvetica substitution);
- scores that move within the tolerance;
- anything on a slide no picture shows: a hidden slide, alt text, tags, names.

This is why a change that alters the exported file names its slide in its changelog fragment (`native: [deck#slide]`,
[changes/README.md](../changes/README.md)): the named slides are always `new`, so they are always looked at.

## What to do with a new item

Open its sheet and decide whose difference it is:

1. **Nothing visible**, or an intended change that the preview shows too: nothing to record. The next baseline carries the slide as
   reviewed.
2. **The application's limit** (the file is valid and the application reads it differently): add a record to
   `scripts/native-acceptance/known/<target>.json`, or add the slide to an existing record's `where`. A record has an `id`, the
   places (`where`: deck, variant, slide), what a user `sees`, `whose: application`, the `workaround` and `workaroundTried`, the
   `issue` if there is one, and `firstSeen` and `lastSeen`. Set `skill: true` only when an author can act on it; then run
   `pnpm build:native-known`, which regenerates the Keynote table in `skills/opf-export/SKILL.md`.
3. **OPF's defect** (its file, its importer reading the application's copy, or its preview when the preview is wrong and the
   exported file is right): open an issue, add a record with `whose: opf-file`, `opf-importer` or `preview` and that issue,
   and fix it. A failed import is recorded with `importError`, the
   importer's error code.
4. **A difference that is gone** (`known-gone`, or a `new` slide whose score went down): retire the record (`status: retired`) or
   narrow its `where`.

Then classify again (`pnpm native <target> --from-run <out>/run`, with the same `--release`). A run is clean when it exits
with 0.

## The release gate

Decision D1: a Keynote run gates OPF's defects only. A release supervisor applies these rules:

1. A release candidate is the commit of `main` that the Release workflow's dry run tested. Before the real run, Keynote runs the
   `smoke` tier on it, then the `release` tier, both with `--release <the version being released>`.
2. Each run must finish. Exit 2 is not a pass: fix the cause and run again.
3. Every `new` item of both runs is reviewed and settled as above, until the run classified again exits with 0.
4. A reviewed difference that is OPF's defect (`whose: opf-file`, `opf-importer` or `preview`) and first seen in this candidate
   blocks the release until it is fixed on `main` and a new candidate passes, or the owner accepts it in writing on the release's
   tracking issue.
5. A limit of the application (`whose: application`) is recorded and does not block.
6. An OPF defect first seen in an earlier release and still open does not block by itself. The release supervisor lists it under
   known differences on the release's tracking issue.

PowerPoint on Windows keeps its existing rule until its driver writes the shared format: "A change that moves what the export
writes (layout rules, chart geometry, text boxes) is opened in PowerPoint and compared with the preview before the owner is asked
to approve it and before it merges" ([working-rules.md of 2026-11-24](handoff/2026-11-24/working-rules.md), "PowerPoint before
merge"). Impress does not gate: its nightly leg is report-only, and `release.yml` turns it off in the release gate, until the
classify step runs on it and it has a known-difference file.

## After the release

- The summary of a release is `scripts/native-acceptance/runs/<version>/<target>.json` (decision D5). It is written from the
  reviewed candidate run, without opening Keynote again:
  `pnpm native keynote --from-run <out>/run --release <version> --write-summary`. Its `opf` is the release's version with the
  candidate's commit. It is written only for a run that finished (exit 0 or 1), and it never replaces an existing summary unless
  `--force-summary` is given; without it the command says which file it would have replaced and exits with 2.
- Commit the summary in a small pull request after the release, together with the updated known records: set `lastSeen` (the application's version and the release) on
  every record the run reported, and retire the records that are gone. No tool updates `lastSeen`; it is edited by hand.
- Pictures, sheets, saved decks and logs go to an evidence branch (`codex/evidence-<slug>`), are attached to the issue, or stay
  on the machine. They never go into `main` (`pnpm check:evidence-size`).

## Who does what

| Who | Does |
| --- | --- |
| The owner | Starts Keynote on the Mac, answers macOS permission prompts, keeps the screen unlocked, accepts an OPF defect in writing when it should not block, and provides the license and install for PowerPoint for Mac |
| An agent on the Mac | Checks out and builds the candidate, reads Keynote's Warnings window, runs `pnpm native keynote`, reviews every new item, writes the known records and issues, reports the result on the release's tracking issue, and after the release writes and commits the Keynote summary |
| The release supervisor on Windows | Runs the PowerPoint pass on the owner's Windows computer and applies the gate before the real run |
| CI | Runs the Impress leg in `nightly.yml` and the tests of the pure parts (`pnpm check:native`) without any application |
