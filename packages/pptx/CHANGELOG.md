# Changelog

## 0.1.0

- Require core 0.4.0, with an optional renderer 0.1.0 peer for coordinated consumers.
- Share composition and measured rich-text/list geometry while preserving native editable PowerPoint objects.
- Support nested dynamic layouts, stable export bytes and mechanical OOXML import/round-trip checks.
- Pin PptxGenJS 4.0.1 and verify model operations and embedded data/local/resolved images without loading its unused image-size dependency. The transitive security advisory remains documented and unresolved.
- Verify clean registry installs on Node 20 and 24 before provenance publication.

Native PowerPoint raster comparison and full visual/round-trip fidelity remain unfinished; schema-valid import is not proof of faithful rendering.
