# Package audit and phantom slide-master correction

The five-line exporter correction removes content-type overrides for nonexistent
generated slide masters. A two-slide deck previously declared
`/ppt/slideMasters/slideMaster2.xml` without creating that part. The retained
`logs/smoke-before.log` shows the new regression assertion failing before the
fix. The full source suite now passes, including all 126 decks / 805 slides and
the new override-target checks. No slide, notes, media, provenance, relationship,
layout or font bytes change in the 21-case before/after comparison; only the
two-slide case's `[Content_Types].xml` changes.

This is a source/installed candidate, **not a native Office acceptance or a
published release**. `fingerprint.json` identifies the exact runtime/verifier
files and coordinated source heads. Node 24.21.0, .NET SDK 8.0.425/runtime 8.0.31
and Open XML SDK 3.5.1 were used. The .NET archive's SHA-512 was checked against
Microsoft's official release metadata; the archive and installed SDK are not
included or added to product dependencies.

## Separate unresolved schema discrepancy

All 21 original exports still receive one SDK schema error under each of Office
2007, Office 2019 and Microsoft 365: `notesMasterIdLst` follows `sldIdLst`.
The `reordered` diagnostic copies pass those SDK targets with zero errors.
Each diagnostic pair differs only in the order of those two elements in
`ppt/presentation.xml`, with byte-identical other parts and equal current semantic
reimports. The cases cover measured/estimated furniture, two canvas shapes and
floors, local/inherited fields, empty/disabled furniture, simple text/image and
two slides with speaker notes.

The pinned upstream `makeXmlPresentation` contains explicit warnings about
PowerPoint behavior with the schema order. A temporary local runtime experiment
was reversed after recording the result; the committed runtime retains its
original notes-master order. Do not promote the diagnostic reorder or discard
notes based on SDK success. Native opening/save/reopen remains untested, and
this finding does not explain the earlier Office refusal or hung native-created
picture control. The Windows owner must first complete the existing user-reviewed
Office recovery. No COM call, Office process action, font substitution or relaxed
tolerance was used in this audit.

## Evidence and reproduction

- `before`: original 21-case reports and manifest. Twenty pairs are byte-identical
  to `after`; only the two-slide original/reordered fixtures are stored again.
- `after`: all 21 OPF inputs and original/reordered PPTX pairs with SDK and
  relationship/content-type reports. Both relationship reports have zero errors.
- `installed`: independent fresh installed-package reports and hashes. All 21
  original/reordered bytes and semantic import hashes match `after` exactly, so
  those duplicate binaries are shared with `after`.
- `negative-control`: one deliberately missing image plus duplicated relationship;
  the probe returns nonzero and identifies all three expected error categories.
- `master-fix-comparison.json`: exact before/after changed-part inventory.
- `logs`: initial assertion failure and passing source/type/packed checks. The
  first fresh install was stopped after sandbox DNS failures; the subsequent
  authorized network run passed. An initial comparison against the previous
  consumer also found the stale package; its manifest is retained separately.
- `generator-failed-date.mjs`: initial diagnostic ZIP generation failed because
  UTC midnight on January 1, 1980 becomes 1979 in the local timezone. The current
  generator uses local January 1, 1980 for ZIP timestamps. No product timestamp
  behavior changed. `generator-before.mjs` records the original 21-case generator.

Reproduce new inputs and run the independent tools using
[`test/openxml/README.md`](../../../test/openxml/README.md). The SDK command for
`original` must still return nonzero. A successful evidence verifier below
confirms this discrepancy is reproduced; it does not turn it into acceptance:

```sh
node docs/evidence/mac-openxml-audit-20260914/verify.mjs
```

References: [Microsoft OpenXmlValidator](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator?view=openxml-3.0.1),
[Presentation children](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.presentation?view=openxml-3.0.1),
and [the upstream phantom-master report](https://github.com/gitbrent/PptxGenJS/issues/1449).
The upstream report is corroborating context; the local failing fixture and
vendor implementation establish this candidate's defect.
