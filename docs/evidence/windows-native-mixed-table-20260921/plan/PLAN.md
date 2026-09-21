# Native mixed-table read-only observation plan

This helper observes the reviewed registry-exported fixture without editing or saving it. The parent process validates and snapshots the entire evidence contract needed for the run, temporarily registers exactly the four reviewed Carlito faces with session-visible flag `0`, starts a bounded worker, and removes only its own successful font additions in `finally`. The worker opens its exact source snapshot read-only, observes one slide/table/row/cell, exports one 1280 × 720 native PNG, and closes only that exact snapshot. It never calls `Application.Quit`, kills Office, retries, saves, creates a PDF, embeds a font, installs a font, or changes security settings.

The observation records promoted `[double]` values for the slide, table shape, row, column, cell shape, text frame margins, whole text range, five exact authored runs, seven bounded single-character probes, paragraph spacing and `LineRuleWithin`, explicit tab-stop count/default spacing, and at most eight native line ranges. Every recorded `TextRange2` includes its documented `Start`, text, length, and bounds, so native soft-wrap intervals remain explicit. Positions 78/79 and 172/173 come from the offline estimated trace and are probes only; the helper does not require PowerPoint to wrap at those positions. It reports whether PowerPoint exposes two or more native soft-wrapped lines. Font family and style properties plus the raster do not establish physical per-glyph font provenance.

Reviewed fixture inputs:

- `R/mixed-table-registry-01/source.pptx` SHA-256 `f92c5d5565afa1d03fc6df0cdc8d482771d5ebd5a5403f7a888f75e2ad020a51`
- `font-edit-fixture-01/generation.json` SHA-256 `8ac9743832e6c63bab58a999802979dcdcb91139599f502e90bc697141cf5422`; only its four font entries, license, hashes, and registration flag are consumed. Its unrelated font-edit source/edit contract is deliberately not applied to this table.
- The safety pattern reviewed for this helper is `native-font-edit.ps1` SHA-256 `b18f9e2ab822a42b9204a15314ed5ef6e74b1d933ba3e5e7e4efc3a542368960`. The runtime dependencies are pinned to `native-process.ps1` SHA-256 `2a49f620b77fd998b791b835dd17bc64487f9539fa20935cbbba50ea5b7dc015` and `native-text-fonts.ps1` SHA-256 `853d51c68d123c354748e948dbcb8c31aaa923dc6319734dfb393010e8cb3ba6`; the parent snapshots and hashes both before use.

The COM members are limited to documented PowerPoint/Office APIs: [Presentations.Open](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentations.open), [Presentation.Close](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.close), [Slide.Export](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.slide.export), [Table and Cell.Shape](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.table), [Row.Height](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.row.height), [Column.Width](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.column.width), [TextRange2 members and bounds](https://learn.microsoft.com/en-us/office/vba/api/overview/library-reference/textrange2-members-office), [TextRange2.Paragraphs](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange2.paragraphs), [TextRange2.Lines](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange2.lines), [ParagraphFormat2 members](https://learn.microsoft.com/en-us/office/vba/api/overview/library-reference/paragraphformat2-members-office), [TextFrame.Ruler](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textframe.ruler), [Ruler.TabStops](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.ruler.tabstops), [TabStops.DefaultSpacing](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.tabstops.defaultspacing), and [TextFrame2.MarginLeft](https://learn.microsoft.com/en-us/office/vba/api/office.textframe2.marginleft).

No-Office pure regression command:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-mixed-table-observe.ps1 -PureRegression
```

Proposed root-only native command, using a fresh output directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native-mixed-table-observe.ps1 `
  -OutputDirectory ..\native-mixed-table-01 `
  -InputPresentation ..\R\mixed-table-registry-01\source.pptx `
  -TableFixtureDirectory ..\R\mixed-table-registry-01 `
  -FontFixtureDirectory ..\font-edit-fixture-01 `
  -TimeoutSeconds 45
```

Every Office call has a durable begin/success/error record. A COM failure latches the worker and prohibits later Office calls; the catch block performs no COM cleanup. Content/style, soft-wrap, raster, and input-hash gates run only after the exact owned presentation closes. The parent treats timeout, incomplete Office cleanup, incomplete font cleanup, input drift, or a false post-close metric gate as failure and does not retry.
