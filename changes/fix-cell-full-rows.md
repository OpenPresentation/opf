---
type: fixed
packages: [opf]
---
Blocks in cells, full rows (opf#1412 A1, output-changing for slides that name two or more cells, all in rows that are full, with other rows unnamed): when every row the cells name covers every column that takes space, the rows no cell names give their space away, so a top or bottom row of blocks alone takes the whole body (its blocks in the middle of their cells, a chart no longer squeezed into a third) and full `middle` plus `bottom` rows share the body, instead of leaving a third or two thirds of the slide empty. A lone block keeps its edge, as OPF 0.35.1 placed it (a `bottom:end` note, a `top:start` label, a `top` band), and so does a row that is not full (`top:start` and `top:center` beside an empty end column). A slide drawn over a background picture keeps its rows, since its cells may sit on panels the picture draws.
