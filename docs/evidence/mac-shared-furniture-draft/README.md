# Shared furniture source checkpoint

This evidence binds the unpublished source graph in `summary.json`. It proves readable shared geometry, source-aware canvas editing/undo and accepted PPTX drawing for the recorded cases. It does not establish semantic furniture reimport, native Office behavior, installed-package compatibility, corpus acceptance or release completion.

Core has 507 passing tests per runtime, plus the legacy pagination controls. The browser verifier is `scripts/test-furniture-workflow.mjs`; its 32 cases per runtime cover estimated/provided measurements, wide/portrait dimensions, floors 16/32 and inherited/local literal fields. Both runtime reports retain exact source and geometry. Four Node 24 full-size screenshots were viewed; all four match Node 20 hashes. The 32px portrait organization wraps onto two lines. This is bounded geometry, not a claim of optimal design.

PPTX `test/shared-furniture.mjs` checks 16 exports per runtime, including exact current DrawingML text, accepted text-box coordinates/font sizes, empty source fields, fitted images, explicit disabling and strict overflow. All 16 candidate files are byte-identical across runtimes. Their import semantics remain pending. Existing editor and converter suites pass on both runtimes. Renderer Node 24 checks pass except for the deliberately retained old-baseline comparison; the checks following that gate were run separately.

`corpus/` records 657 changed and 148 unchanged slides with the same 805-slide source digest. No baseline was promoted. This folder contains manifests, not a completed raster review. The next step is to retain the actual before/after PNGs, inspect every changed slide and select full-size controls before any acceptance.

`draft-failures/` retains a test runner invoked from the wrong working directory, two draft pagination mapping incompatibilities, and an invalid browser fixture that omitted required `organization.id`. Repeated metadata now uses optional `page.repeatedMappings`; existing body mappings retain their contract. The corrected fixture and checks pass. No authored source document was shortened to suppress an overflow, and no native Office retries occurred.

`SHA256SUMS.json` covers this directory except itself. Source-product commits precede the evidence commit; browser/converter reports also include verifier and bundle hashes where applicable. Versions, registry artifacts and sites remain unchanged.
