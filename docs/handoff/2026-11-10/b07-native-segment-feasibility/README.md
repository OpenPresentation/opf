# B07 native segment-box feasibility — diagnostic only

The five complete original 05/06/09/10/French11 slides have source-bound diagnostic variants. This is **not a product fix, native/glyph acceptance, approval of segment-level editing, or a public import/reassembly feature**. No Office, ValidateOnly or native controller ran.

Read [RESULTS.md](RESULTS.md), then run the builtin-only offline proof with the pinned Node24 executable:

```powershell
node docs/handoff/2026-11-10/b07-native-segment-feasibility/verify.mjs
```

It reads the sealed bytes; it never executes archived producer/worker code or invokes an engine. The final proof covers 168 lossless raw records, all five original/variant PPTX archives, complete native run properties and UTF16 ranges, unchanged vertical geometry and marker carriers, all non-slide archive parts, eleven untouched original shapes and the entire unchanged French negative archive. Native shape counts are 4/4/5/20/3.

Critical diagnostic constructors are `offset-loader.mjs` and `offset-variants.mjs`; the tested source is f8705070. They operate only in this fresh-main evidence lane. The loader uses a hash/unique-anchor-bound in-memory copy of historical473 renderer code: full numeric serialization precision plus existing pre-trim source offsets/text/placement/gap exposed as trace attributes. Removing those trace attributes reproduces all five prior full-precision SVG bytes exactly. Historical producer files were never edited or rebuilt.

`files/<original-id>/` contains the intact original OPF/PPTX and diagnostic variant. `manifest.json` indexes all raw records in `raw.json.gz`. Earlier invalid collector results, the ZIP-adapter failure and source-offset refusal remain literal. `font-provenance.json` and `licenses/intos/` bind the small public OFL Intos subsets already embedded by the renderer in raw SVG outputs; no full font files, private/system/owner fonts, installed consumer or credentials are archived.

The existing three-shape B07 native profile is inapplicable. No profile, schema, product source or acceptance limit was changed. Root and peer review precede publication or any separately authorized native work.