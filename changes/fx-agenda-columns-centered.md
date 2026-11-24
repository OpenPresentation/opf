---
type: fixed
packages: [opf, gallery]
drawing: ["layouts:agenda"]
---
An agenda of seven or more entries stands in the middle of the body as a short agenda does, instead of its columns starting at the top of a mostly empty body (C09). A list dealt into columns under a `middle` or `bottom` anchor now stands at the anchor as one block, as tall as its tallest column, and the `agenda` layout's body region says `anchor: "middle"`. Columns as even as each other now give the first columns the longer share: seven entries are 4 + 3 instead of 3 + 4, fourteen in three columns 5 + 5 + 4 (the last entry no longer counts as shorter for lacking the gap below it).
