
## matrix-sweep (SW), added 2026-11-25
- sweep-growth, native, slide 4: list "Faster reviews / Fewer handoffs" (body placeholder): Format > Text inspector, Bullets & Lists: is the bullet a Keynote bullet of the placeholder style (back.pptx wrote fewer explicit buChar than the export)?
- sweep-tables, default, slide 12: table header cell "Participants": Format > Table inspector, Text: font (Helvetica Bold 24 pt expected) and whether "Wrap Text in Cell" is on; check that resizing the column by a few points puts the word back on one line.
- sweep-records, default, slide 1: chart: Edit Chart Data: values 0.68, 0.72, 0.76, 0.84 present; Chart inspector: is the fourth bar's own color available (per-point color lost, known).
- sweep-diagrams, default, slide 6: matrix: select it: is it an image (Image inspector) and not shapes (SmartArt drawn from its picture).

## languages (LG)
- lang-rtl~default slide 1 (ar), chart: Edit Chart Data. Read the category order in the data sheet: back.pptx has `أحرارًا, الناس, جميع` (reversed against the file's `جميع, الناس, أحرارًا`); confirm what a Keynote user sees and edits.
- lang-rtl~default slide 1 (ar), table: Table inspector > Table > text direction / "Right to left" setting and the table's X position (probe says x=61 pt, back.pptx says 489 pt); also Format > Text > Text direction of a cell paragraph.
- lang-rtl~default slide 2 (he): same two checks.
- lang-southeast-asia~default slide 1 (km), Font panel of a selected text box: which font name Keynote shows for the Khmer text (probe says Helvetica).
- Keynote's missing-fonts list ("This presentation has missing fonts"): names per deck not read for this family.

## matrix-m (changelog decks, 0.36.0)
- m-charts~default slides 1-3, chart: Edit Chart Data. Read the series list: back.pptx has two series named "Wait" (column C holds North and East only); confirm what a Keynote user sees and edits, and whether deleting the second series in Keynote restores one legend entry.
- m-charts~default slide 5, column chart: Chart inspector > Series > Value Labels: is "Category" (or "Label") offered/checked? back.pptx has `showCatName 0`.
- m-links~default slide 1, footer text box: select it, Format > Action / Link inspector: does the link belong to the box (back.pptx: `hlinkClick` on the shape) and does clicking the text in Play follow it (do not open the link; read the inspector only).
- m-text-flush-rtl~default slide 6, line 1 text box: Format > Text > Text direction (or the paragraph direction button): which direction Keynote set (back.pptx writes `rtl="1"` on 3 of the 4 line boxes).
- m-text-flush~default slide 3, any line box: Format > Text > Alignment (right) and the box's width in Arrange (probe 896 pt for a line in a 1222 px slide box); confirms the box is right-aligned, not placed by its left coordinate.
layouts-ordinary~default, slide 1 and 27, picture: select it, Format > Image > Description: confirm it reads "OPF image 1" / "OPF image 2" (the probe says so; not seen in the inspector).
layouts-lots~default, slide 30, chart: Edit Chart Data: are the category cells "January: northern hubs" (one column) or split in two (LY-05)?
layouts-ordinary~default and ~native, slide 4 (native: body placeholder): select the title: does Keynote show two paragraphs / a trailing space (LY-01 note)?
layouts-ordinary~default, slide 16: select the pyramid: is it one picture (not SmartArt)? Format > Image > Description reads?
Document > Layout menu of any file: list shows "Section 0", "Statement 0", "Closing 0", "Quote 0" (LY-06).
import warnings panel (View > Show Warnings) of all 7 files: not read in this pass.

## roundtrip (RT), added 2026-11-25
- slide-links~default (main), slides 1-4, every linked object (runs "Pricing", "Roadmap", "Appendix (hidden slide)" on slide 1; the rounded rectangle on slide 1; the table cell "Table cell: back to the agenda" on slide 2; both lines on slide 3; the shape on hidden slide 4): select the text or the shape, open the link editor (Format > Add Link / Edit Link, or the Link section of the Format inspector): it should read **Link to: Slide** with the number 2, 3, 4, 3, 1, 1, 1, 1 in that order (back.pptx has `ppaction://hlinksldjump` to those slides). "acme.com" should read Webpage https://acme.com (do not open it). Whether a click in Play follows a jump, including to hidden slide 4: Play only with the owner's OK.
- experiments-fonttest/A-default-aptos, slide 1, the picture: Format > Image > Description: expected "Harbor", empty line, "OPF image 1" (probe). Then any picture with no `title` (layouts-ordinary~default slide 1): "OPF image 1". This is RT-03; the probe already shows it, the inspector check only confirms what a VoiceOver user hears.
- m-charts~default slide 13 (pie beside a table) and sweep-tables~default slide 1: select the chart and the table, Format > (Chart | Table) > Accessibility / Description if Keynote 16.0 offers one: is OPF's alt text there? (back.pptx carries no `descr` on any of the 112 chart and 66 table frames.)
- m-agenda~default slide 2 (title "M67 agenda of 8 entries: exports, numbered badges in every column"): select the title, Format > Text > font size: 30 pt (probe) or 26.7 pt (what back.pptx writes)? Is "Shrink Text to Fit" on for the title placeholder? Also the 48.75 pt title of layouts-ordinary~default slide 1: does the size field show 48 or 48.75 (probe says 48; RT-06)?
- sweep-tables~default slide 4, number column: Format > Table > Cell > Data Format: is it "Automatic" with the values as text (probe: value is a string, format "automatic"); select a cell of the right column: Text > alignment (probe says right; back.pptx writes no alignment, RT-08).
- m-text-flush-rtl~default slide 6 (the line "Scheduler מקצר ...") and lang-rtl~default slide 2 (the digit line "0123456789"): Format > Text > paragraph direction: left-to-right or right-to-left? back.pptx turns OPF's `rtl="1"` into `rtl="0"` on these 9 paragraphs (RT-07; also MX-06).
- m-agenda~default slide 1, a numbered badge: select it: is it a group (Arrange shows "Group") of a circle and a text box "1" (probe: group of shape + text item), and can the number be edited in place (RT-05)?
