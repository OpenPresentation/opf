---
type: fixed
packages: [opf, pptx]
---

A waterfall whose column number format has `;` sections (`+0.0;(0.0)`) shows its steps and totals through that format and adds no sign of its own, in the preview and in the native chart's `formatCode` (before, both added a sign in front of the format's own: `++4.5`, `−+2.5`, and `"+"+0.0;"−"+0.0;+0.0` in the chart part). A native waterfall with sectioned labels imports as the default labels.
