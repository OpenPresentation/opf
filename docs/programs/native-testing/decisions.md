# Native-app testing: decisions

The questions are the "Decisions for the owner" of opf#1468, plus the choice of languages. Program: [README.md](README.md); items:
[burndown.md](burndown.md).

Who decided: D1 to D6 were given by the owner (Michael Grimm) on 2026-11-25 in the supervisor session, answering a question that came
with a recommendation; D7, D8 and D9 came on 2026-11-27. Each decision says whether he took the recommended option. An overruled or changed decision changes its section
here and the items that depend on it.

| ID | Question | Decision | Who |
| --- | --- | --- | --- |
| D1 | Is a Keynote pass a gate or a review? | A gate for OPF defects only | Owner, 2026-11-25, as recommended |
| D2 | What does a Keynote user get by default? | A Keynote export profile (opf#1298) | Owner, 2026-11-25; the recommendation was to document `--typefaces safe` |
| D3 | PowerPoint for Mac on the Mac (opf#1314) | Later; a reserved slot, no driver now | Owner, 2026-11-25, as recommended |
| D4 | Self-hosted runners or agent-started runs? | Agent-started runs now | Owner, 2026-11-25, as recommended |
| D5 | Where does the per-run record live? | A small JSON summary per release and target in the repository | Owner, 2026-11-25, as recommended |
| D6 | Which languages? | Node for shared code; AppleScript and PowerShell only in their drivers | Owner, 2026-11-25, as recommended |
| D7 | How big is the native corpus, and when does each part run? | Option A: one trimmed corpus, run in tiers | Owner, 2026-11-27, as recommended |
| D8 | How is the Keynote gate handled for 0.37.0? | The smoke tier gates; the release tier runs after the release and is recorded | Owner, 2026-11-27, to the release supervisor |
| D9 | May 0.37.1 be released without its Keynote run? | Yes, as an exception for this patch: its exported files are identical to 0.37.0's | Owner, 2026-11-27, to the release supervisor |

## D1: a gate or a review

Question: is a Keynote pass a gate that can stop a release, or a review that only reports?

Options: a gate for OPF defects only (recommended); a gate for every new difference; a review, as in the rounds of 0.34.0 to 0.36.0.

Decision: the `smoke` and `release` tiers gate OPF defects only. A new difference that is OPF's defect blocks the release. A new limit of
the application is recorded as a known difference and does not block.

Who: the owner, 2026-11-25, as recommended.

Follows: NT-04 classifies every new difference as OPF's or the application's; NT-08 writes the gate into `docs/release-process.md`.

## D2: what a Keynote user gets by default

Question: Keynote 16.0 on a Mac without Microsoft 365 reports Aptos and Aptos Display missing on every default-theme deck, with the banner
"This presentation has missing fonts." Exporting with `--typefaces safe` removes the banner (seen in the 0.36.0 round, opf#1466). What
should a Keynote user get by default?

Options: document `--typefaces safe` for Keynote (recommended); a Keynote export profile (opf#1298) that sets safe typefaces together
with static slide numbers; record the warning only and change nothing.

Decision: a Keynote export profile (opf#1298) that sets safe typefaces together with static slide numbers.

Who: the owner, 2026-11-25. The recommendation was to document `--typefaces safe`.

Follows: NT-09. Until the profile ships, the warning is a known-difference record with `--typefaces safe` as its workaround.

## D3: PowerPoint for Mac

Question: should the program drive PowerPoint for Mac on the Mac now (opf#1314)?

Options: later, keeping a slot (recommended); now.

Decision: later. The program keeps a slot, `powerpoint-mac`, with the same five verbs, and builds no driver now. It needs a Microsoft 365
license and an install, which are the owner's to provide.

Who: the owner, 2026-11-25, as recommended.

Follows: opf#1314 stays open. No item in the burndown builds this driver.

## D4: where a run starts

Question: self-hosted runners on the owner's machines, or runs started by an agent session or the owner?

Options: agent-started runs now, Impress on GitHub's runners, self-hosted runners later only if needed (recommended); self-hosted runners
now.

Decision: agent-started runs now. An agent session or the owner runs `pnpm native <target>` on the machine. Impress stays on GitHub's
runners. Self-hosted runners may come later and would run the same command.

Who: the owner, 2026-11-25, as recommended.

Follows: every driver is started from the command line on its own machine; no workflow starts Keynote or PowerPoint.

## D5: where the per-run record lives

Question: is the record of a run kept in the repository, or only on evidence branches and in workflow artifacts?

Options: a small JSON summary per release in the repository (recommended); only evidence branches and workflow artifacts.

Decision: one small JSON summary per release and target in the repository (`scripts/native-acceptance/runs/<version>/<target>.json`):
the application version, the counts, and the new and known differences by id. Pictures, sheets and saved decks stay on evidence branches
and in workflow artifacts.

Who: the owner, 2026-11-25, as recommended.

Follows: NT-01 defines the summary; NT-05 writes it.

## D6: languages

Question: which languages may the program's code use?

Options: Node for shared code, the application's own scripting language only in its driver (recommended); a scripting runtime beside
Node; compiled helpers.

Decision: shared code is Node (`.mjs`, no new runtime in CI). AppleScript is used only for Keynote, PowerShell only in the Windows driver.
No compiled helpers in the repository.

Who: the owner, 2026-11-25, as recommended.

Follows: NT-02 ports the evidence branch's Python probe to Node or to AppleScript.

## D7: the size of the corpus

Question: after the corpus study ([corpus-study.md](corpus-study.md)), how many files should a native run open, and when? Today's chain
opens about 400 files in Keynote.

Options: A, one manifest trimmed to about 80 files, with tiers by what changed (recommended); B, a corpus chosen by coverage with
merged decks; C, a generated corpus with one slide per unit.

Decision: option A, "Yes, build A". One trimmed corpus for Keynote, PowerPoint and LibreOffice Impress. Every release candidate runs
the smoke tier plus the files with a changed slide. Every release runs the corpus plus the stress decks. A new application version or
a yearly sweep adds the examples (default variant), the gallery layouts at three sizes and the languages. It stays maintainable through a
coverage report, checks, and a time budget per tier.

Who: the owner, 2026-11-27, in the supervisor session, as recommended.

Follows: NT-10 to NT-14 (the stress decks, the coverage report and checks, the changed-slide tier, LibreOffice reading the manifest's
tiers) and NT-11 (trim smoke and settle the variants).

## D8: the Keynote gate for 0.37.0

Question: how should the first release after the Keynote driver handle the gate: smoke only, the full corpus, or none?

Decision: "Yes, in 0.37.0", given by the owner on 2026-11-27 to the release supervisor. The supervisor's session relayed it and its reading
is recorded on opf#1538: the smoke tier gates the release, and the release tier runs after the release and is recorded.

Who: the owner, 2026-11-27, to the release supervisor; relayed by that session, which gave the reading.

Follows: the smoke run of 2026-11-27 (NT-05) gated 0.37.0. The release tier's run is recorded in `runs/0.37.0/keynote.json` after it runs.

Note on variants: the `static`, `picture` and `shapes` variants stay in the release tier until one PowerPoint run compares them with
their default files. The Windows supervisor has no record of them showing anything; that is an absence of evidence, not a measurement
(NT-11). The study found no reviewed finding in them on Keynote.

## Agreed after the decisions

- **2026-11-25: the result format and the five verbs.** The release supervisor on Windows agreed the shared result format
  (`scripts/native-acceptance/core/result/README.md`) and the five verbs on opf#1468
  ([comment of 2026-11-25](https://github.com/OpenPresentation/opf/issues/1468#issuecomment-7174529699)), with the additions
  of NT-01b that it asked for: the kinds `diagram` and `media` (15 kinds), alt text, `details` on the result and the slide,
  and edit cases beside `resave`. The Windows command that writes a run directory is the release supervisor's and comes after
  the 0.37.0 format changes.
- **2026-11-25: the Keynote export profile's design (D2).** Agreed on opf#1298 by the 0.37.0 release supervisor under the
  owner's delegation: `reader` with the values `powerpoint` and `keynote`. Version 1 of `keynote` sets safe typefaces, static
  slide numbers, SmartArt as shapes and native body text; native body text is on condition of one Keynote smoke run of
  profile exports. The profile is NT-09 (#1508).

## D9: 0.37.1 without its Keynote run

Question: the Keynote gate for the 0.37.1 candidate `8bc766056` could not run because the Mac's screen was locked. Release on the
evidence that its exported files are identical to 0.37.0's, or wait for the Mac to be unlocked and the smoke tier to run?

Decision: "Release now", given by the owner on 2026-11-27 to the release supervisor. The supervisor's session relayed it and recorded
on opf#1538 that the Keynote gate was not run and that the release goes out on the owner's word as an exception to D1 for this patch.

Evidence the decision rests on (ran, without any application): all 74 release-tier files built at the candidate have the same
per-slide export hashes as the 0.37.0 Keynote summary (645 of 645 slides, no deck-level change), and every one of those files was
opened in Keynote on the same day (the 0.37.0 release tier).

Who: the owner, 2026-11-27, to the release supervisor; relayed by that session.

Follows: it sets no precedent for a release whose exported files differ. A candidate whose hashes all equal the last release's
summary is a case the process could name on its own (the `candidate` tier already opens only the smoke tier then); whether an
identical export may skip the application run is left open and belongs to NT-11.
