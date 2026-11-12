# v0.34.0 release candidate on Keynote for Mac: evidence

Evidence-only branch, never merged. Report: the issue "v0.34.0 on Keynote and PowerPoint for Mac" in OpenPresentation/opf.

- Source tested: `codex/integration-034` at `4eea78c2efbd40f576b395ab57bdbba87ae6d744` (no `v0.34.0` tag existed at the start). Built in a fresh worktree with Node 24.21.0, `pnpm install --frozen-lockfile`, `pnpm build`; corpus from `node scripts/native-acceptance/qualification/build.mjs` (see `corpus/build.json`).
- Mac: macOS 26.6.2 (25G83), Apple silicon. Keynote 15.1.1 (7044.0.273), installed as "Keynote Creator Studio". PowerPoint for Mac is not installed: not run.
- Keynote was driven only by AppleScript `open`, `export` (slide images; a PPTX copy for the round trip) and read-only object counts; every document was closed without saving and every input's SHA-256 is unchanged. Alerts were never clicked: the runner captured the alert window and quit Keynote (it had no other documents).
- This Mac has no Office fonts: Keynote shows a non-modal "This presentation has missing fonts." banner on every deck that names one (`corpus/missing-fonts.json`, `corpus/installed-font-families.txt`).

## Layout

- `corpus/keynote-open-log.txt`: open result per file (`HUNG`/`FAILED-ALERT` = Keynote showed an alert; the alert is in `keynote-slides/<file>/_hang-window-0.png`).
- `corpus/keynote-slides/<file>/slide-<n>.png`: Keynote's own export (native 960 x 540); `_window.png` is the document window right after opening (shows the font banner).
- `corpus/sheets/<file>-<n>.jpg`: OPF preview | Keynote (scaled to 1280 x 720) | pixel difference (>= 24/255), at half size. `corpus/keynote-scores.json` has the difference share per slide (a pointer, not a verdict).
- `corpus/probe/<file>.txt`: per-slide object counts from Keynote (charts, tables, images, shapes, lines, groups, text items, skipped).
- `corpus/roundtrip/`: the PPTX Keynote exported for the round-trip decks and the reports of importing it (and the original) with the candidate's `opf convert`.
- `grades/*.md`: slide-by-slide grading against the manifest.
- `digits/`: the five digits decks (sources, generator, Keynote slides, sheets); `grades/digits.md`.
- `compare-033/`: the same small decks built with published 0.33.0 and with the candidate, opened in Keynote (`cmp-montage.png`, `cts-033-vs-rc.png`).
- `bisect/`: the chart open failure. `keynote-log*.txt` lists every variant; `alerts/` the alert per failing variant; `pptx/` the key files (`r1-line.pptx` fails, `r1-line__axpos.pptx` opens); `axfix-check.png` how the fixed files look.
- `tools/`: the scripts used (AppleScript runner, alert watchdog, sheet builder, XML variant builders, grading brief).
