# Brief: Keynote and PowerPoint for Mac review of v0.34.0

Give this file to an agent on the Mac mini after v0.34.0 is published. It is a review, not a gate: the release does not wait for it.

## Goal

Open the v0.34.0 qualification corpus in Keynote and in PowerPoint for Mac, compare each slide with OPF's own preview, and report
what differs. The Windows PowerPoint pass was done on 2026-11-12; this adds the two Mac apps.

## Rules

- Read `AGENTS.md` and [working-rules.md](../2026-11-07/working-rules.md) first. American English.
- Keynote: open read-only and never save. PowerPoint: open read-only, close only what you opened, never save over an input.
- No UI scripting beyond opening a file and exporting slide images (AppleScript `export` and `open` are fine); mark anything that
  needs the UI "not run".
- One driver per app at a time. Check that the app is not already running with someone's documents before you start; never quit
  an app that has other documents open.
- Evidence stays out of the tree (`pnpm check:evidence-size`): attach images and logs to the issue you open, do not commit them.
- No pushes to `main`, no release, no site change. One pull request at most, with the result table only.

## Steps

1. Fresh worktree from the tag: `node scripts/agent-worktree.mjs add mac-034-review`, then check out `v0.34.0`,
   `pnpm install --frozen-lockfile`, `pnpm build`.
2. Build the corpus: `node scripts/native-acceptance/qualification/build.mjs --out <dir>` (see
   `scripts/native-acceptance/qualification/README.md`). `<dir>/pptx/` holds the files to open and `<dir>/preview/` OPF's preview.
3. For each file, in each app: open it, note any repair or font-substitution dialog, export every slide as PNG at 1280 x 720.
4. Compare with the preview slide by slide. Grade the features in `manifest.json` (`checks` says what each check means). Look in
   particular at what v0.34.0 added: duration timelines, image callouts, reference lines, overlays anchored to chart points,
   inverted pyramids, org chart, hierarchy and Venn layouts (editable shapes), DOT and PlantUML diagrams, wrapped titles, the
   slide-level language decks, and digits in `ar-SA` and `fa-IR` decks (which numbers the app draws in the language's digits).
5. Keynote does not lay out SmartArt: grade the picture fallback there (`fallback` in the manifest).

## Report

Open one issue in `OpenPresentation/opf` titled "v0.34.0 on Keynote and PowerPoint for Mac" with: app versions and macOS version;
per file, opened without repair or not; a table of differences (deck, slide, app, what differs, how large); the images attached.
Add a short result table under RR-105 in `docs/programs/release-readiness/burndown.md` by pull request. State plainly what was
not run.
