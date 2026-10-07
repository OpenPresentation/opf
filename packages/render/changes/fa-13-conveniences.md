---
type: added
---
FA-13: the preview draws the small conveniences core adds. `code.highlight` draws one theme-derived band behind each run of marked lines and dims the unmarked lines (every colour at least 4.5:1 on what it sits on). A text `design.watermark` (`{ text, opacity }`) is one centered line in the heading font and the theme text color, rotated 30 degrees counterclockwise. A `TextRun` with `code: true` draws in the design's code font (also in tables and lists), and a run with `lang` declares it on the run's text and takes the script fonts of that language for Han text and other language-dependent glyphs. The `1:1`, `4:5` and `9:16` slide-size presets compose at 7.5 x 7.5, 7.5 x 9.375 and 7.5 x 13.333 inches. Decks that use none of these render byte-for-byte as before.
