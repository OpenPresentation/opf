# OPF 0.35.1 on Keynote for Mac: review pass

Evidence-only branch, never merged. The 0.34 pass this follows is in `mac-034/` and issue #1278.

- **OPF tested:** the published npm packages `@openpresentation/cli`, `opf-render` and `opf-pptx` 0.35.1 (`latest` on 2026-11-23). The corpus decks come from the `v0.35.1` tag (`f701ad61e2b608ac7df2cfd76c5ab52272be6200`). `tools/build-npm.mjs` is the repository's `qualification/build.mjs` with the CLI path pointed at the npm install. Node 26.7.0. `build.json` lists every file's SHA-256.
- **Mac:** macOS 26.6.2, Apple silicon. **Keynote 15.4 (7051.0.79).** The 0.34 pass ran on Keynote 15.1.1; Keynote was updated between the two passes. `control-034/` opens 0.34.0 files in 15.4 to tell OPF changes from Keynote changes.
- **Method:** the same as 0.34. AppleScript `open`, `export … as slide images` and a read-only object probe (`kn-probe2`). Every document was closed without saving, and every input's SHA-256 is unchanged (`_input-sha-*`). No alert appeared: all 67 corpus files, 5 digits decks, 6 fix decks and 3 control files opened. Hidden slides are not exported, as before.
- **No Apple theme material** is in this folder. Keynote window captures (`_window.png`) are left out.

## Layout

- `keynote/<file>/slides/`: Keynote's slide images of the 0.35.1 corpus (67 files). `_probe2.tsv` holds the per-slide fonts, title and layout. `_log.txt` and `_probe2-log.txt` hold the run logs.
- `letter-spacing/`: each of five decks exported as is and with every `spc` removed (`tools/nospc.py`). `spc-report.json` gives the share of pixels changed per slide, and `crops/` shows each changed region as with and without (`spc-montage.png`).
- `fonts/`: Keynote's fonts compared across three passes (`tools/fontcmp.py`). `rc-probe/` is the new probe of the 35 openable files of the 0.34 release candidate (`4eea78c`).
- `sheets/`: the issue #1278 items, each as OPF 0.35.1 preview | Keynote on 0.34 | Keynote 15.4 on 0.35.1.
- `fixes/`: the three 0.35.1 layout fixes. Decks `fixes-0351*.opf.json`, Keynote exports for 0.35.0 and 0.35.1, and sheets (0.35.0 preview | Keynote 0.35.0 | 0.35.1 preview | Keynote 0.35.1).
- `digits/`: the five digits decks rebuilt with 0.35.1 (`gen.mjs` is unchanged from `mac-034/digits`) and their Keynote exports.
- `control-034/`: the 0.34.0 coverage-overlays, coverage-charts and coverage-backgrounds files, built with the published 0.34.0 CLI and opened in Keynote 15.4. Overlays and backgrounds are byte-identical to the 0.34 pass files.

## Results

### 1. The two checks that did not run on 0.34

