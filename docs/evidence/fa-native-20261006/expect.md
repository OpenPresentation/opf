# Expected results for the FA native verification set

Each probe line is `{item, check, expected, actual, pass, note}`; `pass` is `true`, `false`, or `null` (the property could not be read: use the OOXML fallback here). Every OOXML snippet below was extracted from the pptx in `decks\` by `make-expect.mjs`, so it is exactly what the item's own opf-pptx wrote. COM theme color indices: 5..10 are accent1..6, 11 hyperlink; `ObjectThemeColor` 5 is accent1. All decks were exported from the item's own worktree `src/index.js` (no dist rebuild, no change to any branch).

Every deck also gets an `opens-read-only` check: Open succeeds, the slide count matches, and the per-slide shape checks prove nothing was repaired away. COM cannot say "a repair happened" directly; a repair prompt makes the open fail or hang, which run-all.ps1 reports as a timeout.

## FA-05

Deck(s): `decks\fa-05-color-roles.pptx`. Built with C:\opf-work\fa-05\opf-pptx (branch codex/fa-05-preview-color-roles).

### PASS means

- `link-run-has-hyperlink`: slide 1 run "OPF docs" has ActionSettings(1).Hyperlink.Address = https://example.com/docs.
- `theme-hyperlink-color-is-AA3311`: the deck theme hlink slot is #AA3311 (the scheme override), so the next check is not satisfied by Office blue by accident.
- `link-run-reads-as-hyperlink-colored`: the run Font.Color.RGB equals ThemeColorScheme.Colors(11) (the theme hyperlink color). The OPF run has no color; the exporter writes `a:schemeClr val="hlink"` and the `ahyp:hlinkClr val="tx"` extension, so the hyperlink color is the run fill, which is hlink. If COM returns the plain text color instead, read the OOXML below: PASS is schemeClr hlink on the run.
- `slide2-background-is-FF0000`: slide 2 background fill is #FF0000 (supporting; confirms the next two checks test the red slide).
- `text-on-red-is-dark-body / -title`: WCAG relative luminance of the body and title run color is under 0.179 (the exporter wrote 000000, luminance 0). A light color here is a FAIL.
- `accent-role-is-accent3`: the run colored with the ColorRef `accent` reads Colors(7) (accent3, #5499C7) and not Colors(5) (accent1, #2874A6).
- `accent3-ref-is-accent3 / primary-role-is-accent1`: supporting: `accent3` is accent3 and `primary` is accent1.

### OOXML the exporter wrote

**slide 1: the link run (no OPF color)**

```xml
<a:r><a:rPr lang="en-US" sz="1875" u="sng" dirty="0"><a:solidFill><a:schemeClr val="hlink"/></a:solidFill><a:hlinkClick r:id="rId1" invalidUrl="" action="" tgtFrame="" tooltip="" history="1"><a:extLst><a:ext uri="{A12FA001-AC4F-418D-AE19-62706E023703}"><ahyp:hlinkClr xmlns:ahyp="http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor" val="tx"/></a:ext></a:extLst></a:hlinkClick></a:rPr><a:t>OPF docs</a:t></a:r>
```

**theme1.xml color scheme (hlink, accent1, accent3)**

```xml
<a:hlink><a:srgbClr val="AA3311"/></a:hlink><a:accent1><a:srgbClr val="2874A6"/></a:accent1><a:accent3><a:srgbClr val="5499C7"/></a:accent3>
```

**slide 2: background and body run**

```xml
<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FF0000"></a:srgbClr></a:solidFill><a:effectLst/></p:bgPr></p:bg> ... <a:r><a:rPr lang="en-US" sz="1875" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:rPr><a:t>Body text on red</a:t></a:r>
```

**slide 3: the "accent" run and the "accent3" run**

```xml
<a:r><a:rPr lang="en-US" sz="1875" dirty="0"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:rPr><a:t>ref-accent </a:t></a:r> <a:r><a:rPr lang="en-US" sz="1875" dirty="0"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:rPr><a:t>ref-accent3 </a:t></a:r>
```

### Offline verdict on this OOXML

- ok: link run is written as schemeClr hlink, underlined (solidFill schemeClr hlink; hlinkClick present)
- ok: theme hlink is AA3311 (AA3311)
- ok: text on #FF0000 is dark (body 000000 luminance 0.000)
- ok: ColorRef accent is accent3 (not accent1) (run "ref-accent" -> accent3 5499C7)

## FA-09

Deck(s): `decks\fa-09-chart-alt.pptx`. Built with C:\opf-work\fa-09\opf-pptx (branch codex/fa-09-chart-alt).

### PASS means

- `slideN-chart-frame-present`: a shape named `OPF chart N` exists on every slide (a repaired-away chart is missing).
- `classic-column-descr-equals-chart-alt`: slide 1 shape AlternativeText equals chart.alt exactly.
- `chartex-waterfall-descr-equals-chart-alt`: slide 2 (a chartex/Office 2016 waterfall) shape AlternativeText equals chart.alt. If PowerPoint exposes the chartex frame under another name the probe falls back to the first HasChart shape.
- `alt-empty-sets-mark-as-decorative`: slide 3 Shape.Decorative = -1 and AlternativeText is empty. If `Shape.Decorative` does not exist in this build the check reports pass=null; then PASS is the OOXML below (adec:decorative val="1" in cNvPr, no descr), and the UI (Shape > Alt Text > "Mark as decorative" ticked) can be eyeballed.
- `existing-extlst-with-alt-text-opens`: slide 4: the frame had a creationId a:extLst before the alt was written; it opens and AlternativeText equals the alt. Synthesized: the exporter itself never writes an extLst on a chart frame, so the frame was built by injecting a16:creationId into the exported cNvPr and then calling the branch own `writeFrameAlt`.
- `existing-extlst-with-decorative-opens`: slide 5: same, with alt "" (decorative). EXPECTED TO FAIL OR REPAIR: offline, the result has two `a:extLst` children in one `p:cNvPr` (schema allows one). If PowerPoint opens it without repair and Decorative = -1 it passes, but the XML is still schema-invalid, so treat it as a bug to fix in writeFrameAlt (merge the decorative `a:ext` into the existing `a:extLst`).

### OOXML the exporter wrote

**slide 1**

```xml
<p:nvGraphicFramePr><p:cNvPr id="3" name="OPF chart 1" descr="Revenue grew from 10 in Q1 to 20 in Q2 and fell to 15 in Q3."/> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
```

**slide 2**

```xml
<p:nvGraphicFramePr><p:cNvPr id="3" name="OPF chart 2" descr="Waterfall from 10 up 20 down 8 to 22."/> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
<p:nvGraphicFramePr><p:cNvPr id="4" name="OPF chart 2" descr="Waterfall from 10 up 20 down 8 to 22."/> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
```

**slide 3**

```xml
<p:nvGraphicFramePr><p:cNvPr id="3" name="OPF chart 3"><a:extLst><a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}"><adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/></a:ext></a:extLst></p:cNvPr> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
```

**slide 4**

```xml
<p:nvGraphicFramePr><p:cNvPr id="3" name="OPF chart 4" descr="Chart whose frame already had an extLst."><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{00000000-0000-4000-8000-000000000001}"/></a:ext></a:extLst></p:cNvPr> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
```

**slide 5**

```xml
<p:nvGraphicFramePr><p:cNvPr id="3" name="OPF chart 5"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{00000000-0000-4000-8000-000000000001}"/></a:ext></a:extLst><a:extLst><a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}"><adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/></a:ext></a:extLst></p:cNvPr> <p:cNvGraphicFramePr/><p:nvPr></p:nvPr> </p:nvGraphicFramePr>
```

### Offline verdict on this OOXML

- ok: slide 1 frame descr equals alt (Revenue grew from 10 in Q1 to 20 in Q2 and fell to 15 in Q3.)
- ok: slide 2 frame descr equals alt (Waterfall from 10 up 20 down 8 to 22.)
- ok: slide 4 frame descr equals alt (Chart whose frame already had an extLst.)
- ok: slide 3 decorative marker, no descr (adec:decorative val=1)
- **PROBLEM**: slide 5 (pre-existing extLst + decorative): a single a:extLst in the cNvPr (2 a:extLst elements in the cNvPr (schema allows 1))
- ok: slide 4 (pre-existing extLst + alt text): valid (one extLst, descr attribute added)

## FA-11

Deck(s): `decks\fa-11-timeline-status.pptx`. Built with C:\opf-work\fa-11\opf-pptx (branch codex/fa-11-timeline-status).

### PASS means

- `slideN-current-event-two-ellipses`: exactly one `OPF timeline K ring 2` and one `marker 2` (event 2, Rollout), both AutoShapeType 9 (msoShapeOval).
- `slideN-current-ring-about-1.6x-marker`: ring width / marker width between 1.4 and 1.8. The exporter wrote ring 255270 EMU (20.1 pt) and marker 171450 EMU (13.5 pt): ratio 1.489 (1.675 against the 12 pt done/planned marker). That is "about 1.6" only loosely; flag if the owner wants exactly 1.6 (the ring would then be about 21.6 pt).
- `slideN-planned-markers-hollow-over-background`: markers 3 and 4 (Scale, Review): AutoShapeType 9, Fill.Visible = -1, Fill.Type = 1 (msoFillSolid), Fill.ForeColor.RGB = the slide background (FFFFFF on slide 1, 10151C on the dark slide 2) and Line.Visible = -1 (line 2874A6, 1.5 pt).
- `slideN-current-label-bold`: the text shape "Rollout" has Font.Bold = -1; Discovery, Pilot, Scale and Review are not bold.

### OOXML the exporter wrote

**slide 1: the current event's ring, marker, and one planned marker**

```xml
bg=FFFFFF <p:spPr><a:xfrm><a:off x="5968365" y="3724984"/><a:ext cx="255270" cy="255270"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr> <p:spPr><a:xfrm><a:off x="6010275" y="3766894"/><a:ext cx="171450" cy="171450"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="333333"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr> <p:spPr><a:xfrm><a:off x="8238744" y="3776419"/><a:ext cx="152400" cy="152400"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr>
```

**slide 1: the current event label run**

```xml
<a:rPr lang="en-US" sz="1200" b="1" dirty="0"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr> Rollout
```

**slide 2: the current event's ring, marker, and one planned marker**

```xml
bg=10151C <p:spPr><a:xfrm><a:off x="5968365" y="3724984"/><a:ext cx="255270" cy="255270"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="10151C"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr> <p:spPr><a:xfrm><a:off x="6010275" y="3766894"/><a:ext cx="171450" cy="171450"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="333333"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr> <p:spPr><a:xfrm><a:off x="8238744" y="3776419"/><a:ext cx="152400" cy="152400"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="10151C"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="2874A6"/></a:solidFill><a:prstDash val="solid"/></a:ln></p:spPr>
```

### Offline verdict on this OOXML

- ok: slide 1 current event has ring + marker, both ellipse (ring/marker ellipse; ring 255270 EMU, marker 171450 EMU)
- ok: slide 1 ring/marker diameter ratio about 1.6 (1.4-1.8) (ratio 1.489 (note: 1.6 is not exact; the ring is 1.675x the 12 pt planned/done diameter 152400 EMU))
- ok: slide 1 planned markers: ellipse, solid fill = slide background FFFFFF, visible line (planned events 3,4)
- ok: slide 1 current label bold (Rollout)
- ok: slide 2 current event has ring + marker, both ellipse (ring/marker ellipse; ring 255270 EMU, marker 171450 EMU)
- ok: slide 2 ring/marker diameter ratio about 1.6 (1.4-1.8) (ratio 1.489 (note: 1.6 is not exact; the ring is 1.675x the 12 pt planned/done diameter 152400 EMU))
- ok: slide 2 planned markers: ellipse, solid fill = slide background 10151C, visible line (planned events 3,4)
- ok: slide 2 current label bold (Rollout)

## FA-12

Deck(s): `decks\fa-12-quote-photo.pptx`. Built with C:\opf-work\fa-12\opf-pptx (branch codex/fa-12-quote-role-photo).

### PASS means

- `slideN-photo-is-ellipse`: the picture `OPF quote photo K` has AutoShapeType 9 (msoShapeOval). For a picture COM may return -2 or throw; then PASS is `<a:prstGeom prst="ellipse">` in the OOXML below.
- `slideN-photo-alt-text`: AlternativeText equals the photo alt ("Priya Raman at her desk" / "Dana Okafor at her desk").
- `slideN-photo-frame-square`: Width = Height within 0.5 pt (the circle frame; 485775 EMU = 38.25 pt).
- `slideN-photo-cropped-not-distorted`: PictureFormat.Crop: PictureWidth/PictureHeight equals the source aspect (200/300 = 0.667 on slide 1, 300/200 = 1.5 on slide 2) within 2 percent, the picture is at least as big as the frame on both axes and larger on one (the srcRect crops 16.667% of the long axis from both ends, visible area square). A stretched picture would have picture aspect 1.0.

### OOXML the exporter wrote

**slide 1: the photo picture (source 200x300)**

```xml
<p:pic> <p:nvPicPr><p:cNvPr id="6" name="OPF quote photo 0" descr="Priya Raman at her desk"/> <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:custDataLst><p:tags r:id="rIdOpfQuote4"/></p:custDataLst></p:nvPr> </p:nvPicPr><p:blipFill><a:blip r:embed="rId1"></a:blip> <a:srcRect l="0" r="0" t="16667" b="16667"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr> <a:xfrm><a:off x="720090" y="5652135"/><a:ext cx="485775" cy="485775"/></a:xfrm> <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr></p:pic>
```

**slide 2: the photo picture (source 300x200)**

```xml
<p:pic> <p:nvPicPr><p:cNvPr id="6" name="OPF quote photo 4" descr="Dana Okafor at her desk"/> <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:custDataLst><p:tags r:id="rIdOpfQuote8"/></p:custDataLst></p:nvPr> </p:nvPicPr><p:blipFill><a:blip r:embed="rId1"></a:blip> <a:srcRect l="16667" r="16667" t="0" b="0"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr> <a:xfrm><a:off x="720090" y="5652135"/><a:ext cx="485775" cy="485775"/></a:xfrm> <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr></p:pic>
```

### Offline verdict on this OOXML

- ok: slide 1 ellipse geometry (prst="ellipse")
- ok: slide 1 descr equals photo alt (Priya Raman at her desk)
- ok: slide 1 cropped, not distorted: the cropped region is square like the frame (srcRect l/r/t/b = 0.00%/0.00%/16.67%/16.67%; visible aspect 1.000)
- ok: slide 2 ellipse geometry (prst="ellipse")
- ok: slide 2 descr equals photo alt (Dana Okafor at her desk)
- ok: slide 2 cropped, not distorted: the cropped region is square like the frame (srcRect l/r/t/b = 16.67%/16.67%/0.00%/0.00%; visible aspect 1.000)

## FA-13

Deck(s): `decks\fa-13-conveniences.pptx and fa-13-preset-1x1/4x5/9x16.pptx`. Built with C:\opf-work\fa-13\opf-pptx (branch codex/fa-13-conveniences).

### PASS means

- `watermark-is-rotated-text-box`: slide 1 shape `OPF watermark text` has a text frame reading DRAFT and Rotation 330 (or -30), from `<a:xfrm rot="19800000">`.
- `watermark-text-has-transparency`: TextFrame2.TextRange.Font.Fill.Transparency is about 0.85 (a:alpha 15000 on the run fill, opacity 0.15). The text color is `bg1` (white on this default dark deck), so legibility is not asserted.
- `watermark-behind-slide-content`: the watermark ZOrderPosition is lower than every other shape on slide 1.
- `code-highlight-bands-are-rectangles`: slide 2: two shapes `OPF code N highlight 1|2` (lines 2-3 and line 5), AutoShapeType 1 (msoShapeRectangle).
- `code-highlight-bands-behind-line-text`: slide 2 z-order: panel < each band < every `body line` text box.
- `run-lang-sets-language-id`: slide 3 TextRange.LanguageID: English run 1033, "Bonjour le monde." 1036 (French), the Japanese run 1041; French differs from English (the deck language is en-US).
- `preset-slide-size-points (preset decks)`: 1x1: PageSetup.SlideWidth x SlideHeight = 540 x 540; 4x5: 540 x 675; 9x16: 540 x 960 (`p:sldSz` 6858000 x 6858000 / 8572500 / 12192000 EMU).

### OOXML the exporter wrote

**slide 1: watermark text shape**

```xml
<p:cNvPr id="2" name="OPF watermark text"/><p:spPr><a:xfrm rot="19800000"><a:off x="2392680" y="1988820"/><a:ext cx="7406640" cy="2880360"/></a:xfrm><a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom><a:noFill/><a:ln></a:ln></p:spPr><a:rPr lang="en-US" sz="16200" b="1" dirty="0"><a:solidFill><a:schemeClr val="bg1"><a:alpha val="15000"/></a:schemeClr></a:solidFill></a:rPr>
```

**slide 2: shape order in the spTree (z-order, first = back)**

```xml
 < OPF watermark text < OPF heading slides.1.title line 0 < OPF code 1 panel < OPF code 1 highlight 1 < OPF code 1 highlight 2 < OPF code 1 language line 1 < OPF code 1 body line 1 < OPF code 1 body line 2 < OPF code 1 body line 3 < OPF code 1 body line 4 < OPF code 1 body line 5 < OPF code 1 body line 6
