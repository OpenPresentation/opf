---
type: fixed
packages: [opf]
---

Retain settled source text sizes when automatically continuing overfull whole blocks. Page selection prioritizes comparable automatic body roles before page count, preserves explicit author styles and minima, and caps actual arrangement labels at an explicit `composition.maxFontSize`. The pages after the first share their sizes without being held to the first page: each is capped at the larger of the first page's size and the smallest size any later page reaches on its own, so continuation pages that all grow keep their growth (no continuation page of the template corpus is smaller than v0.33.0 drew it). This changes continued-slide drawing; it adds no fixed readability floor or schema property.
