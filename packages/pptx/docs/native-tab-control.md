# Native-created tab control

This diagnostic creates nine tab/literal textbox pairs entirely through PowerPoint, saves and reopens the owned presentation, records native bounds and PNGs, and makes a private PDF for a second coordinate observation. It does not consume OPF or alter the metric suite's 0.02 point tolerance.

Run from a coordinated Windows checkout with desktop PowerPoint ready. Each attempt needs a fresh evidence directory:

```powershell
New-Item -ItemType Directory artifacts/tab-control-01
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -File test/native-tab-control.ps1 -EvidenceDirectory artifacts/tab-control-01
python test/native-tab-pdf.py artifacts/tab-control-01
```

The Python reader requires `pdfplumber` and `pypdf`. Review `pdf-render.png` and retain `pdf-control-comparison.json`, source hashes, native observations, PPTX, PNGs and exact verifier scripts. **The PDF can contain proprietary font subsets: keep it private and remove that owned temporary file after inspection. Do not include it in portable evidence.** The reader extracts font names and coordinates, never font programs or outlines.

The parent bounds its hidden worker to 45 seconds (maximum 60), terminates only that helper, and does not retry. Only this run's owned presentation is closed. On failure, preserve the attempt and inspect Office before further work. It never quits PowerPoint or closes user documents.

PowerPoint build 16.0.20326.20132 on Windows 26200.9445 reproduced the remaining metric discrepancy: a requested 16.27734375 point tab reports a 16.30 point word offset, whereas a directly placed literal reports about 16.2773224. DrawingML retains the requested tab to one EMU. Created/reopened native observations and PNGs match. The native PDF reports a +0.024 point tab-minus-literal difference for that pair, with separate PDF coordinate rounding. This isolates a reproducible native tab behavior without establishing an exact internal shaping cause or per-glyph font-file identity. The 0.02 point gate remains failed; no consumer adjustment is justified by this control.

An earlier diagnostic using `ExportAsFixedFormat` failed in the PowerShell COM adapter on its null PrintRange argument; its raw attempt is retained. The final helper uses the documented [SaveAs](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.presentation.saveas) [PDF format 32](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.ppsaveasfiletype). Native bounds are [TextRange2.BoundLeft](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange2.boundleft) measurements, which describe the text bounding box rather than the text frame.
