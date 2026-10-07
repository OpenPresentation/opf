---
type: changed
---
FA-01 (needs @openpresentation/opf with the FA-01 layout schema): layout pickers and gallery apply read the layout record shape. Layout placeholder kinds are the one content-kind vocabulary (`image` and `video` replace `picture`, `media` and `diagram` in slot labels, ordering and populated blank payloads), and applying a gallery layout inlines its own placeholders, `design` and `composition` instead of a record guessed from the removed `contentType` and `contentMultiple` fields. The image-fill control is labelled "Image placeholders".
