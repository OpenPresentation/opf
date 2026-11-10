# Historical0897 reference-lines native observation

This is a public-safe, evidence-only NEVERMERGE branch. It preserves the root coordinator's one original reference-native-lines open/save/reopen run on source0897 and consumer0663. It does not run Office, conversion, rendering, generation or an importer again. The captured inputs are repository-authored synthetic controls; no system executables, font binaries, credentials or installed consumer payload are copied.

## Result and scope

The actual worker exited0 with two read-only opens (literal COM ReadOnly=-1), two closes, one SaveCopyAs, one Quit and zero edit actions. All163 captured probes matched. The supervisor recorded cleanupConfirmed:true, timedOut:false and one global-zero postflight sample. Query elapsed22.6807ms; final elapsed48.201ms within the unchanged5000ms budget. All three original/reopened PNG pairs are whole-byte identical (three unique native images, six raw PNGs).

The root coordinator individually viewed the three unique native images and source previews. Its narrow visual judgment: the negative Floor / Jan gutter is fixed; authored dash/dot and labels appear as intended; the unlabeled 55 line remains; title Target 92% / prose Threshold 30 on the no-reference control creates no reference lines. This packet attributes that judgment to root. It does not provide independent agent visual approval, authored native edits, EditData, glyph fidelity, universal SVG/native parity, registry or release acceptance.

**All seven original findings remain, and overall native/import acceptance remains false.** Three exposed-cache/workbook-change observations, authored-data mismatch on slide1, reference-count mismatch on slide1, saved-document difference and saved-import-diagnostic difference are retained verbatim in raw.json.gz. Original import reference counts are[2,1,0]; saved-reopened counts are[0,1,0]. Original import has2 diagnostics; saved import has4. In particular, two helper series become ordinary chart data in the old0897 saved import. No later code is run to overwrite or reinterpret this result.

Ownership records are identical decoded JSON values before/after for all three chart observations; chart3 has null ownership before and after. The later separately reviewed importer repair85eb/df37 identifies PowerPoint-added inert showPercent/showBubbleSize flags on the owned line labels. That is distinct from metadata stripping and does not retroactively qualify these old0897 import results. The full original/saved caches, formula/workbook/paint/axis facts and imported documents/diagnostics stay in the historical observation.

## Exact binding

- Producer/controller Git revision:08976a2f12544d92f1135d9fe827c39b438373ee.
- Envelope SHA256:f2631c0f195674f43f1942d63a730d5f5d6927d5f973cb19fe5be740970425ef.
- Installed consumer identity digest:0663f619edf784067ecd8152704d2400507cf507efeb27ae20bea38e8ca49ff8 (a digest, not a Git revision).
- Worker SHA256:642cbe4b9d9a770a30a61bce804b68f87b5f083fca16e4feff2d9246972e2cda.
- Frozen ce92 supervisor bytes SHA256:b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c.
- Original archive:77305632e835d3fbf4e5348ec29eaddf916f0894896ac06988e431e7f575f748 (128805B).
- Saved archive:850f10044211acaed135951c6730a5a63e178091f2cd5389833b837273aa56c0 (134053B).
- Authored source JSON:87a3a6c20edcc4cb05d821019f3abc2b9bbaa5b0a73911853563665ae7b5a02e (2418B).
- Pinned Node24.20.0 identity, actual launch argv,45s worker/90s outer limits, build routes, source inventories and environment descriptors are retained in receipt/raw records.

The [existing consumer proof](https://github.com/OpenPresentation/opf/tree/eb3621c7c9b4b04f542ab3ff917823d9a830e6d6/docs/handoff/2026-11-10/current-consumer-0897) already preserves the53MB prepared consumer payload. This proof references it without duplicating it. The later [saved-file importer fixture and repair](https://github.com/OpenPresentation/opf/tree/df37ef7f1fbe05e46ce2acd80b99bf9c37d5a7c3/docs/handoff/2026-11-10/reference-save-label-flags) remains separate evidence.

## Contents and verification

raw.json.gz is a lossless JSON/base64 envelope containing121 records /8597446 decoded bytes. The first101 records /8563160B preserve: the entire native output root, external launch/log/exit/pre/postflight files, exact original/saved PPTX, all six native PNGs, copied worker/supervisor/empty actions, report/stages/postflight, full observer findings/imports, all three Office-free admission results and shared admission metadata, original generation manifest/source/inspection/previews, and exact historical controller Git blobs. Only reference-native-lines has a real Office run; the other two cases have Office-free admission only. No synthetic native output is invented. Historical source copies are explicitly identified as code rather than results.

The six directly reviewable images below are exact copies of three unique native originals and their source previews; saved-reopened images remain in the raw packet and the verifier proves whole-file equality. No crops, resizes or pixel edits are applied.

| Slide | Source preview | Native original (same bytes after reopen) |
| --- | --- | --- |
| 1 | [preview01](images/preview-01.png) | [native01](images/native-01.png) |
| 2 | [preview02](images/preview-02.png) | [native02](images/native-02.png) |
| 3 | [preview03](images/preview-03.png) | [native03](images/native-03.png) |

Run from this evidence checkout with Node24:

~~~powershell
node docs/handoff/2026-11-10/reference-native-lines-0897/verify.mjs
~~~

Optional --check-originals also compares every captured external file with its unchanged original location. Default verification is portable and offline: gzip/base64 identity, all121 hashes/sizes, six direct-image hashes, source/producer/controller/consumer/worker/supervisor/input bindings, all three whole-raster pairs, lifecycle/probes/postflight, seven findings, literal old-import counts and all seven protected source object identities. It performs no Office or package operations. receipt.json documents the read-only capture/verifier setup corrections; no raw bytes were normalized. Normal metadata gate receipts are included as the remaining20 records.

## Actual local metadata qualification

Pinned offline install passed. A preliminary explicit Biome invocation returned1 because the maintained configuration ignores these handoff files (0 processed, no fixes); it is retained as setup evidence. The normal unchanged check:changed --base08976a2f12544d92f1135d9fe827c39b438373ee then ran once: build/Biome/check:changes/check:skill-commands PASS; check:text RED solely because its tracked painting-Linux.json.gz fixture was absent; TypeScript skipped. Original aggregate exit1 and32.1s table remain literal.

Only that absent exactHEAD fixture was restored with path containment, OID/SHA, exclusive write and unchanged-index guards. Then only the failed check:text command ran once:7/7 tests PASS and9464-file text scan valid. No passing metadata check, build, full mapper, package suite, product conversion or Office run was repeated. The separate recovery does not relabel the original aggregate as green. receipt.json binds every raw check/step log, command and exit.
