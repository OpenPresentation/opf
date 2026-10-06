---
type: fixed
packages: []
---
RR-20: the generated schema docs (`docs/schema-reference.md`, `docs/catalog-schema-reference.md`, `docs/examples.md`) match `scripts/generate-schema-docs.mjs` again. Hand edits had replaced generated chart and table rows (RR-54) and added an `examples/markdown/` line (RR-30), and two schema description changes were never regenerated. The Markdown examples line now lives in the generator, the generator renders `if`/`then`/`else` requirements (the Table `dataset` or `rows` rule) as a conditional requirement, and the new `pnpm check:schema-docs` (in `pnpm test`) fails when a committed file differs from the generator output.
