# Keynote 16.0: computer-use recipes

Tried on 2026-11-25 with the computer-use `app_*` tools on `com.apple.Keynote` in **background mode** (Keynote never comes to the
front), on documents opened by `kn-run --hold` and closed afterwards with `kn-close` (`close … saving no`, no save dialog).
Status per recipe: **works** (done and seen), **not run** (needs full-screen control; the request timed out without an answer, so
these steps are written from the menu titles that `app_menu` listed, not tried).

## The one trick that makes background work possible: select through AppleScript

Clicks on the slide canvas are refused in background mode ("canvas/custom view with no accessibility action"). Select the object
through the dictionary instead; the window and the Format inspector follow:

```
osascript -e 'tell application id "com.apple.Keynote" to tell document id "<id>"' \
          -e 'set current slide to slide 6' -e 'set selection to {iWork item 3 of slide 6}' -e 'end tell'
```
(`iWork item i` = item i of probe.json's slide, 1-based; or `chart 1 of slide 6`, `image 1 of slide 1`, `line 1 of slide 4`.)
Then `app_list_windows` (window title = document name), `app_screenshot` with that `window_id`, and click the inspector's tabs
by `element_index` (they are accessible: "Style", "Text", "Arrange", "Chart", "Image", "Layout"); `app_scroll` at about
(820, 450) scrolls the inspector; `app_zoom` reads small text.

**Background limits seen:** every document-level menu item (View > Show Warnings, View > Show Object List, Format > Font > Replace
Fonts…, Format > Edit Link, Format > Chart > …) is reported *disabled* by `app_menu` while Keynote is not the active app, and the
missing-fonts banner and the canvas cannot be clicked. Those steps need full-screen control (owner's approval).

## Import warnings and missing fonts

What Keynote 16.0 shows (seen):
- In the document window, a dark banner at the top of the canvas: **"This presentation has missing fonts."** with a `>` chevron. It
  is a separate untitled window of about 324-350 x 101-112 pt over the document window (`tools/kwin` lists it); it may disappear
  after a while. Clicking it is refused in background mode (it is an AXImage with no action).
- A floating panel titled **"Warnings – <document name>"** (layer 3, 584 x 311 pt), heading "This PowerPoint presentation may look
  different. Here's a list of what changed when you opened it in Keynote.", then one line per warning, e.g.
  "Unsupported media were removed. Slide Layout(s): Cover, Gallery, Hero, Image, Image beside",
  "The font Aptos Display is missing. Your text might look different.", "The font Aptos is missing. …", and a **Replace Fonts…**
  button (never press it). Seen once for `pie-en.rc.pptx` (`_test/run1/pie-en.rc/_alert-window-5865.png`). The panel is on screen
  only while Keynote is the active app (it was not there in later background runs of the same file), so it is not shown on a
  scripted open in the background, and nothing in the dictionary reports it.

How to read it:
1. **works (automatic, when it happens to be visible):** kn-run's watchdog captures any "Warnings – …" window with `screencapture -l`
   into `<name>/import-warnings-<id>.png` and reads it with Vision OCR (`tools/kocr`) into `import-notes.txt`; tested on the capture
   above: the OCR text is exact.
2. **works (always, predicted):** `import-notes.txt` also lists the fonts the package names that this Mac lacks (`fonts.py`);
   that is what the font lines of the panel say (Aptos, Aptos Display on almost every deck; the theme's per-script list is not
   reported by Keynote in the panel seen).
3. **not run (needs full-screen control):** `kn-run --hold <file> --out <dir>`; bring Keynote to the front; menu **View > Show
   Warnings** (listed by `app_menu`, disabled in background); `app_screenshot` of the "Warnings – <name>" window; scroll if the list
   is long; write the lines into `<dir>/<name>/import-notes.txt`; close the panel with its close button (never Replace Fonts…);
   `kn-close --id <id>`. Same for **Format > Font > Replace Fonts…** (lists each missing font with its replacement pop-up): read,
   then **Cancel**.

## Read a text item's font, size, alignment, bullets and direction (works)

1. Select it through AppleScript (above). 2. Click the inspector tab **Text** (element "Text"), sub-tab **Style**.
3. Read: paragraph style button (e.g. "Caption"), **Font** pop-up (family; "Multiple" when the box has several), size field
   ("42 pt"), B/I/U/S toggles, **Text Color**, the alignment row (left / centered / right / justified: the selected one is
   highlighted; `app_ax_find role=AXCheckBox` lists them as "left", "centered", "right", "justified"), the indent row, vertical
   alignment (top / middle / bottom), then scroll down: **Spacing** ("1.0 - Single") and **Bullets & Lists** (e.g. "None*").
4. Sub-tab **Layout**: Columns, Text Inset, Indents, Tabs, Paragraph Borders.
Seen on coverage-languages slide 4 (Hebrew list): alignment **right**; Bullets & Lists **None\*** (the "1." numbers are text, not a
Keynote list). **Direction:** no right-to-left / left-to-right control appeared in the Text inspector on this Mac (Keynote shows it
only when a right-to-left input source is enabled, as far as I know: *inference, not seen*). The round trip shows what Keynote
writes for `rtl` (`pptx_inspect.py --diff original back.pptx`).

## Is the selected object a chart, a table, an image, a shape or a group? (works)

The inspector's tab names say it: **Chart / Segments (or Axis, Series) / Arrange** = a native, editable chart (coverage-charts slide 6:
Chart tab with Chart Styles, Title/Caption/Legend checkboxes, Chart Font "Helvetica", and at the bottom **Chart Type "2D Donut"**);
**Table / Cell / Text / Arrange** = table; **Style / Image / Arrange** = image; **Style / Text / Arrange** = shape or text box;
**Style / Arrange** with "Line Styles" = line. The dictionary says the same without the UI: `class of every iWork item of slide n`
(probe.json `class`). A picture of a chart would show the Image tab.

## Edit Chart Data (not run: needs full-screen control)

The dictionary cannot read or change chart data (confirmed: `properties of chart 1 of slide 6` = position, size, locked, parent).
Planned recipe (menu path from `app_menu`: Format > Chart exists; double-clicking the chart on the canvas is refused in background):
1. `kn-run --hold <deck with a native chart> --out <dir>`; select the chart through AppleScript (`set selection to {chart 1 of slide 6}`).
2. Full-screen control: menu **Format > Chart > Edit Chart Data** (or the "Edit Chart Data" button under the selected chart).
3. In the data editor, click one value cell, type a new number, press Return; `app_screenshot` the editor and the slide.
4. Close the editor (its close button); `kn-close --id <id>` (closes saving no; if a dialog asks, choose **Delete** / **Don't Save**).

## Image description (works)

Select the image through AppleScript; tab **Image**; scroll to the bottom: **Description** box. Seen on coverage-images slide 1:
"Harbor" (blank line) "OPF image 1" — the picture's `title` and `name`, not its `descr` ("Harbor at dusk with cranes and
containers"). The dictionary gives the same text: `description of image 1 of slide 1` (probe.json `description`). File Info shows
the file name ("image-1-1.png").

## Is a line a connection line attached to shapes? (works, without the UI)

The inspector does not say it (a selected line shows only Line Styles, Stroke "Line", Endpoints). Use the dictionary in memory:
`kn-edit --file <deck> --out <dir> --slide 4 --op move <item> 0 60` moves one shape 60 pt down and prints every line's start/end
points before and after; attached lines change. Seen on coverage-overlays slide 4: moving "Review" moved two of the three lines'
ends ((323,304)-(340,304) became (323,332)-(340,336); (480,210) became (480,271)): **they are connection lines**. The edit
sheet `keynote/_tooltest/edit/connector-move/edit.jpg` shows the lines following. The document is closed without saving.

## Links on text and on shapes (not run: needs full-screen control)

Format > Add Link / Edit Link / Remove Link are listed by `app_menu` and disabled in background. Planned: select the shape (or
double-click into the text, needs full control), **Format > Edit Link** shows the link editor with its target (Webpage / Slide /
Email …); read it with `app_screenshot`; press Escape; never click the link. Without the UI, the round trip shows whether Keynote
kept a link: `pptx_inspect.py --diff original.pptx back.pptx` lists `links` per slide (`hlinkClick` targets, slide jumps).

## Slide layout and Title / Body / Slide Number checkboxes (works)

Select nothing on the slide (or set `current slide`): the inspector's **Slide** pane shows **Slide Layout** (e.g. "Title Only 0") and
**Appearance** checkboxes **Title**, **Body**, **Slide Number** (accessible as AXCheckBox "Title", "Body", "Slide Number"), and the
Background. The dictionary gives the same: `name of base layout`, `title showing`, `body showing` (probe.json `layout`,
`title showing`, `body showing`; `isDefaultTitle` marks the item that is the layout's title placeholder).

## Slide number and footer settings (works for numbers; footers not exposed)

Per slide: the **Slide Number** checkbox (above). Document: `slide numbers showing` (probe.json `document`), settable with
`kn-edit --op slide-numbers true`. Keynote has no footer object in the dictionary; a footer from PowerPoint arrives as a text
item (probe.json) whose text can be compared with the .pptx (`pptx_inspect.py` `furniture`, `fields`).

## Not possible here

- **Play** is not started (owner's OK needed first). `kn-view.applescript` (owner-only) does it.
- Anything in background mode that needs a menu, the canvas, or the banner (see limits above).
