# Exact PowerPoint Save regression fixture

These three public synthetic slides come from the reviewed 08976a2f12544d92f1135d9fe827c39b438373ee producer and genuine installed consumer0663f619edf784067ecd8152704d2400507cf507efeb27ae20bea38e8ca49ff8. `original.pptx` is its actual generated native-lines witness. `saved.pptx` is the actual PowerPoint SaveCopyAs result of the closed, windowless read-only root observation `n034-cmap-ref-native-lines01`; no edits were requested. `source.opf.json` is the unchanged public source. No private deck, external resource or font binary is part of this fixture.

The saved file preserves chart-space and per-series OPF ownership records. PowerPoint inserts `showPercent=1` and `showBubbleSize=1` on the explicit native line helper labels. The old importer incorrectly rejected these inapplicable flags and returned both helpers as ordinary data. Actual original/saved-reopened PNGs were identical; this fixture supports that narrow importer regression, not broad native/release acceptance. All seven findings in the original observation remain preserved separately.

The test pins every fixture SHA256 and checks actual public direct/saved imports. Adversarial and current-data/style/label controls change XML only in memory; they are explicitly synthetic edits, not a PowerPoint Edit Data observation. Identification records are never rewritten to make those controls pass. Missing/invalid/duplicated identities and visible labels, manual positions, leaders, nonconstant data, markers or unsupported strokes remain conservative.

- Original128805bytes:77305632e835d3fbf4e5348ec29eaddf916f0894896ac06988e431e7f575f748
- Saved134053bytes:850f10044211acaed135951c6730a5a63e178091f2cd5389833b837273aa56c0
- SourceSHA256:87a3a6c20edcc4cb05d821019f3abc2b9bbaa5b0a73911853563665ae7b5a02e

Microsoft documents the custom-label text precedence in [MS-OI29500 dLbl](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/f4264e4b-7a40-405d-a32c-e804b2fcaac3) and percentage label types in [PowerPoint Series.ApplyDataLabels](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.series.applydatalabels). The fix remains deliberately narrower: only percent/bubble flags on verified native line helpers are treated as inapplicable. Other visible auto-label checks remain strict.