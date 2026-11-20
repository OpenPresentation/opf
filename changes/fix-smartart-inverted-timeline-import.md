---
type: fixed
packages: [pptx]
---
SmartArt import: PowerPoint's Bullet Timeline Inverted is read as a process list. The importer took any layout whose id contains "Inverted" for an inverted pyramid, so that timeline came in on the `pyramid` arrangement pointing down; only a pyramid layout is read that way now. Inverted Pyramid itself imports as before.
