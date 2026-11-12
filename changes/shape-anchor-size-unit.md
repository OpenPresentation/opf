---
type: added
packages: [opf]
---

`opf/shape-anchor-size-unit` (warning): an anchored overlay shape's `at.width` or `at.height` above 4 and up to 1280 is most likely a 0.33 size in pixels, which now reads as a fraction of the target block and would draw a frame hundreds of times its size. The finding says `Did you mean "widthPx"?` and its patch renames the key and keeps the value; the engines still read only the fraction meaning. Also: `en-UK` on a slide's `language` is the same schema error as on the deck, and on a run's `language` an `opf/language-tag` error with the `en-GB` patch (it was a warning), an image callout's text is checked by the text rules (placeholders), a table cell's `style.fill` written like a background is no longer called a shape fill, `opf/variable-group-omitted` names the overlay shapes and connectors attached to the omitted group, and a timeline with extreme but schema-valid `duration` ratios composes with a minimum share for the short event instead of throwing.
