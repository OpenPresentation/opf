---
type: added
packages: [opf, cli]
---
opf#567: `validate` warns with the new format rule `opf/slide-size-out-of-range` when the deck's custom slide size (`design.dimensions`, or the resolved theme's `dimensions`) has a side outside PowerPoint's range of 1 to 56 inches. ECMA-376 / ISO/IEC 29500-1 §19.2.1.39 limits `p:sldSz` to 914400 to 51206400 EMU per side, and the schema accepts any positive size. Inches are converted to EMU as the PPTX exporter writes them, so exactly 1 in and 56 in pass, and presets never trigger it. It is a warning, so `valid` does not change, and `opf validate --list-rules` lists it (69 rules).
