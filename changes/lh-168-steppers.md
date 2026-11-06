---
type: changed
packages: [opf, gallery]
drawing: ["layouts:process"]
---
LH-168 (output-changing): steps that wrap draw as a stepper in every language. A `process` layout of numbered steps (and any `steps` region) drew "1. Kickoff" columns in English and the stepper in Arabic: the step badges' guard compared each list's base size, which is the label's in the columns (37 px, the description at 0.82 of it) and the description's beside a badge (32 px, the label at 1.25 of it), so a stepper that sets every line larger (32 over 30 px) read as smaller and lost wherever the descriptions wrapped, and won only where short text let the columns grow no further. The guard now also accepts steps whose smallest drawn size (each list's label and description sizes) is no smaller, still with LH-149's half-step discount; a slide that kept its badges keeps them. A row of steps that fills half the body or more keeps its size and is centered under the title as the columns are. Steps that would really draw smaller under their badges (six steps of long descriptions) keep the columns. Narrative n09 and n10 now match n11 and Claude Design.
