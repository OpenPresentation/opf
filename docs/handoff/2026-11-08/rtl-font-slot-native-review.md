# Actual font-slot contrasts and rejected LtrRun oracle — 2026-11-08

**Evidence only. NEVERMERGE. No native acceptance, engine fix or release is claimed.** This packet records the three actual font-slot contrasts and, separately, the single terminally failed LtrRun oracle. All source inputs, native outputs, original/SaveCopy/reopen PNGs that actually exist, named native states, wrappers, logs, strict import differences and raw archive bytes are retained losslessly.

## Three font-slot contrasts

The immutable suite is SHA-256 `c8c993f13e86f271f01488bf87f5c41e6433dfd9ed2baa7e54d3c58f7698b3df`. Source-only evidence is `e021d28ff0658e4df077744167c28be913ed169b`. Actual root wrapper `run-rtl-font-slots-native-01.ps1` completed all three cases once, with exit 0 and confirmed owned cleanup. Each contains one slide and three shapes. This lifecycle success does not establish visual correctness.

The coordinator and independent evidence reviewer inspected each actual original at its native 1280×720 resolution:

| Case | Actual visible result | Decision |
| --- | --- | --- |
| `font-slot-arabic-control` | Latin letters on the first body line remain reversed. Arabic title is visible. | Original09 control retains the demonstrated failure. |
| `font-slot-arabic-cs-aptos` | Latin letters remain reversed and the Arabic title is visibly absent. | Rejected hypothesis; no causal glyph-file claim. |
| `font-slot-french-cs-arabic` | Latin body remains readable and Arabic title is visible. | Readable contrast; it does not repair the Arabic-proofed failure. |

The [full-size comparison sheet](rtl-font-slot-native-review/font-slot-comparison.png) pairs each sealed CLI preview with its actual PowerPoint original. The raw native ZIP retains every original, edited/SaveCopy and reopened PNG. All three phase PNGs are byte-identical within each case. All named text, whole-range font descriptors, geometry, shape counts and native states are exact across those phases. The descriptors report Aptos Display 40.5pt on titles and Aptos 27.75pt on bodies; they do not identify selected character-level CS faces or glyph files. The absent Aptos-contrast title remains present in API text and imports, so matching metadata is not visual acceptance. No shrink/autofit marker was found.

The offline review preserves both importers:

| Importer | Strict original/saved import result |
| --- | --- |
| Frozen q473 `473d3fff623bda3f191ae2669824f1b02a5d90f8` | Exit 1. Arabic control/Aptos are exact. French SaveCopy has two exact retained differences: deck language `ar-SA` becomes `fr-FR`; scalar Arabic title becomes a rich title carrying `lang: ar-SA`. |
| Corrected ownership `9e36a7bbd3a663e8b669115cf4e7397f42037e9b` | Exit 0. All three full authored documents are exact on original and SaveCopy import, without normalization. Its functional package source is unchanged from `3e03bd13d693d91f194769d8d6878adbc27f4146`. |

The q473 French failure is the known Office-renamed provenance ownership defect. It is preserved as a failure, separately from the rejected font hypothesis. Unsupported-body-font and mixed-run-language diagnostics remain in the review; the corrected importer removes the old ownership-derived metadata-reference/RTL-language diagnostics, without changing native glyphs.

A separate XML/phase review passes 88 binding assertions. All nine text shapes retain exact logical codepoints, declared proofing/alternate proofing and RTL fields per codepoint, declared Latin/CS/size properties, XML transforms, paragraph/body properties and theme font schemes from original to SaveCopy. No Unicode normalization or mismatches were waived. Office rewrites archive serialization: each case has 189 changed/added/deleted part entries, with before/after hashes recorded. Whole original and saved PPTX files preserve all part bytes. This is semantic field preservation, not a claim that every XML byte is unchanged or that a named font rendered correctly.

The two existing reviewers are preserved unchanged. A separate adaptation changes only the corrected reviewer's exact expected HEAD from 3e03 to 9e36. Frozen exporter/importer runtimes were verified before and after reviews and again after sealing: q473's 604 historical reference files match; the broader current snapshots verify 611 q473 and 612 corrected published-runtime/vendor/package files, with clean source trees and no rebuild, install or writes to either producer.

## Separate rejected LtrRun native oracle

