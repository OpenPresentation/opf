# opf#323 native PowerPoint runs on the published 0.18 packages: how to run them (root session only)

An agent prepared everything here **without opening PowerPoint, Office or COM**. Only the root session runs the commands below.

- **Packages.** Built with the published `@openpresentation/opf` 0.18.1, `opf-render` 0.18.0, `opf-pptx` 0.18.0 and `opf-editor`
  0.18.0, plus fontkit 2.0.4. The versions are pinned in `package.json` and recorded in `manifest.json`.
- **Build.** Node 24.21.0, `zipDate` 2026-10-10T00:00:00Z. The export host date is 2026-01-15, so live date fields must not show it.
- **Nothing here goes into the repository as is.** Evidence goes to `docs/evidence/<item>-native-<yyyymmdd>/` as a README plus
  `compare.md` and `compare.json`, with no decks, PNGs or absolute paths.

| Set | Item | Decks | What |
| --- | --- | ---: | --- |
| `ff12` | RR-05 / FF-12 | 12 | The bounded sample, with the same twelve decks as the 2026-10-05 run. It covers Carlito with code, chart, table and notes; the default `aptos`; `04-ja-meiryo`, which re-runs `lang-ja-meiryo`; Arabic RTL; monospace Consolas; a per-slide override; CJK inside Latin; Korean, Hindi and Hebrew; and Georgia. |
| `ff27` | FF-27 | 2 | Furniture fields in the 0.18 forms. `01-footer-fields`: `date: true` with `MMMM d, yyyy` (`datetime4`, the `dt` placeholder), footer text and `{{slide.number}}` (`sldNum`). `02-header-forms`: `Page {{slide.number}} of {{deck.slideCount}}` in a tagged header shape, a default `M/d/yyyy` date (`datetime1`) and `A-{{slide.number}}`. |
| `ff46` | FF-46 / RR-17 | 50 | One family per deck. The 41 script families (Sakkal Majalla appears 3 times, Sylfaen twice, and BatangChe and GungsuhChe have their own decks), Wingdings, Webdings, Symbol, Segoe UI Emoji and Cambria Math, plus the emoji-in-Aptos probe. Every deck has preview PNGs at 1280 px in `previews/ff46`. |
| `ff13` | FF-13 | 1 | The font-embed fixture. Every run and theme slot is Carlito, with all four styles. |

## 0. Before you start

- **Machine.** Windows with desktop PowerPoint 365. Close any other presentation you are working on in PowerPoint: the readers open
  each deck read-only without a window and close only what they opened.
- **Starting PowerPoint.** If PowerPoint is not running, `run-set.ps1` starts it (`POWERPNT.EXE`) and waits until it can attach. Each
  reader also starts one if it finds none. Nothing ever quits, kills or restarts PowerPoint.
- **Safe-mode prompt.** If PowerPoint offers safe mode after a crash, answer **No**.
- **Never read `Series.Formula`.** It crashes PowerPoint 16.0.20430, and the readers do not touch it. If PowerPoint crashes anyway and
  recovers one of these decks read-write, close it without saving only if it is under `C:\opf-work` and its sha256 matches
  `helpers\decks-order.txt`.
- **Integrity.** `run-deck.ps1` checks each deck's sha256 against `helpers\decks-order.txt` (fifth column) and refuses a mismatch.
- **Node 24:**

  ```powershell
  $node = '<node24>'
  ```

## 1. Smoke test (one deck, about 5 to 15 s)

```powershell
$R = 'C:\opf-work\native-0-18-run'
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R\helpers\run-deck.ps1" -Set ff12 -DeckId 02-carlito-code-family-carlito -OutRoot "$R\native\attempt-1"
```

Check that `native\attempt-1\ff12\02-carlito-code-family-carlito\02-carlito-code-family-carlito.run.json` says `"status": "completed"`
and `"exitCode": 0`, and that the deck's `.json` says `"stage": "done"` and `"readOnly": -1`.

## 2. FF-12, FF-27 and FF-46 (64 decks, about 10 to 15 min)

```powershell
$R = 'C:\opf-work\native-0-18-run'
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R\helpers\run-set.ps1" -Sets ff12,ff27,ff46 -OutRoot "$R\native\attempt-1"
```

- **How it runs.** Each deck runs in its own child `powershell.exe` with a 90 s deadline. On the deadline, only that child is
  stopped, by PID.
- **The two modes:**
  - `ff12` and `ff46` decks use `helpers\native-read-deck.ps1`. It reads `Presentation.Fonts`, the slide-master and notes-master
    theme slots, every run's `Name`, `NameFarEast` and `NameComplexScript`, `TextRange.Lines()` bounds, geometry, tables, charts,
    notes and `HeadersFooters`, and exports slide PNGs.
  - `ff27` decks use `helpers\native-fields.ps1`. It reads the furniture, then calls `Slides(1).Duplicate()` and
    `Slides(last).MoveTo(1)`, **in memory only**, reading after each step before and after `Slide.Export`. It closes with
    `Saved = -1` and never saves.
