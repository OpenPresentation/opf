---
type: added
packages: [opf, cli]
---
RR-77: `{n}` in a `.png` or `.svg` output of `convert` and `opf convert` is the deck's slide number: `opf convert deck.opf.md "slides/slide-{n}.png"` writes `slides/slide-1.png` and on, and `convert(input, "slides/slide-{n}.png")` the same. A pattern always numbers its files, even for a one-slide deck or one selected slide, and with `--slides 2,5` the numbers are 2 and 5 (padded to the largest). `{n}` is the only placeholder: any other `{key}`, and `{n}` in a `.pdf`, `.pptx`, `.zip` or deck-form output, is refused with `invalid-option` (`opf convert`: usage error, exit 2). A `.zip` keeps its entries named like the plain form.
