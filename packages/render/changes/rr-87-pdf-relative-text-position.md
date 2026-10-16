---
type: fixed
---
Report unsupported SVG relative text positions (`dx` and `dy`), including nested text spans, and refuse them in strict vector PDF mode instead of silently ignoring them. Valid zero-position lists retain their previous bytes. The existing raster PDF mode remains an alternative when vector text positioning is unsupported.