| Check | Result |
|---|---|
| Letter spacing on display text | **Applied.** On all 29 slides whose runs carry `spc` (footers, layout-harvest, coverage-text, data-story-academy, coverage-design; -261 to +133), Keynote's export differs from the no-spacing copy, and only in that text. None of the other 60 slides differ. Negative values tighten display text ("The footer reads 4 / 4.", "4.2", "Approve the four hubs today"), and +132 widens the small capitals labels, as in the preview (`letter-spacing/spc-montage.png`). |
| Fonts of the release-candidate files | **Same faces.** All 35 RC files that open (the two reference-line decks did not open on the RC) were probed in Keynote 15.4. The fonts of text items, shapes and table cells match the 0.34.0 final pass on every slide. The 21 slides that differ had no Title placeholder in the RC and gain one in 0.34.0 (#1291): the title shows, in Helvetica-Bold. Compared with 0.34.0, 0.35.1 changes fonts only where 0.35 meant to (#1397 language font defaults). Arabic titles and text use Times New Roman and Arial from the theme's `Arab` fonts, Japanese uses Yu Gothic, and Hebrew uses Verdana (Keynote's choice; the theme names Times New Roman and Arial). Chinese and Devanagari stay on Helvetica, because 等线 and Mangal are not on this Mac. The other differences are slides added to or removed from the decks. |

### 2. Open differences from issue #1278

| Difference | Deck, slide | On 0.35.1 | Picture |
|---|---|---|---|
| Negative-value bar chart: category labels clipped at the left edge ("ranes", "tware") | coverage-charts 15 | still present (pixel-identical) | `sheets/negative-bar.png` |
| Right-to-left table: only the first column drawn, clipped | digits ar-SA, ar-SA-u-nu-latn, fa-IR 4 | still present | `sheets/rtl-table-*.png` |
| Text beside the slide-number field dropped ("Page 1 of 4" → "1", "3 / 16" → "3", "1 / 5" → "1") | footers 1, 2, 4; data-story-academy; digits | still present; `footers~static` still shows "Page 1 of 4" | `sheets/footer-*.png` |
| Lines-only radar drawn filled; axis labels collide ("Research"/"Ship") and clip ("Researc") | coverage-charts 5 | still present (pixel-identical) | `sheets/radar-lines.png` |
| Secondary axis shows only 0% and 40%; the legend overlaps it | coverage-charts 14 | still present (pixel-identical) | `sheets/secondary-axis.png` |
| Solid background alpha (85%) drawn opaque | coverage-backgrounds 5 | still present (pixel-identical) | `sheets/bg-alpha.png` |
| Tiled picture background drawn as one large tile | coverage-backgrounds 11 | still present (pixel-identical) | `sheets/bg-tile.png` |
| Three-stop gradient shifts at its teal end | coverage-backgrounds 6 | still present (pixel-identical) | `sheets/bg-gradient.png` |
| Area chart gap at Sep bridged | coverage-charts 13 | still present (pixel-identical) | `sheets/area-gap.png` |
| Elbow connector routes differently | coverage-overlays 4 | **changed, still differs**: the loop now runs above Review instead of above Ship. The cause is Keynote 15.4, not OPF: the same 0.34.0 file draws the new route in 15.4, pixel-identical to 0.35.1 | `sheets/connector-elbow.png`, `sheets/connector-elbow-control.png` |
| Curved connectors drawn straight; some elbow routes differ | shape-overlays 3, 4, 5 | still present | `sheets/connectors-shape-overlays-*.png` |

"Pixel-identical" means that Keynote 15.4 draws the 0.34.0 file and the 0.35.1 file the same, and that the 0.34.0 file draws the same in 15.1.1 and in 15.4 (`control-034/`).

### 3. The three layout fixes new in 0.35.1

| Fix | Deck, slide | Keynote 0.35.0 → 0.35.1 | Picture |
|---|---|---|---|
| Column layouts anchor in the middle | fixes-0351 2 (three-column); fixes-0351-twocol 1, 2 (two-column) | **holds**: the short column ("Centered rich runs", "Weekly feedback…") moves from the foot of its box to the middle, as in the preview. Columns of equal length (layout-sampler 10, 11; fixes-0351 1) do not change, as expected | `fixes/fixes-2.png`, `fixes/twocol-1.png`, `fixes/twocol-2.png` |
| Blocks in cells: no empty band | fixes-0351 3 (top and bottom rows), 4 (diagonal) | **holds**: the empty middle row is gone; the top row grows and the diagonal blocks take halves, as in the preview | `fixes/fixes-3.png`, `fixes/fixes-4.png` |
| Bar chart on a short table's rows | fixes-0351-nocard 1 (2 rows), 2 (4 rows) | **holds**: the table grows and each bar stays on its row. Keynote still centers the chart title over the plot (a known Keynote difference). With content boxes (fixes-0351 5, 6) the fix does not apply, as the PR says; those slides are byte-identical in both versions | `fixes/nocard-1.png`, `fixes/nocard-2.png` |

## Not run

- PowerPoint for Mac (not installed).
- UI-only checks (the missing-font list, navigator and outline, Edit Data).
- Keynote 15.1.1 on 0.35.1: the Mac now has 15.4 only.