```

**slide 2: highlight band 1**

```xml
<p:spPr><a:xfrm><a:off x="557784" y="2085594"/><a:ext cx="11076432" cy="418338"/></a:xfrm><a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="193853"/></a:solidFill><a:ln></a:ln></p:spPr>
```

**slide 3: run languages**

```xml
DRAFT: lang=en-US
Per-run language: lang=en-US
Default English.: lang=en-US
Bonjour le monde.: lang=fr-FR altLang=en-US
こんにちは: lang=ja-JP altLang=en-US
```

**fa-13-preset-1x1.pptx p:sldSz**

```xml
<p:sldSz cx="6858000" cy="6858000"/>
```

**fa-13-preset-4x5.pptx p:sldSz**

```xml
<p:sldSz cx="6858000" cy="8572500"/>
```

**fa-13-preset-9x16.pptx p:sldSz**

```xml
<p:sldSz cx="6858000" cy="12192000"/>
```

### Offline verdict on this OOXML

- ok: preset 1x1 slide size 540 x 540 pt (<p:sldSz cx="6858000" cy="6858000"/>)
- ok: preset 4x5 slide size 540 x 675 pt (<p:sldSz cx="6858000" cy="8572500"/>)
- ok: preset 9x16 slide size 540 x 960 pt (<p:sldSz cx="6858000" cy="12192000"/>)
- ok: watermark rot=19800000 (330 degrees = -30), alpha 15000 (rot and alpha present)
- ok: watermark is the first shape (behind content) (, OPF watermark text, OPF heading slides.1.title line 0)
- ok: bands are rectangles between the panel and the line text boxes (panel@3, bands@4,5, first line@7)
- ok: per-run lang is written (fr-FR, ja-JP) and the default run keeps en-US (DRAFT: lang=en-US | Per-run language: lang=en-US | Default English.: lang=en-US | Bonjour le monde.: lang=fr-FR altLang=en-US | こんにちは: lang=ja-JP altLang=en-US)

## FA-14

Deck(s): `decks\fa-14-chart-highlight.pptx`. Built with C:\opf-work\fa-14\opf-pptx (branch codex/fa-14-chart-highlight).

### PASS means

- `slide1-series-highlight-accent1-vs-muted`: series 1 (North) Format.Fill.ForeColor.ObjectThemeColor = 5 (msoThemeColorAccent1) and RGB = the theme accent1 (#2874A6); series 2 (South) RGB = the muted 4D5D7B and not theme color 5.
- `slide2-category-highlight-point-differs`: series 1 Points(2) (Q2) is accent1 (#2874A6), Points(1) is muted 4D5D7B, the two fills differ.
- `slide3-pie-highlight-slice-accent1-others-muted`: pie: Points(2) (APAC) accent1, Points(1) and Points(3) muted 4D5D7B.
- `slide4-line-category-highlight-opens`: the line chart exists after open with 2 series and 4 points (a chart that needed repair is dropped or empty).
- `slide4-line-point-3-colour-info`: informational (pass=null): the marker colors of Points(1) and Points(3); compare with the `c:dPt` marker fill below.

### OOXML the exporter wrote

**chart1.xml series and data points**

```xml
ser 0: <c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:effectLst/> </c:spPr> ser 1: <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:effectLst/> </c:spPr>
```

**chart2.xml series and data points**

```xml
ser 0: <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:effectLst/> </c:spPr> <c:dPt><c:idx val="1"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:effectLst/></c:spPr></c:dPt> ser 1: <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:effectLst/> </c:spPr> <c:dPt><c:idx val="1"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:effectLst/></c:spPr></c:dPt>
```

**chart3.xml series and data points**

```xml
ser 0: <c:spPr> <a:solidFill><a:schemeClr val="accent1"/></a:solidFill> <a:ln w="9525" cap="flat"><a:solidFill><a:srgbClr val="F9F9F9"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/> </c:spPr> <c:dPt> <c:idx val="0"/> <c:bubble3D val="0"/> <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:effectLst/> </c:spPr></c:dPt> <c:dPt> <c:idx val="1"/> <c:bubble3D val="0"/> <c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:effectLst/> </c:spPr></c:dPt> <c:dPt> <c:idx val="2"/> <c:bubble3D val="0"/> <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:effectLst/> </c:spPr></c:dPt>
```

**chart4.xml series and data points**

```xml
ser 0: <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/> </c:spPr> <c:dPt><c:idx val="2"/><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln w="9525" cap="flat"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr></c:marker><c:bubble3D val="0"/></c:dPt> ser 1: <c:spPr><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:srgbClr val="4D5D7B"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/> </c:spPr> <c:dPt><c:idx val="2"/><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln w="9525" cap="flat"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr></c:marker><c:bubble3D val="0"/></c:dPt>
```

### Offline verdict on this OOXML

- ok: series highlight: series 1 schemeClr accent1, series 2 muted srgb, no dPt (["<a:schemeClr val=\"accent1\"/>","<a:srgbClr val=\"4D5D7B\"/>"])
- ok: category highlight: dPt idx 1 accent1 in each series, series muted ([{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"}]},{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"}]}])
- ok: pie: dPt idx 1 accent1, idx 0 and 2 muted ([{"idx":0,"fill":"<a:srgbClr val=\"4D5D7B\"/>"},{"idx":1,"fill":"<a:schemeClr val=\"accent1\"/>"},{"idx":2,"fill":"<a:srgbClr val=\"4D5D7B\"/>"}])
- ok: line: dPt idx 2 present for each series ([{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":2,"fill":"<a:schemeClr val=\"accent1\"/>"}]},{"series":"<a:srgbClr val=\"4D5D7B\"/>","points":[{"idx":2,"fill":"<a:schemeClr val=\"accent1\"/>"}]}])

## FA-15

Deck(s): `decks\fa-15-combo-chart.pptx`. Built with C:\opf-work\fa-15\opf-pptx (branch codex/fa-15-combo-charts).

### PASS means

- `chart-present / two-series`: the chart is native (HasChart) and has 2 series (Revenue, Margin).
- `series1-clustered-column`: SeriesCollection(1).ChartType = 51 (xlColumnClustered).
- `series2-line-with-markers`: SeriesCollection(2).ChartType = 65 (xlLineMarkers).
- `series2-secondary-axis-group`: SeriesCollection(2).AxisGroup = 2 (xlSecondary).
- `secondary-value-axis-number-format-0pct`: Axes(2, 2).TickLabels.NumberFormat = "0%".
- `primary-value-axis-number-format-info`: informational: the primary axis format ($#,##0.0 expected).

### OOXML the exporter wrote

**barChart (series 1, primary axes)**

```xml
<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser>...</c:ser> <c:dLbls><c:numFmt formatCode="$#,##0.0" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:separator>, </c:separator><c:showLeaderLines  ...
```

**lineChart (series 2, secondary axes) series header and marker**

```xml
<c:ser> <c:idx val="1"/><c:order val="1"/> <c:tx> <c:strRef> <c:f>Sheet1!$C$1</c:f> <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Margin</c:v></c:pt></c:strCache> </c:strRef> </c:tx> <c:spPr><a:solidFill><a:srgbClr val="89B4DC"/></a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:srgbClr val="89B4DC"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/> </c:spPr> <c:marker> <c:symbol val="circle"/><c:size val="6"/> <c:spPr> <a:solidFill><a:srgbClr val="89B4DC"/></a:solidFill> <a:ln w="9525" cap="flat"><a:solidFill><a:srgbClr val="89B4DC"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln> <a:effectLst/> </c:spPr></c:marker><c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="0" i="0" u="none" strike="noS
```

**secondary c:valAx**

```xml
 <c:axId val="2094734553"/> <c:scaling><c:orientation val="minMax"/> </c:scaling> <c:delete val="0"/> <c:axPos val="r"/><c:title> <c:tx> <c:rich> <a:bodyPr/> <a:lstStyle/> <a:p> <a:pPr> <a:defRPr sz="1200" b="0" i="0" u="none" strike="noStrike"> <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill> <a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:defRPr> </a:pPr> <a:r> <a:rPr sz="1200" b="0" i="0" u="none" strike="noStrike"> <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill> <a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:rPr> <a:t>Margin (%)</a:t> </a:r> </a:p> </c:rich> </c:tx> <c:layout/> <c:overlay val="0"/> </c:title><c:numFmt formatCode="0%" sourceLinked="0"/> <c:majorTickMark val="out"/> <c:minorTickMark val="none"/> <c:tickLblPos val="nextTo"/> <c:spPr> <a:ln w="12700" cap="flat"><a:solidFill><a:srgbClr val="888888"/></a:solidFill> <a:prstDash val="solid"/> <a:round/> </a:ln> </c:spPr> <c:txPr> <a:bodyPr/> <a:lstStyle/> <a:p> <a:pPr> <a:defRPr sz="1200" b="0" i="0" u="none" strike="noStrike"> <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill> <a:ea typeface="Roboto"/><a:cs typeface="Roboto"/></a:defRPr> </a:pPr> <a:endParaRPr lang="en-US"/> </a:p> </c:txPr> <c ...
```

### Offline verdict on this OOXML

- ok: barChart barDir=col grouping=clustered with series 1 (barChart)
- ok: lineChart with markers holds series 2 (lineCharts=1)
- ok: secondary valAx axPos=r with numFmt 0% (<c:numFmt formatCode="0%" sourceLinked="0"/>)
- ok: line group uses a second axis pair (two valAx ids)
