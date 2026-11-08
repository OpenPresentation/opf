# Mixed slide/run language native witness

Producer/consumer: [LH-106 #1141](https://github.com/OpenPresentation/opf/pull/1141), exact commit dde3809913e9d2e38d9c199f67ece8741426067e. The [source deck](mixed-language.opf.json) has Arabic text explicitly tagged ar-SA on an English slide and English text explicitly tagged en-US on an Arabic slide. The Arabic slide selects the existing noto-sans-arabic catalog record; its concrete major/minor face is Noto Naskh Arabic.

The [hash manifest](suite/manifest.json) pins both source/dist consumer files and every produced input/preview. [English preview](suite/preview-1.png), [Arabic preview](suite/preview-2.png). The [measured input](suite/measured.pptx) and [native-mode input](suite/native.pptx) intentionally have identical hashes: mixed RTL text is outside native-paragraph support and the requested native mode reports two [measured fallbacks](suite/export-diagnostics.json). These witnesses qualify slide/run language through editable measured text, not native RTL paragraphs.

Original-input semantic controls pass for both requested modes ([measured](suite/source-measured-control.json), [native](suite/source-native-control.json)); [a changed-proofing-language negative control](suite/tamper-control.json) rejects. No native PowerPoint pass is claimed yet. The coordinator must open a fresh copy read-only, SaveCopyAs to a new file under the binding COM ownership rules, and run the verifier on that saved copy. It checks current XML and imported run languages plus the slide's own language, and catches removal/change of the evidence needed to retain the explicit override. Words are checked across measured fragments; neutral punctuation can be a separate RTL fragment, while the full imported source run is still required.

Commands from repository root (Node 24):

`node docs/evidence/rr-105-mixed-language-native/generate.mjs --consumer C:/opf-work/lh-106-slide-language --out C:/opf-work/<fresh-suite>`

`node docs/evidence/rr-105-mixed-language-native/verify.mjs --consumer C:/opf-work/lh-106-slide-language --suite C:/opf-work/lh-106-mixed-native-20261108c --saved C:/opf-work/<fresh-office-save>.pptx --route measured --out C:/opf-work/<fresh-result>.json`

Use route native for the second requested-mode input. The generator refuses a dirty or moved consumer and an existing output directory. The verifier checks consumer and original artifact hashes before reading the saved copy, refuses to overwrite its result and makes no Office calls. Actual Office use is attested by the coordinator; a passing saved-file parser alone is not native evidence.
