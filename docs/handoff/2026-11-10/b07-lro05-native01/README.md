# Original05 LRO/PDF native diagnostic — rejected hypothesis

Evidence only; NEVERMERGE. Root performed exactly one native attempt on frozen source **1f5bbb21aefbb110420ab30459d0eafb64c3a49a**, 2026-11-10 16:30:40.949–16:30:54.152 UTC. This evidence checkout starts at main a52dc9441f7eec9dc6f72debb174339758e1761e. No product source, physical font binary or private deck is included or changed. The archival agent invoked no Office, process query, export, constructor, test suite, build, retry or second variant.

The hypothesis is **rejected**. Original and saved-reopened native PNGs are byte-identical to the known nonblank CS-only and LRE controls: 3,824 bytes, SHA256 f53426f165ad6ce7da516adfd49ae51afe69808534decc6f14c782d4050f84ea. Root physically viewed the actual native image and still observed `1Bonjour`, rather than authored `Bonjour 1`. No missing-text or blank-image conclusion is warranted. The core image is retained as a separate reference, not a native acceptance oracle.

This diagnostic deliberately changes one native formatting codepoint relative to LRE: U+202A becomes U+202D (LRO); the same closing U+202C remains. Only the positively ASCII `Bonjour 1` span is bounded. The 147-part input keeps146 complete local ZIP records exact; all rich-run properties, ar-SA primary proofing, sizes, frame geometry, theme and Arabic characters are unchanged. Original semantic OPF remains unchanged. Current modified native input has18UTF16 units and passes strict current-input checks; original16-unit native equality is **false**. This is not Unicode normalization, a product text-contract change, import-removal support or public adoption of inserted controls.

Actual envelope SHA256 is **556bc89623c05629c3ad2f03978af966d1c793d3494c761abdac513c20965ab3**. The79bbb5… envelope belongs only to the prior LRE attempt. Both identities are retained separately; raw files are untouched.

Root wrapper/worker/supervisor exited0, timedOut false. All93 recorded strict probes matched; two read-only opens, two closes, one SaveCopyAs and one owned Quit were reported. Native original and saved-reopened states match for both shapes, including UTF16, primary LanguageID1025, requested fonts/sizes and geometry. The observed postflight started with global PID49496 and reached empty after17 samples. Its ownership is not inferred. Before and immediate-after global snapshots are empty; no attach, kill or cleanup retry occurred. These lifecycle observations do not establish correct word order, physical font selection or overall B07/native acceptance.

The lossless archive retains all named actual root launchers/terminals/stdout/stderr/flights, admission/default-pure/native outputs, complete input and saved PPTX, controller/source-preparation bytes and original pure/failure receipts. Synthetic managed source is labelled by its controller/source-preparation path; it is never represented as native observation. Only public synthetic qualification material is archived; no system executable, font binary, credentials or unrelated local files.

Read-only builtin replay (does not execute any archived launcher/constructor/PowerShell):

```powershell
node docs/handoff/2026-11-10/b07-lro05-native01/verify.mjs
```

`--verify-originals` additionally compares every archived record with its still-retained source file. The assertion-only `assertDelta` helper comes byte-for-byte from reviewed1f5; replay never calls its constructor. Direct PNGs under `images/` are available for independent visual review. No metadata gate has been run for this new packet; root owns allocation, review and publication.