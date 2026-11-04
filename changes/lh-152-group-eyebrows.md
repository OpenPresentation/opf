---
type: changed
packages: [opf]
---
LH-152 (layout harvest; output-changing): a short label heads its list or group. LH-50's label (3 words or fewer, no full stop) is also the eyebrow of a list or a group right after it, at the root or inside a group, and a group's first child that is a label followed by two or more blocks with no label among them heads the whole group, instead of an equal-width row cell half a slide from its content (PR767 P31). A group's eyebrow takes a band at the top of the group and is drawn over the span its blocks cover. An explicit arrangement (a `composition` mode, weights or columns of the slide or the group) keeps its blocks as authored, a group of labels alone heads nothing, and a root label before a list stays a block on a layout with a `sequence` region. LH-147 and LH-62 were decided without a change: a short centered body keeps its title at the top margin (LH-48), and the quote layout keeps its whole-group stack.
