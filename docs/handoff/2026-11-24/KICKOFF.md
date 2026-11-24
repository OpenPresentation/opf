# Kickoff prompt for the next agent

Give the next agent the text below as its first message. It works for a capable coding agent with a shell, `git`, `gh` (authenticated for OpenPresentation and Data-Advantage), Node 24 and pnpm. It is written for a Mac: PowerPoint checks need the owner's Windows computer, and the agent lists them as owed.

---

You are continuing work on OPF (OpenPresentation Format), the monorepo `OpenPresentation/opf`, and its three sites: `Data-Advantage/openpresentation-site` (openpresentation.org), `Data-Advantage/pptx-gallery` (pptx.gallery) and `Data-Advantage/pptx-dev` (pptx.dev). OPF 0.35.1 is released and live on all three sites. Your job is OPF 0.36.0: one release that carries the work begun after 0.35.1, the format changes the owner kept in his review, and the move to openpresentation.com.

Work autonomously. Make reasonable calls yourself, record each as a decision the owner can veto, and stop only for the owner's own steps.

1. Clone `OpenPresentation/opf` and read, in this order:
   - `AGENTS.md`
   - `docs/handoff/2026-11-24/README.md` (the state, what is open, who does what)
   - `docs/handoff/2026-11-24/working-rules.md` and `docs/handoff/2026-11-07/working-rules.md` (binding)
   - the OPF 0.36 Plan page named in the README, if you can open it

2. Finish the carried work (group 0 in the README): merge opf#1442 if it is still open and green, then the open issues listed there and every finding of the PowerPoint test round of 0.35.1 as its tracking issue (opf#1441) reports them. One pull request per item or small group, each with a changelog fragment and a test.

3. Do the Keynote checks the README lists. The owner starts Keynote. Never save in it.

4. Do not build any format change until the owner has answered round 2 of the review. When he has, land the kept changes on `main` in the plan's order.

5. Release 0.36.0 through the Release workflow (`docs/release-process.md`; a dry run first), then update the three sites, one pull request at a time per site, with the site gate in the working rules.

Rules that are easy to get wrong:

- Show the owner every drawing change as labeled before-and-after pictures before it merges. He judges the picture.
- OPF's preview does not prove what PowerPoint draws. A change to what the export writes stays open until it has been opened in PowerPoint on the Windows computer. Say in the pull request that the pass is owed, and ask the owner for a Windows session.
- Sealed files change only with the owner's word, asked once per batch.
- Never write a CI polling loop or a wait loop. Use `scripts/pr-gate.mjs`.
- American English. No public support or progress badges. No deprecations or aliases before 1.0.

The owner's own steps (ask; do not do): DNS and the domain move, any login or dashboard setting, the GitHub app's permissions, adding a connector in Claude, and his answers on the review page.

---
