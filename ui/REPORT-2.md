# Interface checks and editing tests in Keynote 16.0, second session (2026-11-27, 15:12 to 15:32 UTC)

Saved by the supervisor from the agent's hand-back. Rows: `checks.tsv` (28 appended); pictures `shots/`; notes `session2-notes.txt`. Paused 15:13 to 15:20 UTC for the native-testing session's smoke gate. Nothing saved; no document left open (Keynote's document list empty at 15:31 UTC, object model); `shasum -a 256 -c` passed for every opened file. Full-screen control requested once (15:21 UTC), not answered: everything that needs Keynote as the active app is "not run".

Typing on the canvas was refused in background mode, so every edit went through Keynote's scripting dictionary (object text, row count, cell value). New list lines were added by setting the box's text to its old text plus three lines, not by pressing Return.

## Editing tests (layouts-ordinary, 0.36.0)

| Test | Default (one text box per line or bullet) | Native (body placeholder) |
|---|---|---|
| C1 slide 7 "List": 3 lines added to the last bullet | Same bullet, Helvetica 27 pt. New lines sit closer together than the separate bullet boxes above (no paragraph space inside one box). The box grows from 32 to 128 pt, ending at y 496, just above the slide number; no shrink, no overlap. Seen and object model. `C1-default-before/after.png` | Eight bullets, all 27 pt, same bullet. Box stays 887x384; text centered vertically, gaps between paragraphs close up; no overflow. Seen and object model. `C1-native-*.png` |
| C2 slide 6 title + 62 characters | One line, drawn much smaller (shrunk to fit) in an unchanged 874x49 box; the dictionary still reports 40 pt. No wrap, no overlap. Seen. `C2-default-*.png` | Identical (the title is the layout's title placeholder in both modes). `C2-native-*.png` |
| C3 slide 32 table: one row added, "Hub E" in its first cell | Row inherits Helvetica 24 pt, white text, row fill, bottom rule. Table grows to 249 pt (ends y 429): row 6 is drawn over the caption "Hub B is at risk…" (a text box at y 392). Seen and object model. `C3-default-*.png` | Same row style. The caption is a body placeholder at y 461: no overlap. `C3-native-*.png` |
| C4 chart value doubled | Not run: Show Chart Data Editor is disabled with Keynote in the background | Not run, same reason |

Default versus native for someone editing in Keynote: in native mode lists and captions behave like a normal Keynote deck (the body placeholder tightens added lines inside its box; its position keeps a growing table off the caption). In default mode each line or block is its own text box sized to its text: added lines make that box grow down onto what is below, and a growing table runs over the caption under it. Titles are the same in both modes: they shrink to fit rather than wrap.

## Interface checks

- A7 slide-links (`main`), partly: with the linked rounded-rectangle group on slide 1 or the group on hidden slide 4 selected, Format offers "Edit Link" and "Remove Link"; the unlinked title shows "Add Link". A text box with links on words shows "Add Link" at box level; the linked words are blue and underlined (seen, `A7-slide-links-s1.png`). Link type and target: not read (Edit Link disabled in background).
- A8 opf#1418, coverage-backgrounds slide 5: confirmed in the document window. Window (20, 59, 85) = (23, 69, 99) at 85% over black; Keynote's slide PNG (23, 69, 99) alpha 217; OPF preview (59, 98, 123), the same color over white. The Slide inspector's fill swatch is half-transparent. Seen and files. `A8-coverage-backgrounds-s5-window.png`. In Play: not run.
- opf#1416 item 3 (`3-bg-alpha-on-white`): window (58, 97, 123), matches the preview, solid swatch: the fix works in the window (seen, `1416-item3-s5-window.png`).
- A2, A1 slides 2-3, lang-rtl chart data: not run (menu disabled in background).
- A9 Warnings lists (8 files): not run; the panel never appeared and View > Show Warnings is disabled in background. Variant "b" of pic-placeholders does not exist (a, c1, c2, d, e0, e1 do).
- List B (seen in the inspector unless marked):
  - coverage-charts 7: Chart Type "2D Column"; value axis reads 0, 2, 5, 7, 9 (uneven, rounded steps).
  - Extended charts (chart-type-sampler 1-2, coverage-charts 17 right): pictures (object model).
  - sweep-growth native 4: Bullets & Lists "Bullets*", 42 pt, spacing 51 pt.
  - sweep-tables 12: header cells Helvetica-Bold 24 pt, wrap on; "Participant|s", "Tea|m", "Completio|n" break inside the word; widening column B by 8 pt fixes "Participants".
  - sweep-tables 4: numbers stored as text, format Automatic, aligned right (object model). coverage-tables 1: "$120,000" is text, format Automatic, not Currency (object model). coverage-tables 3 merged cells: not run (not exposed).
  - m-text-flush 3: aligned right, Aptos marked missing, 32 pt; the first line ends about 4 pt right of the others.
  - m-agenda: slide 2 title 30 pt, style "Title*", Aptos Display marked missing, drawn shrunk; slide 1 badge is a group of a shape and a text box "1" (object model).
  - coverage-lists 13: bullet "•", size 100%, indent 0 / 46 pt.
  - shape-effects 2: inner shadow, glow, soft edge, blur shapes all show Shadow none, Reflection off, Opacity 100%: the effects are dropped.
  - coverage-shape-presets: chevron and rightArrow show the green edit handle; triangle has none.
  - lang-southeast-asia 1: Font pop-up "Leelawadee UI" with the missing mark; the dictionary reports Helvetica.
  - m-links 1: both footer boxes carry a box-level link (menu title).
  - m-charts 13: no Description field on the chart's Arrange or Chart tab.

## Not run

Needs Keynote as the active app: C4 (both files) and the m-charts slide 1 "Wait" column; A2; A1 slides 2-3; lang-rtl chart data; m-charts 5 Value Labels; sweep-records chart data; all A9 Warnings lists; link type and target (A7, m-links). Play not allowed: A8 in Play. Not exposed: coverage-tables 3 merged cells; in-place edit of the m-agenda badge.

To finish: Keynote in front (owner) or full-screen control approved; each item is then one menu step on a held document.
