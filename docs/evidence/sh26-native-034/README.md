# Actual SH-26 native observations — 2026-11-08

Evidence-only branch: NEVER MERGE. This package contains no product change and
makes no native acceptance or release claim. Native acceptance remains false.
The coordinator ran Office; this lane only copied and verified immutable bytes.

## Source and worker identities

- Frozen source PR: https://github.com/OpenPresentation/opf/pull/1207 at
  87126af094474c1263aedee3317d563bde5fa58d; export producer 975ced9f2.
- Original five-archive manifest SHA256:68f5368958f5292cb4ad281a0e5605a56d19598142fa45d9a29857e88a183bcc.
- Thirteen bounded CLI derivative manifest SHA256:667670ef816ba6952d9a12a06464783339e94f0ec28e9166fe08a5277365d610.
- Actual suite02 SHA256:1f87dd96814a7c9582d77a28cde3471f30e5868817665b5cb0128cfd12958ce3.
- Runner/worker repository: ce92ccc65d8cb40cc6532b2d9082e12202d6c283.
  Exact five bound code files and the producer/launcher/preflight/reviewer/analyzer
  bytes are preserved, with their recorded hashes verified before packaging.
- Canonical importer repository: df4dd288c8894d2485c84f690e939e12b6fcc6bf.

## Observed result and acceptance hold

All thirteen cases/thirty slides completed their owned lifecycle with cleanup.
Actions were empty: original observations, SaveCopyAs, then read-only reopen.
All thirteen canonical input/saved import comparisons and named geometry/text/
font phase states are exact; no shrink tags were found. These facts do not
establish correct visual reading order or arbitrary native editing fidelity.

The coordinator viewed all thirty native pairs and held visual acceptance for
reversed Latin text in the RTL-deck numbered control on four pages:

- supplemental-controls-4-6, native page 3 (primary supplemental page 6).
- supplemental-controls-7-9, native pages 1–3 (primary supplemental pages 7–9).

No source fix, rerun, acceptance, or product fold is included here. A separate
causal investigation is in progress. Raw previews, Office images, phase states,
saved files and both input/saved imports are all retained.

One other phase image differs: supplemental-controls-4-6/page1, the bold English
heading second line. Original→edited changes 2,291 pixels inside x 132–587 / y 389–420;
edited→reopened changes 0 pixels. Root viewed both complete phases and observed
the same text/order/box, named fonts and canonical imports, with no shrink.
This is recorded as a bounded glyph/kerning variant, not a pixel-exact phase
claim. All original phase PNGs and the raw analyzer result remain unchanged.

Aptos and Aptos Display were not GDI-enumerated. Named font properties are not
an exact glyph-file or font-binary proof. The ar-SA fixture contains Latin
paragraphs only; it does not qualify Arabic glyphs or RTL-paragraph rendering.

## Packet contents and raw byte preservation

The eighteen bounded gzip packets use byte-preserving JSON/base64 entries with
path, raw byte length, SHA256 and base64 data. Decompress with gzip, decode each
entry's base64 and verify its declared bytes/hash. Packaging round-tripped every
raw entry and compared all source inventories before and after; no source,
producer, output, Office file, image or nested archive byte was changed.
packet-inventory.json lists every entry and packet SHA. source-inventory.json
retains all original absolute locations and raw hashes. hashes.json binds the
prepared packet files. The packaging source is copied under tools/ for review;
it was not installed as a repository tool or executed as an Office worker.

- original-suite-setup-failed01 preserves the first failed producer's partial
  forty-file suite. The exact failed producer is in producer-worker-raw.
  No standalone setup error log was present in the bounded sh26 artifact list;
  no failure text was fabricated. The actual batch log is retained separately.
- actual-suite02 retains the exact thirteen inputs, sources, previews, empty
  actions, page map, suite manifest and producer manifest.
- Thirteen per-case native packets retain every owned input copy, harness,
  journal/stage event, original/edited/reopened PNG, saved PPTX, raw named-state
  report, process/supervisor receipt and log.
- native-root-receipts retains all preflights and completed-case receipt.
- review-raw retains the untouched reviewer output, thirteen canonical import
  gzip files, phase analysis and ten preview/native comparison sheets.
- producer-worker-raw retains the exact setup/runner/reviewer/analyzer code and
  logs. Comparison sheets and original review/suite/phase JSON are also exposed
  directly for inspection; raw records still say nativeAcceptance:false.

The coordinator authorized publication of this held/failed evidence snapshot.
Native acceptance remains false, with the four-page reading-order defect and
bounded phase variant preserved exactly. This evidence-only branch is durable
and must NEVER MERGE. The packaging lane ran no Office and changed no product,
worker, producer or raw output.

## Sanitized E2 notice receipt

The layout-study artifact now has the saved dated superseded notice as its first
paragraph, with three current GitHub guide links. The private screenshot was
viewed for verification and remains private; only notice text, its screenshot
hash and root-observed link/privacy facts are included in e2-layout-study.json.
The original historical body remains below the notice. The developer-walkthrough
artifact is still owed.
