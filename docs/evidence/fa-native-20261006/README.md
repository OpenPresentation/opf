# FA native PowerPoint evidence, 2026-10-06

Native checks of the format-audit (FA) PPTX features on desktop PowerPoint 16.0 (Windows). The FA root session ran them. Every deck was opened read-only (`Presentations.Open(path,-1,0,0)`, no window), one child powershell per deck with a 90 s deadline, and closed with `Saved=-1`. Nothing was saved. No `Series.Formula` read and no `ChartData.Activate`.

The decks are built from each item's branch with `build-decks.mjs` / `build-fa10.mjs` (sources in `decks/*.opf.json`). The probes are `probe.ps1` and `run-all.ps1`, and the raw output is in `run-logs/`. `expect.md` has the exported OOXML per check, and `offline-results.md` has the XML well-formedness and chart schema-order checks.

The root session opened every deck read-only (`Presentations.Open(path,-1,0,0)`), one child powershell per deck, with a 90 s deadline. Nothing was saved. Raw output is in results.jsonl and run-logs/.

| Item | Verdict | Evidence |
| --- | --- | --- |
| FA-05 color roles + links | PASS | The link run is theme hlink (#AA3311, ObjectThemeColor 11). Text on #FF0000 is black. The `accent` run is accent3 #5499C7 (theme 7) and `primary` is accent1 #2874A6 (theme 5), read by root via TextFrame2.Runs. The probe's "#000000" came from reading the wrong text range. The XML has `schemeClr accent3` and `schemeClr accent1`. |
| FA-09 chart alt | PASS (re-run 3 after fix opf-pptx ca0a86a) | "PowerPoint could not open the file." Slide 5 has a duplicate `a:extLst` on the chart frame cNvPr: decorative `alt: ""` plus an existing creationId. The writeFrameAlt merge fix is being made locally. Re-run after the fix. |
| FA-11 timeline status | PASS (re-run 4: ratio exactly 1.6) | The current event has two ellipses. The ring is within the 1.4–1.8x tolerance (1.49x measured; the documented ratio is being aligned). Planned markers are hollow over the background, and the current label is bold, on light and dark slides. |
| FA-12 quote photo | PASS | Ellipse picture, alt text, square frame, cropped not distorted (portrait and landscape sources). |
| FA-13 conveniences | PASS (re-run after fix opf-pptx 05e42a5) | The watermark is a rotated text box (rot 19800000 = 330°) behind content, alpha 15000 in XML (COM returns mixed for text transparency). Its color is `bg1`, which is invisible on white slides; the fix is being made locally. Code highlight bands are rectangles behind the line text. Run `lang` sets LanguageID. The 1:1, 4:5 and 9:16 slide sizes are 540x540, 540x675 and 540x960 pt. |
| FA-14 chart highlight | PASS | The highlighted series and slices are `schemeClr accent1` in XML and RGB #2874A6 in COM; the muted color is #4D5D7B. COM reports ObjectThemeColor 0 on chart fills even for scheme colors, a COM limitation, so the XML is authoritative. The category point differs, the pie slice highlight is correct, and the line chart opens. |
| FA-15 combo | PASS | 2 series: clustered column plus line with markers. The line is on the secondary axis group, and the secondary value axis format is 0%. Opens. |

Harness note: the "probe-run exit ," rows are a `Start-Process` artifact (ExitCode is unreadable after a timed WaitForExit), not failures.

## Re-run 2 (FA-13 after the watermark color fix, opf-pptx 05e42a5)

The deck gains slide 4, a white background. Read in PowerPoint per character: slide 1 (dark) watermark RGB FFFFFF, theme bg1 (14), transparency 0.85; slide 4 (white) watermark RGB 000000, transparency 0.85; rotation 330 on both. PASS. (The probe's opens-read-only row expects 3 slides; the 4th is the added one.)

## Re-run 3 (FA-09 after the extLst merge fix, opf-pptx ca0a86a)

The deck opens (5 slides). The classic column and chartex waterfall chart frames have descr equal to chart.alt. `alt: ""` gives Shape.Decorative = -1 (PowerPoint's Mark as decorative) with empty AlternativeText. Frames that already had an a:extLst (a16:creationId) open with the alt text and with decorative; one a:extLst per cNvPr. 11 of 11 checks PASS (the probe-run row is the harness artifact).

## Re-run 4 (FA-11 after the one-ring-rule fix, core 696fa017 + opf-pptx b51eb757)

Opens (2 slides). On both the light and the #10151C slide, the current event has a ring plus a marker (both ovals). The ring/marker ratio is exactly 1.6. Planned markers are ovals filled with the slide background (#FFFFFF / #10151C) with a visible line. Only the current label is bold. 9 of 9 checks PASS.

## Run 5 (FA-10 rich headings, core 366ca5af / opf-pptx affc68d)

`decks/fa-10-rich-headings.pptx` (built by build-fa10.mjs) opens (2 slides), read run by run with TextFrame2:
- Slide 1, title "Revenue grew **28%** in Q3¹": "28%" is accent2 (theme 6, #1B4F72), the citation marker "1" is superscript, and the footnote area lists "1 Company filings, 2026".
- Slide 1, subtitle: "enterprise" is italic.
- Slide 2, rich quote: "saved us a week" is accent1 (theme 5) and the footnote marker "2" is superscript. The footnote and the plain attribution are present.
PASS.
