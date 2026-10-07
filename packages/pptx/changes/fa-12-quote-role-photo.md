---
type: added
---
FA-12: a quote's `role` (its own footer line) and `photo` (a native picture with the `ellipse` geometry, cropped to fill the circle, the alt text as its description) export in the shared core quote layout; import restores both from the `OPF_QUOTE_V1` group, reports `quote-photo-missing` for a deleted picture, and keeps the footer separators (`role` after a line break, `source` after ` - `) in the manifest.
