---
type: fixed
packages: [opf, render]
---
RR-105: a deck whose real text widths take a branch the font analysis did not see (a wrapping "Topic: qualifier" title beside a shape, for example) no longer fails to convert with `font-unavailable`: `loadFonts({ presentation })` and `fonts.ensure(presentation)` now also compose and draw the deck with the real metrics of the faces they hold and prepare every face that pass measures, until a pass measures nothing new. The browser `ensure` shares this analysis, and both report `font-preparation-unsettled`, naming the faces, if preparation does not settle. As a second line of defense, `opf convert` and `convert` prepare a face the drawing still finds unprepared (at most four, each once), draw again and report it as the info finding `fonts/prepared-late`; hosts that call an exporter directly keep the error.
