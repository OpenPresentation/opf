# Native font embed harness

This bounded Windows helper is separate from [Gate E native font edit](./native-font-edit.md). It reuses the same immutable `native-font-edit-fixture` directory (four pinned Carlito faces and `source.pptx`) but saves the owned presentation with PowerPoint [`Presentation.SaveAs`](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) file format `24` and third argument `-1` (`msoTrue`) so font embedding is requested on that file only.

Gate E continues to call `SaveAs(..., 24, 0)` and does not prove embedding. COM `Font.Name` does not prove which TTF drew each glyph. After a Windows run, audit embedded package parts offline with Node (no Office).

## Parent-owned lifecycle

The parent matches Gate E safety: indexed COM stages, a 45-second owned worker (`native-process.ps1`), timeout kills only that worker, never Office or descendants, never `Application.Quit`, never closes a presentation this run did not open, and never changes global PowerPoint security. Carlito session registration uses `native-text-fonts.ps1` with flags `0` in the surviving parent only.

## Generate fixture

Use the existing Gate E generator:

```powershell
node test/native-font-edit-fixture.mjs artifacts/font-embed-fixture-new PATH_TO_REGISTRY_CONSUMER
```

## First embed run (Windows)

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-embed.ps1 `
  -OutputDirectory artifacts/windows-native-font-embed-01 `
  -InputPresentation artifacts/font-embed-fixture-new/source.pptx `
  -FontFixtureDirectory artifacts/font-embed-fixture-new
```

Then audit OPC font parts without Office:

```powershell
node test/native-font-embed-audit.mjs artifacts/windows-native-font-embed-01
```

## Non-Office regression

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -NonInteractive -File test/native-font-embed.ps1 -PureRegression
```

```bash
npm run test:native-font-embed-controls
```

The audit module rejects verifier sources that still force `EmbedFonts` off, bounds fixture fonts to the same four Carlito SHA-256 values as Gate E, and records `ppt/fonts` part hashes from the saved `native-font-embed.pptx`.
