# Script reference measurement (opf#1399, 2026-11-24)

This report was written by `packages/render/scripts/measure-script-references.mjs` on a licensed Windows host. The tool reads the installed originals in place from `C:\Windows\Fonts` and never copies them. It replaces `script-corpora-20261001/references.json` as the tracker's `scriptCorpus.references`; that run's qualification and corpus files stay as they are.

**What is new.** Leelawadee UI, the Thai and Khmer default since 0.35, is now measured under its own name on the Thai corpus samples, regular (`LeelawUI.ttf`) and bold (`LeelaUIb.ttf`), against its replacement Noto Sans Thai:

| Weight | Samples | Mean width delta | Max |
| --- | --- | --- | --- |
| Regular | 7 | +2.8% | 5.4% |
| Bold | 7 | −4.3% | 7.9% |

**Why Khmer is not measured.** The tool measures each family against the one replacement in its policy row, which for Leelawadee UI is Noto Sans Thai. Noto Sans Thai has no Khmer glyphs, so a Khmer row would compare against a face that cannot draw the samples. A Khmer measurement needs the tool to choose the replacement per script (Noto Sans Khmer for Khmer). That is a separate change.

**Why 24 other families changed.** This computer has more of the originals installed than the host of 2026-10-01: 51 family-and-script entries are measured now, against 25 then (Sylfaen counts twice, for Armenian and Georgian). The 24 other families that gained measured originals, among them Mangal, Latha, DaunPenh and Khmer UI, are measurements of fonts that were not installed before. No family's tracker status changes.
