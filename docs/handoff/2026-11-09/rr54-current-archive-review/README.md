# Actual current21-deck RR54 review

The existing maintained reviewer ran **once** on baseline `c9732accd41cfffa27b8893251f33868c6b0514e` and current `5b9e4386c00319da1fa4370dcc0b3eb6e93c9578`. All21 current full archive hashes, byte lengths and part counts equal their reviewed locks. All3 applicable native-slide XML subdigests also match. There are **zero archive differences** in this family; the nine registered-Gallery fallback decks are a separate review.

This is an **evidence-only branch; never merge it as product source**. No fixture, history, hash, source, golden or tolerance was promoted or changed. No native application acceptance is claimed.

## Actual maintained contract and decision

Vetoable **RR54-MAINTAINED-INTERLEAVE**, explicitly accepted by the coordinator before invocation: use the unchanged reviewer's per-row baseline/candidate exports, followed by the existing baseline assertions. This differs from the nine-deck review's all-baselines-first order. Do not claim all21 baseline checks preceded every candidate export. Every one of21 baseline hash/size/part-count checks and every applicable native subdigest passed before overall acceptance.

The exact caller is bare `toPptx(structuredClone(entry.deck))`, options omitted, **no Gallery registration**. Both clean roots carry fixture SHA `d62b991a3772856d812296cf12582be2ede6850e39d644d3414ab39a89a06e27`. They reused the normal pinned Node24.20.0/pnpm10.33.2 builds from the actual nine-deck review. An offline post-run check confirms all four relevant package dist inventories still equal that sealed build provenance; no additional build or source edit was needed.

The one command ran through the maintained machine-wide slot into a fresh external owned output. Actual reviewer/header/helper hashes, source tree objects, build logs, invocation/exit receipt and the complete report are retained in the snapshot. No assertion, export order or export option was changed.

## Output retention and exact controls

The maintained21 reviewer saves full PPTXs and raw changed parts only for changed rows. Since all21 were unchanged, it retained **no newly generated PPTX files**. This limitation is recorded, not filled by a second generation or by relabeling historical files as new outputs.

Every actual reported candidate SHA matches its exact existing `after.pptx` control in immutable evidence commit `5e89a184ffc8a38539f5fb5e573f403066bcca17`, under `docs/evidence/rr105-034-archive-review/twenty-one-complete/`. The packet retains exact Git ZIP locators, container/inner SHA values,652 complete control-part inventories and19 embedded XLSX/228 nested-part inventories. The original control bytes stay unchanged and accessible through those immutable blobs.

Actual42 exports completed in the maintained invocation. The new report proves current equality; the referenced archives remain identified as historical controls. The3 native-slide checks compare XML subdigests, not PowerPoint rendering/edit/save behavior.

The generated external proposal SHA `3d9ff329dba6aac7e0f9d4c2c3136277944c97e3e1dd86300634efc270877f24` appends only a new source review-history record. Its21 entry objects, including all old histories and decks, remain exactly identical. It has not replaced the tracked fixture. No observed archive lock requires an update from this review.

## Offline verification

```powershell
node docs/handoff/2026-11-09/rr54-current-archive-review/verify.mjs C:/opf-work/integration-034/packages/pptx/package.json
```

The verifier reads the sealed snapshot and immutable Git controls, checks every retained raw hash, all21 locks/current identities, complete controls/workbooks, native XML digests, unchanged entry histories and the maintained caller/tool/source identities. It invokes no exporter, build, Office or service and writes no file. The dependency path supplies unchanged fflate0.8.3; Git access under C:/opf-work needs the established elevated sandbox context.

The full280-file suite and original combined gate were not rerun. Root owns independent review/publication and any final generated promotion/strict acceptance; this packet performs no push, CI dispatch, provider mutation or release.
