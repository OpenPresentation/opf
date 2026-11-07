---
type: fixed
packages: [pptx]
---
The PPTX export never asks PowerPoint to shrink text on overflow. The exporter's own text-box defaults and the content placeholder no longer request PptxGenJS's `fit: "shrink"`, which wrote a bare `<a:normAutofit/>`: PowerPoint left such a box at OPF's size on open, then scaled its text down (to as little as 25%, with no readability floor) the first time someone edited it. Every exported text keeps its explicit size with autofit off. A new test checks that no part of an export carries `normAutofit`, `spAutoFit` or a `fontScale`.
