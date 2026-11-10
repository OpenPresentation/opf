# B07: actual fixed-character-bounds observation

**Diagnostic only. NEVER MERGE this evidence branch. No glyph fix, current-package acceptance, native acceptance, or physical-font/bidi cause is established.**

Root executed one supervised native run on 2026-11-10, 09:37:13.503–09:37:27.266 UTC, exit 0. This packet preserves that completed run; assembling it performed no Office, export, generation, rendering, cleanup, retry, or validation launch.

The original historical 09 input is unchanged: 101,027 bytes, SHA256 `4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2`, from producer `473d3fff623bda3f191ae2669824f1b02a5d90f8`. The actual worker/adapter source is frozen `496cac197b1c57c03b4529065f91bb205dc0bf2f`; the controller is unchanged `ce92ccc65d8cb40cc6532b2d9082e12202d6c283`. Driver, worker, and controller roots remain separately identified. The suite SHA256 is `5f5e3fe7d6b13e9bb4d407176bd47db49d441474d9448e8776cc2e5011dd3fa1`. Source preparation's earlier `nativeAuthorized:false` describes preparation scope; the root native launch receipt separately records the actual authorized activation.

The root run used one slide, three shapes, zero actions, a 45-second cap, and ten fixed ASCII character samples in each original/edited/read-only-reopened phase. “Edited” is the maintained phase name; its action list is empty. All 30 bounds and exact source characters are in [character-bounds.csv](character-bounds.csv) and [observations.json](observations.json).

| Sample | Position (1-based) | BoundLeft, points |
| --- | ---: | ---: |
| First line I | 1 | 74.30000305175781 |
| First line t | 2 | 81.55000305175781 |
| First line e | 3 | 90.4150390625 |
| First line m | 4 | 105.04000091552734 |
| First line 1 | 6 | 861.9099731445312 |
| First line C | 9 | 829.155029296875 |
| Continuation a | 1 | 74.27511596679688 |
| Continuation r | 2 | 89.02511596679688 |
| Continuation o | 3 | 97.8951187133789 |
| Continuation u | 4 | 113.1451187133789 |

These values are exactly equal across all three phases. Positions increase through “Item”; the later C is left of the digit 1. The continuation samples increase normally. This observes nonmonotonic placement through the character-range API; it does not establish the physical font, ink, clipping, shaping/bidi cause, or a fix. No tolerance or monotonicity acceptance rule was introduced. Nine LanguageID observations are 1025; paragraph directions are 2/1/1 in each phase.

All three real native PNGs are byte-identical, 10,442 bytes each, SHA256 `add5221afa2afa4d7193acc77d03d0dc77ed047b5c7806ad9f3a0edb60c6c3ba`. Root and this agent independently viewed the original: “Item” is normal, later Latin text remains reversed, and the continuation is normal. [Original](native-png/original.png), [edited](native-png/edited.png), [reopened](native-png/reopened.png). These direct images are actual native output. Synthetic harness files are separately labeled archive members and provide no glyph/native acceptance.

The native supervisor reports exit 0, timeout false, cleanup confirmed. Actual global process queries report zero immediately before and immediately after; no launcher cleanup or automatic retry occurred. This bounded lifecycle success is not feature acceptance.

## Saved XML and complete archive comparison

The actual saved/reopened archive is 104,205 bytes, SHA256 `638f02597edde0abfab3c1838c376002fe762a4eab21881259b0249b9ff95dd3`. Original and saved archives each contain 147 parts. PowerPoint replaced 44 descriptive tag part names with 44 `tagN.xml` names. Among common names, 101 parts changed bytes and 98 changed XML structure. Complete ordered inventories, every part hash, and every XML difference are retained in [archive-comparison.json](archive-comparison.json.gz), including metadata, relationship, notes, master and layout changes. No differences are filtered as acceptance exceptions.

Slide 1 has three structural differences: removal of root `mc:Ignorable="a14"`, and two tag relationship ID changes. Both entire body shapes are semantically unchanged. All three shapes retain complete text, rPr, pPr, bodyPr, endParaRPr, and transforms. The verifier compares namespace-expanded element names, all non-namespace attributes, ordered children and text; this is a structural comparison, not a full XSD-conformance claim. No font binaries were found in either archive. No current-consumer import was run or claimed.

## Retained attempts and verification

- Validate01 exited 1 before native launch because inherited PowerShell environment could not resolve `Get-FileHash`. Its exact stderr/exit remain in the archive.
- Validate02 exited 0 for the pure harness/process checks, without `-CaptureTextFonts`; that narrower scope is not promoted.
- Validate03 exited 0 with `-CaptureTextFonts -ValidateOnly`, using the maintained Windows PowerShell environment helper. It performed no Office activation.
- Native01 is the single actual run described above. All outputs, harness plans/fault artifacts, runner reports, source scripts, root launchers, logs, preflights, process queries and suite files are retained losslessly.
- Evidence inspection had three read-only setup refusals (UTF-8 BOM parsing, an incorrect optional report-field lookup, unavailable WindowsApps Python alias). These have no external stdout file; they are explicitly recorded as observations rather than invented logs. No Python code or Office call ran.

Run only the offline verifier:

```sh
node docs/handoff/2026-11-10/b07-character-bounds-native/verify.mjs
```

It executes no archived code, product modules, Office or external process. It checks the gzip/member manifest, source and input pins, every suite member, all attempt scopes, process/lifecycle receipts, 30 exact grouped bounds, nine languages/directions, three raw PNGs, full ZIP/XML differences and unchanged body properties. Qualification is scoped to evidence integrity. The initial source-preparation precision failure and its corrected managed proof remain unchanged on the earlier branch; this packet neither rewrites nor reclassifies them.

The packet contains 453 raw records / 2,687,587 decoded bytes, including 372 synthetic harness members and 26 root receipt/setup members. The compressed raw archive is 907,102 bytes. [receipt.json](receipt.json) pins the full member list. All captured files were rehashed afterward and remain unchanged; see [protected-inputs.json](qualification/protected-inputs.json). This evidence branch has no product changes and must never be merged.

Published storage: the derived 8,701,700-byte complete XML comparison is losslessly gzip-compressed; its original bytes and SHA256 are unchanged and independently checked. The original local review commit `3c5c2f59cfc00a6995f814ff8e4ba2eaccc6a7d2` remains frozen. This separate fresh-main evidence leaf preserves all 453 raw records and three PNGs byte-for-byte.

Normal change check (Node24.20.0/pnpm10.33.2, pinned offline install): **4 PASS / 1 RED / 1 SKIP**, 30.7s. Its sole failure was the declared sparse painting fixture missing; the original exit1/log remain unchanged. The exact HEAD/index/OID/SHA-bound 16,102-byte blob was restored without overwrite, then only `pnpm check:text` reran: **6/6 PASS**, all6,780 scanned files valid. No full mapper repeat, package suite expansion, source assertion, generated tracker, or golden change occurred. [normal-check.json](normal-check.json) pins all seven actual install/gate/restore/focused logs and receipts; the offline verifier checks them.
