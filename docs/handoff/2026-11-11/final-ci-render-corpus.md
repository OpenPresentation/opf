# Final CI: renderer interception and qualification capture

SOURCE ONLY, execution UNRUN. Base: `14de74b23d71a6274c28919de774dc7b7e1668fd`.

The retained Node22 render log (`job-130861726768.log`) has 9 passes and 2 failures in `node-color-raster.mjs`: the missing-companion child returned no refusal, and the optional-primary child recorded no attempted lookup. The integrity/read-file control passed. These outcomes do not prove a production loader defect or an upstream Node bug.

Both child controls now intercept the actual `createRequire(...).resolve` boundary used by `node-resolve.js`, before importing the loader. Every other resolution delegates to the original resolver. The children remain isolated, real font bytes and all existing typed-error/retry/package-order/coverage/hash assertions stay unchanged, and production code is untouched. Actual Node22 and Node24 qualification remains owed.

The retained LibreOffice job (`job-130861726211.log`) failed in **corpus preparation**, before starting LibreOffice: only `smartart-arabic` preview and default PPTX failed with an unprepared Intos/Aptos face at `/slides/1/items/0/0`. The immutable Arabic fixture already uses current `language` and valid typed fields. The uploader watched only `artifacts/libreoffice`; it now also preserves `artifacts/qualification`, where the failed producer writes its results. This captures the failure without weakening or skipping the gate.

The Arabic rendering cause is still under source review. A specific candidate is centered arrangement whitespace trimming (`composition.ts`): measuring an isolated trailing space selects the Latin slot, while the full Arabic fragment uses the complex-script slot. The narrow recording pass may not wrap and therefore may not demand that isolated-space face. No core, loader, fixture, schema, tolerance or golden has been changed for this hypothesis; a bounded actual causal probe is required before calling it confirmed.

Original CI failures remain authoritative and unmodified. No LibreOffice/application run, registry action, build, test, syntax check or CI retry was performed for this source packet.
