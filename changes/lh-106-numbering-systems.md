---
type: fixed
packages: [opf, render, pptx]
---
LH-106: numbers OPF generates (metric values and deltas, table numbers, chart labels, ticks and percentages, step badges, number variables) are drawn in the digits of the slide's or deck's language, consistently: `ar-SA` draws `٩٩٩` and `١,٠٠٠`, `fa-IR` `۱٬۰۰۰`. PowerPoint draws the same digits, since native charts carry its numeral-shape prefix. Choose Latin digits with `-u-nu-latn` (`ar-SA-u-nu-latn`). Slide numbers, numbered-list markers and chartex charts (waterfall, histogram, funnel, ...) stay in Latin digits, because PowerPoint draws them so. Exporting an `ar-SA` deck without Arabic text no longer fails with `missing-glyph`.
