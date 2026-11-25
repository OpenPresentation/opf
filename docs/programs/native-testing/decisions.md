# Native-app testing: decisions

The questions are the "Decisions for the owner" of opf#1468, plus the choice of languages. Program: [README.md](README.md); items:
[burndown.md](burndown.md).

Who decided: all six were given by the owner (Michael Grimm) on 2026-11-25 in the supervisor session, answering a question that came
with a recommendation. Each decision says whether he took the recommended option. An overruled or changed decision changes its section
here and the items that depend on it.

| ID | Question | Decision | Who |
| --- | --- | --- | --- |
| D1 | Is a Keynote pass a gate or a review? | A gate for OPF defects only | Owner, 2026-11-25, as recommended |
| D2 | What does a Keynote user get by default? | A Keynote export profile (opf#1298) | Owner, 2026-11-25; the recommendation was to document `--typefaces safe` |
| D3 | PowerPoint for Mac on the Mac (opf#1314) | Later; a reserved slot, no driver now | Owner, 2026-11-25, as recommended |
| D4 | Self-hosted runners or agent-started runs? | Agent-started runs now | Owner, 2026-11-25, as recommended |
| D5 | Where does the per-run record live? | A small JSON summary per release and target in the repository | Owner, 2026-11-25, as recommended |
| D6 | Which languages? | Node for shared code; AppleScript and PowerShell only in their drivers | Owner, 2026-11-25, as recommended |

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

## Open

- The result format and the five verbs are to be agreed with the Windows release supervisor on opf#1468 before NT-02 merges.
