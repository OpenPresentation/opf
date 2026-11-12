---
type: fixed
packages: [opf, render, pptx]
---
RR-105 (output-changing only for a title, subtitle or display text with a run of two or more spaces, or a tab, between two words): heading balancing keeps every such authored run at the end of a line, where it hangs, and never inside a balanced line, so it no longer moves the word before the run to the next line ("Strong quarter across", 17 spaces, "business" drew "Strong quarter" over "across … business"). When no break set of the same line count does that, the paragraph keeps its greedy wrap, as PowerPoint wraps it. Authored text, no-break spaces, word joiners, indentation, hard breaks and rich runs are unchanged, and headings with single spaces balance as before. Preview and export read the same core lines.