- **Re-running.** If the run is interrupted, run the same command again. Decks that already have a `run.json` under `attempt-1` are
  skipped, so no deck is retried in place.
- **Failures.** A failed or timed-out deck is evidence. If one must be attempted again, use a new `-OutRoot`
  (`native\attempt-2`) for that deck only, and tell the agent.
- **Run log.** The run writes `native\attempt-1\run-set.json`.

## 3. FF-13 font-embed attempt (one attempt, about 30 s)

This is the only step that saves anything. Under the owner decision of 2026-10-05 ("you can save copies"), it makes **one `SaveAs`
of a copy** with `EmbedTrueTypeFonts` into a fresh directory, never over the source.

```powershell
$R = 'C:\opf-work\native-0-18-run'
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R\helpers\ff13-supervise.ps1"
```

- **Fonts.** The supervisor makes Carlito available for the attempt only, because Carlito is not installed on this host:
  - it registers the four OFL faces of `node_modules\@expo-google-fonts\carlito` in place, with `AddFontResourceExW(path, 0)` and a
    `WM_FONTCHANGE` broadcast;
  - it removes them in `finally`;
  - nothing is copied and nothing goes into the registry.
- **The worker** (`helpers\ff13-embed-worker.ps1`, one child process, 90 s deadline):
  1. opens the source read-only;
  2. stops before saving if `Presentation.Fonts` names anything but Carlito;
  3. saves `ff13\attempt-<stamp>\copy.pptx`;
  4. reopens the copy read-only for a diagnostic read.

## 4. Compare (no Office)

```powershell
cd C:\opf-work\native-0-18-run
& $node compare.mjs --native native\attempt-1
```

This writes `compare.md` and `compare.json`. The FF-13 audit takes the newest `ff13\attempt-*`, or the one you give with `--ff13`.
Absolute paths are replaced with `<set>`.

