---
type: fixed
packages: [opf, render, pptx]
---
RR-105 (output-changing only for a title, subtitle or display text with a run of two or more spaces, or a tab, between two words): heading balancing keeps such an authored run at the end of a line, where it hangs, instead of moving the word before it to the next line; when no balanced break does that, the paragraph keeps its greedy wrap, as PowerPoint wraps it. Preview and export read the same core lines.
