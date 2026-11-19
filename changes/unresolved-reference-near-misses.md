---
type: fixed
packages: [opf]
---
`opf/unresolved-reference` suggests only a near miss of the unknown id: a record within the usual edit distance that is also a plausible respelling (it shares a word or its first three letters, has the same letters, or shares half its letter pairs). `"layout": "title"` was offered `table` (two edits apart); `two-colum` still gets `two-column` and `tabel` gets `table`. With no near miss, the finding no longer lists the nearest spellings: it says that without the `layout` key the slide composes automatically from its content and that `search_catalog`, `opf catalog <kind>` and pptx.gallery list the ids. An unknown id stays unknown; the finding's `suggestions` hold the near misses only.
