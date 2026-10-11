# RR-83 schema and normative documentation audit

This isolated follow-up starts from core #593 `13e1c4dc683eb5ad5eaa69b3d72e4fcf5e26b493`; frozen #592/#593 and the gallery candidate remain unchanged.

The new general checker validates every positive `examples` annotation at its declaring JSON Schema node, including property-level annotations. It additionally validates embedded catalog records against the kind's companion schema rather than accepting the document schema's generic `CatalogRecords` object. There are 919 examples across 16 schemas and four embedded records. Core tests also validate all four records through core's companion/semantic engine, including a negative nonrectangular-grid case.

Against the frozen parent schemas, the checker identifies three invalid placeholder records (Catalogs' `hero`, `q4-special` and property-level default `two-column`) and the preview schema's rejection of all 28 actual gallery 2 SVG filenames. All pass after correction.

```sh
node scripts/check-schema-examples.mjs
node scripts/check-schema-examples.mjs --preview-index /path/to/gallery/previews/layouts/index.json
OPF_GALLERY_PREVIEW_INDEX=/path/to/gallery/previews/layouts/index.json node --test scripts/check-schema-examples.test.mjs
node --test packages/javascript/test/schema-examples.test.mjs
```

The explicit candidate path was `/private/tmp/opf-gallery2-bootstrap/previews/layouts/index.json`, gallery head `e0a7eee2dfe996e680b34a907cabfe41905e6d99`. The gallery agent confirmed there is no separate schema copy; its declarations already require version 2 and SVG. The check verifies the index schema, catalog order and identity, matching filenames, exact byte lengths and self-contained SVG content. Negative tests cover mismatched identity, duplicate IDs, wrong bytes and an old version. No candidate files or registry resolution entries were changed.

Normative fixes cover heading areas and image-region binding in the document schema, layout schema URLs, `contentDirection`/automatic `chartPrimary`, the `metrics` layout, the registered-catalog config example, `llms.txt`, and the spec README. Generated reference docs were rebuilt. Historical plans, evidence and release descriptions retain their historical facts; the OPF document schema's `/v1` URL is unchanged.

The five-slide partner demo now uses a custom v2 opening template with a heading and text region. Comparing parsed JSON with the parent gives exact equality after excluding only `/slides/0/layout`, `/catalogs/default/layouts/title-subtitle`, and `/catalogs/custom/layouts/partner-cover` (then removing the empty custom wrapper). Every authored payload and other metadata is preserved. The resulting file SHA-256 is `76f139b16c564f1d9a496a4377dc74247e0664fecba835ce62aea8172167b032`; core format validation returns valid with zero findings. This is content/schema evidence, not native or visual acceptance.

Golden baselines and registry/version preparation are unchanged. The inherited registry golden gate remains pending with RR-83.
