# The Keynote driver

The native-testing driver for Keynote on macOS (NT-02). It opens OPF-exported `.pptx` files in Keynote and records what Keynote made of each in the shared result format (`../../core/result/README.md`): Keynote's picture of every slide, its object list, its own PowerPoint copy, the verb statuses and timings. It is a port of the tools of the 0.36.0 Keynote round.

| File | What it is |
| --- | --- |
| `driver.mjs` | `check`, `open`, `probe`, `render`, `resave`, `close`: the driver contract |
| `keynote.applescript` | the Keynote side, one verb per `osascript` call, kept as source text |
| `probe-lines.mjs` | the probe's `path<TAB>type<TAB>value` lines to the raw probe object |
| `normalize.mjs` | raw probe and recorded runs to `result.json` objects (NT-01) |
| `ledger.mjs` | the documents this run opened, by Keynote's document id (`ledger.jsonl` in the run directory) |
| `machine.mjs` | the facts `check` needs and the one process runner |
| `run-file.mjs`, `run.mjs` | one file end to end, and the command over several files |

## What it does

- `check` refuses when Keynote is not running, when the screen is locked, or when a document the run did not open is open. When Keynote is not running or the screen is locked it sends Keynote nothing; otherwise it sends one read-only `info` event (Keynote's version and the open documents). The build comes from Keynote's `Info.plist`, found by the bundle id `com.apple.Keynote`.
- `open` records the input's SHA-256, opens the file, and puts the document id in the ledger. `probe` reads every slide's layout, notes, title and body items and every item (bulk, then per item, then property by property). `render` exports a PNG of every slide that is not skipped and names it `slides/slide-00N.png` by the slide's position (Keynote numbers its files among the exported slides only, so a hidden slide gets no picture). `resave` writes Keynote's own `resaved.pptx`. `close` closes the document with `saving no`.
- A run compares the input's SHA-256 before and after (`unchangedAfterRun`) and closes every document it opened, also after a failure. An Apple event timeout (-1712) or a stopped `osascript` is `timeout`.

## What it does not do

- It never starts, activates or quits Keynote, never saves, and never closes a document it did not open.
- It does not read import warnings. Keynote shows its Warnings window only while Keynote is in front, so warnings are `not-read` unless someone who can see the window (an agent with computer use on Keynote, or the owner) passes its text: `--warnings-dir <dir>` with `<fileId>.txt` files, or `warningsText(fileId)` in the context. The text goes through `normalize.mjs`'s parser with `source: "screen"`.
- It does not watch for unexpected windows (the round's `alert`); a dialog shows up as a verb that times out.
- Lists, links, footers and object outcomes are not in Keynote's dictionary; the round-trip step reads them from `resaved.pptx` (NT-04).

## Rules for a run

- The owner starts Keynote and answers any macOS permission prompt; an agent never does.
- One Keynote job at a time on the machine, and only the one driving session sends Keynote events.
- The screen stays unlocked for the whole run.
- The run directory is outside the repository; raw output stays out of `main`.

## Running it

```
node scripts/native-acceptance/apps/keynote/run.mjs --out <dir outside the repository> --opf <version> [--opf-commit <sha>] [--input-root <dir>] [--warnings-dir <dir>] <file.pptx>...
```

It runs `check` before every file and stops with exit code 2 and the reasons when it refuses. Exit 0: every verb of every file done; 1: some verb did not finish; 2: refused, bad arguments, or stopped (an `open` that timed out, or a document that would not close). File ids come from the paths: `<deck>/<variant>.pptx` (variant `default`, `native`, `static`, ...), `<deck>~<variant>.pptx`, else `<deck>.pptx` with variant `default`. The general entry point, `pnpm native keynote` (`scripts/native-acceptance/native.mjs`), builds the decks, runs this driver and classifies the result; see "One command: pnpm native" in `scripts/native-acceptance/README.md`.

## Tested without Keynote

`pnpm check:native` runs the tests beside these files with the process runner replaced, so no test runs `osascript`: `check` for each reason (and no Apple event when Keynote is not running), the exact `osascript` arguments of one file, timeouts, failures that still close the document, a document that opened after a timeout, the picture names around a hidden slide, the PNG facts, the ledger, the probe-line parser on excerpts of real probe lines and on a round trip of the recorded probes, the `result.json` and `run.json` schemas, and what `keynote.applescript` must never contain. Whether Keynote does what the script asks is only shown by a real run.
