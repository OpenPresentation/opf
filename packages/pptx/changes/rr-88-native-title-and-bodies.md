---
type: added
---
RR-88: under `toPptx({bodyText: "native"})` a plain-string title that wraps over several lines is one native text box (native wrap, no autofit, measured block and line pitch) bound to the Title placeholder, so Keynote reports `title showing` on every slide (a wrapped title lost the placeholder before); a slide with several text, list or bullets regions gets one native body per region (the first is the Body placeholder, the others ordinary native text boxes); and a list that is one numbered sequence is written with native auto-numbers. Titles with a hard break or overflow, groups, restarted numbering and the other unsupported forms keep their measured shapes with `native-body-fallback`.