The single suite is SHA-256 `a5955832565b687b1293ae028740da803dd37e53070427d5acc6b6133a17c75c`, source `d7ba4e11cc1a7369e63c20924593e5dbefba5357`; prior source/preflight evidence is NEVERMERGE `320ade45044bd5ef887c4670a0ea330dd44e8974`. Exact original09 archive is `4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2`. Root wrapper SHA-256 is `fd8192c1c63f61a62d661685e327d2192b291fc2ca5cc3bbb4562c6785e2ee51`. Its executed log and `.log.exit.json` are retained.

The separate 28-assertion offline review confirms one `PowerPoint.TextFrame.TextRange.LtrRun` call was attempted and returned successfully. Ordinal UTF16, reported whole-range font and shape geometry are exact. Observed primary LanguageID changes **1025 (ar-SA) → 1033 (en-US)**. The proofing guard therefore rejects it: `completed: false`, `worker.failure`, exit 1, `officeOperationsStopped: true`, **`cleanupConfirmed: false`**. There was no retry.

Only the original phase exists. Edited/reopened states are null; no edited/reopened PNG or SaveCopy PPTX exists. There is no after-render, saved-XML or glyph-fix finding. The coordinator's later read-only global observation of zero POWERPNT processes is retained as coordinator-reported context, not reconstructed evidence of owned cleanup. The entire terminal-failure native tree is retained separately from the font3 component.

## Exact payload and sensitivity review

The [payload inventory](rtl-font-slot-native-review/payload-inventory.json) binds nine honest gzip transports of exact ZIP components and every contained file. The original components retain 719 declared files, including all 445 font-native and 144 Ltr failure files, the source exports/suites, wrappers, logs, machine reviews, original reviewers and bounded review producers. Every ZIP was unpacked and compared by file count, byte length and SHA-256 before this review packet was prepared.

The [corrected credential scan](rtl-font-slot-native-review/credential-scan.json) inspects every payload plus decoded ZIP/PPTX/GZIP members: 6,013 nested members, 31,243,478 scanned bytes, zero matches for the nine declared credential patterns. This is a bounded pattern scan, not an assertion that arbitrary credentials are impossible. The first local scan omitted decoding gzip import bundles despite its scope text; the complete first packet and log are retained in the exact ZIP preserved by `initial-seal-retained.zip.gz`, and the corrected scan actually decodes those bundles.

The exact payload comprises synthetic authored slide text, source/export XML and OPF, PNGs, fake-harness controls, lifecycle diagnostics, local file paths/usernames, process IDs/timestamps, and Windows/Office versions. There are no browser/auth/network captures or environment-secret snapshots. Actual Office SaveCopy metadata in the three saved PPTX files names `Michael Grimm` as `lastModifiedBy`; originals name `OpenPresentation`. This metadata and local paths remain unredacted for lossless evidence and are explicitly identified for coordinator review before publication.

[Publication manifest](rtl-font-slot-native-review/publication-manifest.json) binds the outer files. Run the [blob verifier](rtl-font-slot-native-review/verify-packet.mjs) locally and against the final commit before push; it compares raw Git blobs and every gzip transport, exact inner ZIP and sealed file against the declared sizes/hashes. The isolated branch is `codex/evidence-rr105-font-native-review`, fresh main base `9545016583ccfa151077cda4d51043ac6505a140`. No producer, engine, schema, fixture, golden, tolerance, package or release changes belong to it. No publication is authorized by this document itself.

## Reversible transport decision and mandatory gate

The first mapped check passed install/build/Biome/changes/skill-commands but failed on the exact missing sparse compressed-text fixture. After that fixture was restored, all six text-integrity controls passed; the scanner then interpreted the eight binary ZIPs as UTF8 and reported 167 mojibake signatures. Both red logs and the full second text-check result are sealed with the original outer/payload manifests and assessment/verifier bytes. The reviewed exact-HEAD hydration helper then restored all 4,096 remaining bounded tracked text prerequisites (109,217,710 bytes), with its Git-blob receipt retained.

The coordinator approved an explicit reversible transport decision: wrap each already accepted ZIP honestly as `.zip.gz`, using the existing signature-based gzip-archive recognition. Every inner ZIP/file byte/hash remains unchanged; the verifier gunzips and verifies both layers. No scanner, test, configuration, tolerance or content was changed. `verification-receipts.zip.gz` adds twelve bounded verification files; its eleven input files were checked with the same credential patterns and had zero matches. The [transport receipt](rtl-font-slot-native-review/transport-receipt.json) records the decision, retained original hashes and supplemental scan. The required mapped check is rerun once after this complete hydration and transport correction; its terminal result accompanies the published head.
