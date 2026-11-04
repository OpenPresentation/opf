---
type: changed
packages: [opf]
---
LH-147, LH-152 (layout harvest; output-changing), LH-62 (evaluated, unchanged):

- **Headings join a body far below them (LH-147).** When LH-48 or LH-102 sets a short body in the middle of the space under the headings more than 160 px (at a 720-pixel short edge) below their last line, the title, subtitle and tag move down to one gap above the body, so headings and body are one group in the middle of the slide (the PR767 audit's P01, P02 and P34). Only the headings move (and a template's heading areas with them); no size changes. A taller body, a body beside the headings, a stacked record, a slide whose headings are its message and a body with a pull line keep their places. Across the 976 corpus, narrative, chart and mixed slides 28 move their headings (42 with the engines' text measurement); none changes a size or gains a finding. Of the composition goldens, 49 short cases move their headings and nothing else.
- **A label heads its list or group (LH-152).** LH-50's short label (3 words or fewer, no full stop) is also the eyebrow of a list or a group right after it, at the root or inside a group, and a group's first child that is a label followed by two or more blocks heads the whole group, instead of an equal-width row cell half a slide from its content (PR767 P31). A group's eyebrow takes a band at the top of the group and is drawn over the span its blocks cover; a root label before a list stays a block on a layout with a `sequence` region.
- **The quote layout keeps its whole-group stack (LH-62).** Keeping its title at the top margin, as Claude Design does, would lose quote size (40 to 28 px on b14 s41) and conflict with LH-147; the evidence is on the LH-147 sheet.
