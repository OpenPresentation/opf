---
type: added
packages: [opf]
---
FA-12: `Quote.role` (title and organization, drawn on its own footer line under the attribution) and `Quote.photo` (an Asset headshot drawn as a circle at the start edge of the footer row, mirrored in a right-to-left deck, three footer font sizes across and centered on the footer lines). `layoutQuote` returns `photo` (`{path, value, box, shape}` with the `ellipse` circle mask) and reports `photo-fit` when it cannot fit at the readability floor; a quote without a role or photo lays out exactly as before (digest-identical over the 126 example decks). The `missing-alt-text` audit rule covers `quote.photo`, quote-to-text conversion folds the role into the attribution line and reports the lost photo, and `docs/fixtures/testimonial-quotes.opf.json` is a reference deck. Markdown has no native form for the two fields: a quote that carries them is written as an `opf` block.
