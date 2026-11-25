---
type: fixed
packages: [pptx]
---

A deck whose table rows carry ids now opens in the released 0.36.0 importer with its authored table: the table-data record stores the authored table with array rows (the row ids travel in the slide record's `entryIds`, and a 0.37 import puts the row objects back), where the 0.36.0 table schema rejected a row object and fell back to styled native cells with `invalid-data-provenance`. A deck without row ids is unchanged.
