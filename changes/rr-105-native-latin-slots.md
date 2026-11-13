---
type: fixed
packages: [opf, render, pptx]
---
RR-105 (PPTX output for right-to-left text): Latin words, digits, punctuation and spaces inside Arabic text keep their order, font and style in PowerPoint, in body text, numbered lists and wrapped list lines, also after the text is edited in PowerPoint. Typed export callbacks receive the diagnostics of text that falls back to measured fragments.
