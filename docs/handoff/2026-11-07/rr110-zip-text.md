# RR-110: ZIP evidence integrity

The source checker decoded ZIP review evidence as UTF-8, producing false mojibake findings. The same six immutable title/doughnut archives reproduce1,208false findings before the correction and classify as binary archives afterward; their hashes and bytes remain unchanged.

Vetoable decision: recognize standard ZIP local-file, empty-archive and spanning signatures, consistent with the existing binary gzip/image policy. A file named .zip still receives all normal text checks when it lacks a ZIP signature. A named compressed text report still requires valid gzip and strict UTF-8 decoding. No package runtime, source-text pattern, tolerance or evidence file is changed.

The seven focused controls pass, including a real stored ZIP, empty/spanning forms, case/extension independence, ordinary text named ZIP, immutable input and malformed named-gzip refusal. The six exact committed witnesses and full hydrated scan are recorded under docs/evidence/rr110-zip-text. Final changed-scope and integration CI are required. The strict gallery tracker will need its automatic generated refresh before final main integration; PR warning mode is not main acceptance.

Changed-scope verification passed build/Biome/changes/release-report/skills/stability/text, with only gallery-tracker failing because exact historical fixtures were omitted by the sparse checkout. After restoring those exact Git blobs, the complete mapped tracker command passes all18controls under the documented PR warning policy. Raw failure and final receipt are retained. This does not qualify strict main freshness; final integration must include its generated refresh.
