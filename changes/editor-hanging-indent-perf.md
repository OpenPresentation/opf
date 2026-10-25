---
type: fixed
packages: [editor]
---
The hanging indent of wrapped lines (0.26.7) no longer makes the source pane and the JSON editor slow: the stylesheet capped the hang with a percentage, which made the style and layout of every line very expensive (filling an 848-line document took 8.5 s instead of 0.56 s). The cap, still 40% of the line, is now worked out in columns from the measured width, in the editor's measure cycle, and the stylesheet has no percentage.
