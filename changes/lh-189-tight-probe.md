---
type: fixed
packages: [opf]
---
`composeSlide` no longer composes most slides twice: LH-189's second, tight composition now runs only when the first one shows that the tight mode would fit some display text differently (opf#1321). On the 966 example slides the second pass ran for 981 of 986 compositions and was kept for none; `opf validate examples` goes from 43 s to 31 s with fonts and from 5.2 s to 4.0 s with estimated widths, with identical output.
