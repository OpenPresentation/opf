---
type: fixed
packages: [opf]
---
Pull lines (opf#1412 A4, output-changing for slides with no layout whose quote is drawn as LH-114's pull line): the stack of the data and its pull line now sits in the middle of the body instead of stopping halfway down under the title, and a sparse stack draws its pull line as a quote: the quote starts one or more steps of the type scale above the lead size, up to a lone quote's display size, at the largest start whose lines (at most two) keep the stack within three quarters of the body; it is never set smaller than at the lead size, and a pull line beside data that fills the body keeps the lead size. The slide is composed again with its body moved down by half the space the stack leaves, so every other block keeps the size it had at the top. A layout's pull line keeps its place.
