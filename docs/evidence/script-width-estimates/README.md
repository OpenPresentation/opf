# Fontless script width estimates (RR-79, opf#566)

The committed FF-44 corpus contains 140 strings across 30 scripts and 391 natural Chromium measurements of pinned regular/bold faces at 100px. This report calibrates the portable estimate against those measurements. It is not an Office/native assessment or a claim that every font or text will fit. Runtime composition still needs no fonts; a host-provided measurement takes precedence.

Reproduce after building core:

```sh
node scripts/report-script-width-estimates.mjs
node scripts/report-script-estimate-geometry.mjs
node --test packages/javascript/test/script-width-estimates.test.mjs
```

`report.json` records source SHA-256 hashes, every measurement and before/after estimate, per-script medians/maxima, and each limiting sample. The source corpus and natural browser advances remain unchanged in `../script-corpora-20261001/`.

The old estimate discarded every combining mark. The new estimate counts spacing marks (`Mc`) outside the protected Latin/CJK scripts, while retaining zero width for nonspacing/enclosing marks (`Mn`/`Me`), ZWJ and variation selectors. For each string split advancing characters into its Unicode Script and shared characters. After counting Mc, solve `(browserWidth / 100 - sharedUnits) / scriptUnits`. To minimize mean absolute **relative** width error across regular and bold cases, take the weighted median of these factors with weight `scriptUnits / browserEm`, then round to the nearest .01. The six factors are Tamil 1.53, Malayalam 1.76, Sinhala 1.44, Myanmar 1.18, Ethiopic 1.13 and Georgian 1.28. Latin/CJK spacing tone/reading marks retain their prior zero advance, selected by Unicode Script property. Other scripts receive only the general Mc correction; shared ASCII/punctuation, Latin and CJK retain the previous rules.

`report.json` also records the rejected maximum-derived alternative. It eliminates corpus underestimates but overexpands Tamil ukaram to twice its measured width and Telugu conjuncts to 2.327 times measured width. Multiple consonants can shape into one conjunct, and vowel signs can have small or large advances. One character multiplier cannot model those clusters. The robust factors improve typical error while retaining explicit residuals; they do **not** bound overflow. Broader script calibration and a dependency-free cluster model are follow-up work, rather than adding factors merely to force zero underestimates. Use host font measurements for precise fit or pagination.

The report includes before/Mc-only/after absolute relative error distributions (mean, median, p90, maximum), estimate-to-browser ranges, regular/bold breakdowns and limiting samples. The tests require a meaningful error reduction for each of the six corrected scripts, exact Latin/CJK preservation, shared-character preservation and host measurement precedence.

The renderer's final HarfBuzz qualification was checked for consistency: 391 strict face/sample cases passed its tolerance; three regular-sample accepted widths changed (Myanmar words/medials and Syriac marks), while browser evidence remained consistent. This calibration uses the committed **natural Chromium** widths, not the obsolete fontkit accepted advances. Fullwidth CJK punctuation residuals are excluded from calibration.

## Output review

`geometry.json` compares title/body composition for every corpus string at 640×360, recording boxes, font sizes and exact lines against the previous estimate. Reproduce with the geometry script above. This is an actual composition review fixture, not a browser/native render.

For corrected scripts, fontless composition may wrap sooner, shrink to fit, or paginate differently. Latin/CJK estimates and measured hosts remain unchanged. Golden changes require the normal visual review workflow; this PR does not promote or rewrite registry golden baselines. The inherited 0.19 breaking/version and gallery 2 registry lock gates remain pending with RR-83.
