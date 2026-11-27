# The PowerPoint driver

The native-testing driver for PowerPoint on Windows (NT-16). It opens OPF-exported `.pptx` files in PowerPoint over COM and records what PowerPoint made of each in the shared result format (`../../core/result/README.md`): PowerPoint's picture of every slide, its object list, its own PowerPoint copy, one copy per edit case, the verb statuses and timings. It is built from the release supervisor's pass scripts and the format agreement of opf#1468 (comment of 2026-11-25).

| File | What it is |
| --- | --- |
| `driver.mjs` | `check` and `runFiles`: the Node side (plan, lock, hashes, `result.json`, `run.json`) |
| `powerpoint.ps1` | the PowerPoint side: one Windows PowerShell 5.1 process for the whole run; the verbs `open`, `resave`, `render`, `probe`, `close` and the edit cases |
| `powerpoint-fake.ps1` | the fake COM layer `powerpoint.ps1 -SelfTest` uses (tests only) |
| `normalize.mjs` | what the script writes (`powerpoint-raw.json`) to `result.json`: the shared kind of every PowerPoint shape |
| `machine.mjs` | the facts `check` needs (tasklist.exe, reg.exe), the process runner and the run directory's lock |
| `run.mjs` | the driver's own command |

## What it does

- `check` refuses when `POWERPNT.EXE` or `EXCEL.EXE` is running (that instance is the owner's), when PowerPoint is not installed, on another system, or when a live driver holds the run directory's lock. It reads PowerPoint's version and build from the registry (`VersionToReport`) and starts neither PowerShell nor Office.
- `runFiles` takes `<run>/powerpoint.lock`, takes the SHA-256 of every input, writes `<run>/powerpoint-plan.json` and starts `powershell.exe -NoProfile -NonInteractive -File powerpoint.ps1 -Plan <plan>` once. The script checks the process list again, creates one `PowerPoint.Application` on a worker thread (STA) and, per file: `Presentations.Open(path, ReadOnly msoTrue, Untitled msoFalse, WithWindow msoFalse)`; `SaveCopyAs` to `resaved.pptx` (first, before any probe reads the open file); `Slide.Export` of every slide, hidden slides included, 1920 pixels wide at the slide's aspect (1920 x 1080 for 16:9); the probe of every slide; `Close` with `Saved` set. Then the edit cases, each on a fresh read-only open of the same file: retype a table cell, refill a table cell, change a web link's address, add a table row, delete a table row, add a paragraph to a text box, move a shape; one `SaveCopyAs` to `edits/<id>.pptx` each. A case that does not apply to the file (no table) is `not-run` with `not applicable: <why>`. At the end it quits PowerPoint only when `Presentations.Count` is 0.
- Every PowerPoint call has a time limit (`TIMEOUTS` in `driver.mjs`). A call that does not return in time is `timeout`, the rest of the file and every file after it are `not-run`, and the script exits without ending PowerPoint; the result says that a `POWERPNT.EXE` process may be left for the supervisor to look at.
- The probe reports the kinds of the shared format: placeholders (title, body, footer with its role), text and lists, tables (`rows`, `columns`, and in `details.cells` every cell's text, fill and text color), charts, connectors (both ends in `details.line`), groups (members' frames in slide coordinates, as PowerPoint reports them and the format means), pictures, live SmartArt as `diagram` (`details.layout`, `layoutId`, `nodes`), media, links on a shape, in text or in a cell (`target` a URL or `slide:<index>`), and notes. `details` also holds a text frame's autosize, word wrap and bound height, the placeholder type and the shape id. A chart is read only through the chart object's own properties (type, title, legend, series names, plot area).
- `result.json` records `unchangedAfterRun` from Node's hashes before and after the run, checked against the script's own `Get-FileHash` before the open and after the last close; the close of each file is in `details.close` (the format has no close verb).
- `open: done` means "opened without an error": PowerPoint shows no repair prompt in this mode, so it does not establish that none would appear. Import warnings are `not-read`.

## What it never does

- It never starts PowerPoint while one runs, never stops a process (no `Stop-Process`, no `taskkill`), never sends keys, never shows or activates a window and never answers a dialog.
- It never opens a chart's workbook (no `ChartData`, no `Workbook`). If `EXCEL.EXE` appears during a run, the run stops after that file and leaves it for the supervisor.
- It never saves the input. It installs and registers no font.

## Running it

```
node scripts/native-acceptance/apps/powerpoint/run.mjs --check
node scripts/native-acceptance/apps/powerpoint/run.mjs --out <dir outside the repository> --opf <version> [--opf-commit <sha>] [--input-root <dir>] [--no-edits] <file.pptx>...
```

Exit 0: every verb and every applicable edit case of every file done; 1: something did not finish; 2: refused, bad arguments, an input not proved unchanged, or stopped. The general entry point is `pnpm native powerpoint` (`scripts/native-acceptance/native.mjs`), which on Windows builds the tier's decks, runs this driver and classifies the result; on another system it says where the driver runs.

## Tested without PowerPoint

`pnpm check:native` runs `driver.test.mjs` (the Node side against a fake `powershell.exe` child, on every system) and `powerpoint.test.mjs`: the rules above read from the script's text, and on Windows the PowerShell parser and `powerpoint.ps1 -SelfTest -Fake <scenario>` runs of the script's real control flow with every `Com-*` function replaced by `powerpoint-fake.ps1` (the script refuses a self-test when one is not). What PowerPoint actually answers to each COM call is shown only by a real run.

This driver replaces, for native testing, the PowerPoint half of `../../run-windows.ps1` and `../../WINDOWS.md`: those remain for the suite-pinned Windows observations they describe and are not extended.
