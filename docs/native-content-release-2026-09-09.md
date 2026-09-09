# Native content releases — September 9, 2026

Renderer 0.5.1 and PPTX 0.5.2 are published with provenance. Core 0.7.0, editor 0.4.0 and CLI 0.5.0 remain unchanged. The [registry records](evidence/native-content-0.5.2/registry.json) include actual UTC publication timestamps, gitHeads and tarball integrities. Do not republish any of these versions.

- Renderer release: PR #8, reviewed `e2d2a0260e7d83831d70e15bd17d173a1600ef0f`, merge `335ed01b2efbbb872894949f2ac0519e35651474`, trusted publication `34322801526`.
- Renderer verification correction: PR #9, reviewed `12a3aa1dfb5196b3bcebe90d7e4ebb235627b0b4`, merge `d8696224e7a99618701e641ef7573ef394489885`, Node 20/24 CI `34323435532` and Bugbot pass. Initial portrait fixtures used unsupported dimension keys and actually rendered widescreen. Corrected tests use inches and assert actual SVG/browser dimensions. Runtime and version are unchanged. This corrected test source is the immutable renderer verification/CI ref; the npm gitHead remains the earlier publication merge.
- PPTX release: PR #13, reviewed `22418c55b7e4140a7d325770510930f9e81b6b50`, merge `383666b366b8c9b8ed8e7e72934d1d3fd0fb634d`, all four Linux/Windows Node 20/24 CI jobs `34323665995` and renewed Bugbot pass. Trusted publication `34370539691` succeeded; npm processing completed before registry installation.

Fresh full-set registry ecosystem and pinned fidelity suites pass on Windows Node 20 and 24. The 126-deck/805-slide renderer baseline is unchanged. Pinned fixtures now include the corrected wide/portrait quote regression and native content typography/geometry checks. The installed dependency graph has 64 verified registry signatures and 15 attestations. Actual renderer and converter payload files match their Git release blobs byte-for-byte; local Windows candidate tarballs differ from published Linux tarballs because of CRLF versus LF.

## Measured native evidence

PowerPoint 16 opens, rasterizes, edits, saves and reopens all 19 feature slides using actual registry packages. All 24 original/saved/edited deck imports validate on Node 20/24, preserving each native edit. Three native tables, one Office chart and one picture remain native. The [published comparison](evidence/native-content-0.5.2/comparison.json) records registry integrities, controlled local Calibri hashes, substitutions, native shape inventories, edit results and raster differences. Its candidate field is null. All generated inputs and native rasters match the visually inspected candidate; [code/metric](evidence/native-content-0.5.2/contact-2.png) and [quote/timeline/chart](evidence/native-content-0.5.2/contact-3.png) sheets place renderer on the left and PowerPoint on the right.

The [registry long-quote report](evidence/native-content-0.5.2/registry-quotes.json) proves that fresh registry exports are byte-identical to all eight files tested in PowerPoint at actual 1280×720 and 540×960 dimensions. Every fitted body's native `TextRange2` glyph bounds remain above its footer. Eight edits survive save/reopen, and six registry reimports validate while retaining all footers/sources and native edits on Node 20/24. No proprietary font binaries are distributed.

The independent three-slide merged-table regression also passes on the final packed converter: two native tables survive edit/save/reopen/reimport, 36 lower-dash pixels exceed the minimum 15, and the hidden-border check finds zero forbidden pixels. The source PPTX hash remains `5fad86d8cc216ab3e1628bda7c01c7cde72f42ceeb539b7fb61fde7087d2986d`, matching published 0.5.1. These targeted borders supplement the feature matrix.

Metrics, quotes, code and timelines now follow shared fitting and preview geometry more closely. Quote attribution/source is retained, timelines have native editable markers and chart labels are readable. Native chart ticks/plot geometry and general scalar-text wrapping/vertical placement still differ. Schema validity, file editability and average pixel error are separate evidence; broad pixel equivalence, arbitrary Office table geometry, advanced chart/media variants and non-Latin shaping remain unproven.

## Reproduction

Use fresh GitHub checkouts and the versions in `release-plan.json`; no old-machine artifacts are required. Run `pnpm test:registry-ecosystem` and `pnpm test:registry-fidelity` with Node 20 or 24. On Windows with PowerPoint and local Calibri:

```powershell
node scripts/test-native-feature-matrix.mjs artifacts/npm/registry-consumer artifacts/native-feature-052 generate
./scripts/test-native-feature-matrix.ps1 -EvidenceDirectory artifacts/native-feature-052
node scripts/test-native-feature-matrix.mjs artifacts/npm/registry-consumer artifacts/native-feature-052 compare
```

For the quote evidence, check out converter merge `383666b366b8c9b8ed8e7e72934d1d3fd0fb634d`, install/build it, then run its `node test/native-quote.mjs generate`, `./test/native-quote.ps1` and `node test/native-quote.mjs compare`. From core, connect that output to the actual registry implementation:

```powershell
node scripts/test-registry-native-quote.mjs artifacts/npm/registry-consumer <converter-checkout>/artifacts/native-quote
```

This verifies identical registry export bytes, native raster/saved-file hashes, glyph separation, reopened edits and reimports. Native scripts close only presentations they opened and leave PowerPoint and user documents running. Public deployment adoption and browser E2E are separate gates recorded in the handoff.
