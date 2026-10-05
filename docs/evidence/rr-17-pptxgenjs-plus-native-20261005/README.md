# RR-17: native PowerPoint a/b check of the pptxgenjs-plus engine (2026-10-05)

[opf-pptx#165](https://github.com/OpenPresentation/opf-pptx/pull/165) moves opf-pptx's package writer from PptxGenJS 4.0.1
to pptxgenjs-plus 4.3.4. The part-by-part diffs of 976 exports and the FF-38 parity audit (756 / 94 / 0) were already
done. This run is the PowerPoint check the migration still needed ([opf#323](https://github.com/OpenPresentation/opf/issues/323),
comment of 2026-10-05). It gates releasing the migration as opf-pptx 0.13.0.

**Result: pass.** All 40 decks opened and read to the end, and `compare.mjs` reports PASS 20, WARN 0, FAIL 0, MISSING 0.

## Host and method

- Windows 11 with desktop PowerPoint 365, `Application.Version` 16.0 build 20430.
- The supervisor session ran Office. The set was built on the Mac mini; no agent opened Office.
- The set (`rr17-pptxgenjs-plus-windows-set.zip`, 50 files) is not committed. Before the run, all 40 deck sha256 values
  were checked against its `manifest.json` ([decks.json](decks.json) lists them).
- `run-set.ps1` read each deck in its own `powershell.exe` with a 90 s deadline and no retries. The reader
  (`native-read-deck.ps1`) attaches with `GetActiveObject`, opens read-only with `Presentations.Open(path, -1, 0, 0)` (no
  window), reads, exports 1280 x 720 slide PNGs and closes. It never saves, quits or kills PowerPoint.
- A PowerPoint window was on screen at the start of the run, and no repair or protected-view prompt appeared:
  - every reader process exited 0, without a timeout, and every read reached `stage: done`;
  - each deck took 0.6 to 1.4 s from attach to close;
  - a repair prompt is modal, so it would have stopped the read before `done`.
- `node compare.mjs` (sharp 0.35.4, Node 24.21.0) paired `a-<id>` with `b-<id>`.

| Build | Checkout | Engine |
| --- | --- | --- |
| a | opf-pptx main `bc97949` (the 0.12.3 candidate) | PptxGenJS 4.0.1 |
| b | opf-pptx `codex/rr-17-pptxgenjs-plus` `0773be6` | pptxgenjs-plus 4.3.4 |

## What was compared

20 documents, the Keynote set: Latin rich text, serif/mono/code, Japanese, Hindi, Arabic and Hebrew RTL, numbered
bullets, tables, 8 core and 6 variant charts, chartex fallbacks, SVG pictures with PNG fallback, header/footer fields,
speaker notes, backgrounds, footnotes and captions, and 4 gallery examples. 75 slides per build.

For each pair, PowerPoint's reading of b had to equal a:

- `Presentation.Fonts`;
- slide size;
- every shape: name, type, geometry within 0.02 pt, rotation, text, font names (latin, far east, complex script), size,
  bold, colour and insets;
- tables (cells and first row);
- charts (type, series names, values, categories);
- picture alt text;
- notes pages and their placeholders;
- notes master placeholders.

All 20 pairs are equal. The 75 slide PNG pairs differ by at most 0.01 % of pixels (INFO; the WARN threshold is 0.5 %).
`Presentation.Fonts` names only each deck's own families, the same in both builds (the table in [compare.md](compare.md)).

## Not run

The optional manual **Edit Data** check (opening the embedded workbooks of `09-charts-core` and `10-charts-variants` in
Excel) was not run. It is not part of the pass criterion, and the workbook table-range fix was verified separately (opf-pptx#163,
Keynote evidence in opf#341).

## Files

- [compare.md](compare.md) and [compare.json](compare.json): the comparison output.
- [run.json](run.json): one record per deck (child process id, exit code, timeout).
- [decks.json](decks.json): the 40 decks with sha256 and slide counts.

The decks, the raw read-outs and the PNGs are not committed.