| Item | Pass criterion (opf#323) | Where |
| --- | --- | --- |
| RR-05 / FF-12 | `Presentation.Fonts` names only the deck's chosen families, and every Latin family the runs draw is listed. Under the reading accepted on 2026-10-05, theme-only East Asian and complex-script families may be absent; these are reported as "soft". The theme slots of the slide master and notes master equal the file's. No run names another family. On `07-per-slide-override`, each slide reads back its own family. | `compare.md`, FF-12 table |
| FF-27 | After the insert and the move, every slide-number field reads its new position. Every live date reads the host date in the chosen en-US format (`MMMM d, yyyy` or `M/d/yyyy`), never the cached `January 15, 2026` or `1/15/2026`. `{{deck.slideCount}}` stays `5` by design, because PowerPoint has no slide-count field. | FF-27 steps tables |
| FF-46 / RR-17 | Names pass as for FF-12, and the script runs name the deck's family. Every exported line box reads one native line, with no native-only overflow past the box over 0.5 pt. Native / preview ink width on lines of at least 200 pt is within 0.80 to 1.01. Image scores are reported only. A family passes only if every one of its decks passes. | FF-46 family and deck tables |
| FF-13 | The OPC audit of `copy.pptx` shows exactly Carlito embedded: every font part's EOT family name, with trailing NULs stripped, is Carlito, and there are no other font parts. The source sha256 is unchanged. | FF-13 section |

## 5. Hand back

Message the agent "native 0.18 run done", with the `OutRoot` and any deck you re-attempted. The agent then writes the evidence folders
and the burndown updates:

- `docs/evidence/rr-05-ff-12-native-<date>/`
- `ff-27-fields-native-<date>/`
- `ff-46-documented-visual-native-<date>/`
- `ff-13-font-embed-native-<date>/`

Each holds a README, `compare.md`, `compare.json` and the run records with paths scrubbed.

## Files

| Path | What |
| --- | --- |
| `build/build.mjs` plus `build/decks-ff12.mjs`, `decks-ff27.mjs`, `decks-ff46.mjs`, `lib.mjs` | Builds the decks, previews, `manifest.json` and `helpers/decks-order.txt` from the published packages: `& $node build\build.mjs [--sets ff12,ff27,ff46,ff13]`. The build is deterministic (fixed `zipDate`), so a rebuild reproduces the sha256 values. |
| `decks/<set>/*.pptx`, `decks/<set>/opf/*.opf.json`, `previews/ff46/*.png` | The decks, their OPF sources and the FF-46 previews. |
| `manifest.json` | Per deck: sha256, chosen, required and soft families, theme slots (master and notes master), and per slide the shapes, boxes, runs, fields, notes, charts, tables, export diagnostics and validation warnings. |
| `helpers/run-deck.ps1`, `run-set.ps1`, `native-read-deck.ps1`, `native-fields.ps1` | The read-only runners. |
| `helpers/ff13-supervise.ps1`, `ff13-embed-worker.ps1` | The FF-13 attempt (one `SaveAs` of a copy). |
| `compare.mjs` | The comparison. |
| `selftest/make-mock.mjs` | A self-test without Office: it makes perfect and defective mock read-outs under `native/selftest-*`. The perfect set gives PASS 12/12, 2/2, 50/50 and FF-13 PASS; the defective set flags every injected defect. |
| `ff46-sizeadjust-measurements.md` and `.json`, `measure/` | The opf#361 measurement (no PowerPoint). |
| `fixtures-plan.md` | The opf#362 plan. |

---

# Attempt 2 (opf#361): lineAscent probe and factor-applied re-run (2026-10-10)

Built without Office; only the root session runs PowerPoint. These use the same helpers as attempt 1, with two fixes:
- `run-deck.ps1` and `ff13-supervise.ps1` now cache the child process handle, so `run.json` records the real exit code (attempt 1 recorded `null`).
- `run-deck.ps1` passes each deck's export width (column 6 of `helpers\decks-order.txt`) to the reader: 2880 px for the probe decks, 1280 px otherwise.

| Set | Decks | What |
| --- | ---: | --- |
| `probe38` | 4 | The RR-38 lineAscent probe for **DilleniaUPC, Malgun Gothic and Nirmala UI**, plus a controls deck that re-measures known values: Angsana New 0.85, Sakkal Majalla 0.78 and Arabic Typesetting 0.70. Each deck has one slide per size (18, 24 and 32 pt). Every row is a one-line text box (wrap none, zero insets, anchor top, 100 % line spacing, box height 1.22 x size) with black text on a white background. A deck has three rows: regular, bold, and a mixed line with an Aptos Latin run. |
| `ff46sa` | 7 | The FF-46 decks of the five shipping families, rebuilt with the **rule factors in a local, uncommitted policy patch**: Angsana New 0.75 (lineAscent 0.85), DilleniaUPC 0.68, Sakkal Majalla 0.89 (lineAscent 0.78 / 0.78; ar, ur and fa decks), Malgun Gothic 1.07 and Nirmala UI 1.07. With the factors, both composition and previews change: for example, the Angsana New paragraph is 5 lines instead of 7. |

How the patch works: `patched/make-patch.mjs` writes a patched copy of the published opf font-policy chunk, and `patched/register.mjs` redirects that chunk to the copy for a single node process. The installed packages and core's `font-policy.json` are untouched. `build/build.mjs` refuses to build `ff46sa` without the patch, and refuses to build any other set with it.

## Run

```powershell
$R = 'C:\opf-work\native-0-18-run'
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R\helpers\run-set.ps1" -Sets probe38,ff46sa -OutRoot "$R\native\attempt-2"
```

That is 11 decks, about 1 to 2 minutes in total, read-only, one child process per deck, with a 90 s deadline and no retries.

## Compare (no Office)

```powershell
cd C:\opf-work\native-0-18-run
& '<node24>' compare.mjs --native native\attempt-2 --only probe38,ff46sa --out compare-attempt-2.json --md compare-attempt-2.md
```

**probe38.** For each box:
- The baseline is the bottom edge of the last ink row that holds at least 35 % of the peak row's ink (the RR-38 method), measured in em below the box top. The most common ink-bottom row is reported beside it.
- `lineAscent` is the median over the three sizes of the regular single lines.
- `lineAscentMixed` is the median of the mixed lines.
- The controls must reproduce 0.85, 0.78 and 0.70 within 0.03 em. If they don't, the probe values are not used.
- `TextRange.Lines()` bounds are recorded for reference.
- Self-test (`selftest/probe-mock.mjs`, synthetic text with known baselines) recovers 0.85, 0.78, 0.70 and 0.80 exactly.

**ff46sa.** This is the FF-46 criterion:
- the names check passes;
- each box reads one native line;
- no box overflows natively only (beyond 0.5 pt);
- the native / preview ink on lines of at least 200 pt is within 0.80 to 1.01.

With the factors, the ink should land near 1. The self-test on perfect mocks gives 7 of 7 decks PASS.

---

# Attempt 3 (opf#361): mixed-line lineAscent for Angsana New, Sakkal Majalla and Arabic Typesetting

Set `probe38b` has 3 decks, one per family: `probe38b-angsana-new`, `probe38b-sakkal-majalla` and `probe38b-arabic-typesetting`.
- **Setup:** the same as attempt 2's `probe38`. Each deck has one slide per size (18, 24 and 32 pt). Every row is a one-line text box with no wrap, zero insets, anchored at the top, 100 % line spacing, a box height of 1.22 x the size, and black text on white. Slides export at 2880 px.
- **Rows:** regular, bold, and a mixed line (the family's script around an Aptos Latin run "PowerPoint 365").
- **No controls deck.** The single lines are cross-checked against attempt 2's corrected values instead: Angsana New 0.833, Sakkal Majalla 0.761 and Arabic Typesetting 0.741, each within 0.03 em.
- **Compare:** the corrected rule. The baseline is the bottom edge of the last row holding at least 35 % of the darkest row's ink, or, for a headline script, the most common bottom of the letter stems.

```powershell
$R = 'C:\opf-work\native-0-18-run'
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R\helpers\run-set.ps1" -Sets probe38b -OutRoot "$R\native\attempt-3"
cd $R
& '<node24>' compare.mjs --native native\attempt-3 --only probe38b --out compare-attempt-3.json --md compare-attempt-3.md
```
