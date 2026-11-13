---
type: fixed
packages: [opf]
---
RR-105: `opf/missing-alt-text` and `opf/poor-alt-text` now read an image that comes from an image variable (`"image": "var:logo"`) by the variable's value, whose alt text the engines write, instead of reporting it as having none. A template's unfilled variable is read by its example.
