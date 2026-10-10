---
type: changed
packages: [opf]
---
opf#365 (docs only, no output change): the `DimensionPreset` and `Dimensions` descriptions now give each preset's size and the PowerPoint preset it matches, and say that `letter` and `a4` are the paper sizes while PowerPoint's "Letter Paper" (10 x 7.5 in), "A4 Paper" (10.8333 x 7.5 in) and "On-screen Show (16:9)" (10 x 5.625 in) are not OPF presets and are set with `widthInches` and `heightInches`. New [slide sizes](docs/slide-sizes.md) page: every OPF preset in inches, points and EMU, PowerPoint's presets ("Widescreen", "On-screen Show (4:3/16:9/16:10)", "Letter Paper", "A4 Paper") side by side, the `p:sldSz` that PPTX export writes and what import does with a size that is not a preset, citing ECMA-376 and Microsoft's documentation.
