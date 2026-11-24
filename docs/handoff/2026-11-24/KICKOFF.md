# Kickoff prompt for the next agent

Give the next agent the text below as its first message. It works for a capable coding agent with a shell, `git`, `gh` (authenticated for OpenPresentation and Data-Advantage), Node 24 and pnpm. It is written for a Mac: PowerPoint checks need the owner's Windows computer, and the agent lists them as owed.

---

You are continuing work on OPF (OpenPresentation Format), the monorepo `OpenPresentation/opf`, and its three sites: `Data-Advantage/openpresentation-site` (openpresentation.org), `Data-Advantage/pptx-gallery` (pptx.gallery) and `Data-Advantage/pptx-dev` (pptx.dev). OPF 0.35.1 is released and live on all three sites. 0.36.0 is the fixes release, cut from the owner's Windows computer. Your job is what follows it: OPF 0.37.0, the format changes the owner kept in his review.

Work autonomously. Make reasonable calls yourself, record each as a decision the owner can veto, and stop only for the owner's own steps.

1. Clone `OpenPresentation/opf` and read, in this order:
   - `AGENTS.md`
   - `docs/handoff/2026-11-24/README.md` (the two decisions of 2026-11-24, the state, what is open, who does what)
   - `docs/handoff/2026-11-24/working-rules.md` and `docs/handoff/2026-11-07/working-rules.md` (binding)
   - the plan page named in the README, if you can open it

2. Check whether the tag `v0.36.0` exists. If it does not, 0.36.0 is still being assembled: do not start a second release run. Ask the owner whether the Windows session is still on it; if he hands it to you, finish it from the state the release tracker gives, and list every PowerPoint check you cannot run as owed.

3. If 0.36.0 is released and the three sites are not on it, update them, one pull request at a time per site, with the site gate in the working rules.

4. Do the Keynote checks the README lists. The owner starts Keynote. Never save in it.

5. Do not build any format change until the owner has answered the review. When he has, open `docs/programs/format-requests/` with one item per kept change and land them on `main` in the plan's order. Release 0.37.0 through the Release workflow (`docs/release-process.md`; a dry run first), then update the sites.

Rules that are easy to get wrong:

- Show the owner every drawing change as labeled before-and-after pictures before it merges. He judges the picture.
- OPF's preview does not prove what PowerPoint draws. A change to what the export writes stays open until it has been opened in PowerPoint on the Windows computer. Say in the pull request that the pass is owed, and ask the owner for a Windows session.
- Sealed files change only with the owner's word, asked once per batch.
- The product split of 2026-11-24 (README): the OPF site and its schema ids stay on openpresentation.org; openpresentation.com is the platform; pptx.dev is a small browser tool. Plan nothing that assumes otherwise.
- Never write a CI polling loop or a wait loop. Use `scripts/pr-gate.mjs`.
- American English. No public support or progress badges. No deprecations or aliases before 1.0.

The owner's own steps (ask; do not do): DNS records and routes, any login or dashboard setting, the GitHub app's permissions, adding a connector in Claude, and his answers on the review page.

---
