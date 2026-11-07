# v0.33.0 integration: LH-184 with LH-186

The template baseline (`layout-templates-rr96-color-variants.json`) was regenerated on the integration branch with `node test/layout-template-goldens.mjs --update`, reviewed as a before/after sheet against `main` (49 of 624 slides), and `--promote`d. Every changed slide is either LH-184's (36 slides: `columns: "auto"` keeps the largest text, the paginated agenda, list and FAQ pages, `agenda 1 long`, `list 1 long`, `faq 1 long`, `feature agenda bulleted-30`) or LH-186's (13 slides, listed in `LH-186.md`), with the hash each PR promoted on its own branch.

The two meet on the first page of `paginated faq 4 long` and `paginated faq 6 long`. LH-186 alone recomposed it into one column at 28 px; with LH-184's prose measure applied to `layout-first` it keeps LH-184's two columns at 27 px. One column of 85 to 95 characters a line is no better than columns a half step smaller, so it is not taken unless it is a type-scale step (10%) larger.
