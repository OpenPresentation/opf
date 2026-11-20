# Kickoff prompt for the next agent

Give the next agent the text below as its first message. It works for any capable coding agent with a shell, `git`, `gh` (authenticated for OpenPresentation and Data-Advantage), Node 24 and pnpm. PowerPoint checks need a Windows machine with PowerPoint; any agent on another OS skips them and lists them as owed.

---

You are continuing work on OPF (OpenPresentation Format), the monorepo `OpenPresentation/opf`, and its three sites: `Data-Advantage/openpresentation-site` (openpresentation.org), `Data-Advantage/pptx-gallery` (pptx.gallery) and `Data-Advantage/pptx-dev` (pptx.dev). The owner wants all open work finished and released in at most two releases, v0.33.0 then v0.34.0, with every public site, doc, example and gallery updated after each release. Work autonomously. Make reasonable calls yourself, record each one as a vetoable decision, and stop only for the owner-only steps listed below.

1. Clone `OpenPresentation/opf` and read, in this order:
   - `AGENTS.md`
   - `docs/handoff/2026-11-07/README.md` (state, priorities and the exact next steps)
   - `docs/handoff/2026-11-07/working-rules.md` (binding: CI batching, goldens, merging, PowerPoint COM rules, owner rules)
   - `docs/handoff/2026-11-07/decisions.md`
   - `docs/handoff/2026-11-07/com-checks.md`
   - `docs/handoff/2026-11-07/sites-docs-inventory.md`
   Review sheets and the SmartArt sweep tools are on the evidence-only branch `handoff/review-sheets-2026-11-07` (never merge it).

2. Finish **v0.33.0**, following README.md step 1:
   - Bring integration PR #1133 to green: the golden commit, a merge from main, one push, then `node scripts/pr-gate.mjs OpenPresentation/opf#1133 --expect-head <full sha> --required all`.
   - Run the final PowerPoint pass if you are on Windows with PowerPoint (`scripts/native-acceptance/qualification/` plus `com-checks.md`). Otherwise record it as owed in the PR.
   - Squash-merge #1133.
   - Release through the Release workflow (`docs/release-process.md`; a dry run first).

3. Update the sites for 0.33.0 (README.md step 2): fold the drafts into the bump PRs, then do the hosted MCP viewer branch. Verify each site build locally and on its PR preview before merging. openpresentation.org deploys on every merge to `main`.

4. Build **v0.34.0** (README.md step 3):
   - Review the wave-2 PRs listed there. Code review for all of them; sheet review for anything that moves slides, judged against the owner's direction: bodies fill the slide, type grows, never shrink text, no lines past about 70 characters.
   - Fold the approved ones into one wave-2 integration PR, regenerate goldens once, and get it green.
   - Then build the not-started items listed there, in further waves. Each item gets a PR with a fragment, a test, a burndown row and a log line.
   - Release v0.34.0, then do the 0.34 site updates.

5. Throughout:
   - Keep every result on GitHub (PRs and pushed branches); nothing local-only.
   - Update `docs/handoff/2026-11-07/README.md`, or write a new dated handoff next to it, whenever the state changes, so the next agent can resume from it.
   - Never push to a PR that has been folded into an integration PR.
   - Never write CI polling loops; use `scripts/pr-gate.mjs`.

Owner-only steps (ask; don't do):
- adding the openpresentation.org MCP connector in Claude;
- uninstalling the local `.mcpb` extension;
- promoting LibreOffice from "experimental";
- the D2 decision;
- any deploy, DNS change or login.

---
