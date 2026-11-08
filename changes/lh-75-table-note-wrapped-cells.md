---
type: changed
packages: [opf]
---
LH-75 (output-changing for a short table with a note): a table beside its note may now wrap a cell onto two lines, with every word kept whole, so the table keeps its size instead of falling back to a stack with the note under a full-width table. A cell that would need three lines, or a word too wide for its column, still keeps the stack. The table layout's b15 s23 and s41 now draw the table at 70% beside the note on its card, as Claude Design does. Automatic slides that already set a note beside a table now put the note on its card.
