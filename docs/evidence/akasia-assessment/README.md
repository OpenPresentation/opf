# Akasia v0.0.2 remains experimental

This assessment reads only openly licensed Akasia fonts and public upstream metric JSON. It does not independently compare proprietary Aptos binaries. No default mapping, shipped font pack or compatibility tier changes.

## Provenance and reproduction

[Upstream](https://codeberg.org/bloudraad/akasia) release `v0.0.2` is commit `18009a0d8cce4417dae9ca1253f57d9f55c033ce`. The [release archive](https://codeberg.org/bloudraad/akasia/releases/download/v0.0.2/Akasia-v0.0.2.zip) matches upstream SHA-256 `ab87e75a4534c21d6d8e44d4299205f4f0863fccd2c6a8bb23049abac3949d7f`. Its twelve static TTFs cover weights 300/400/600/700/800/900, upright and italic. The audit records file/metric-data hashes, physical style linking, embedding flags and features. `OFL.txt` retains notices and reserved font names. No proprietary fonts or outlines are included.

Upstream `data/aptos-*.json` records its own reference versions/hashes. Agreement with that data is not independent Aptos/native verification. Aptos Display/Narrow/Mono are outside this assessment. The data and build scripts are unchanged between the release and upstream `c369ea7d75070f2259ac68adfb3e1c1d9d6e4303`.

With named renderer/PPTX siblings and built coordinated sources:

```sh
node docs/evidence/akasia-assessment/audit-open-fonts.mjs /path/to/Akasia-v0.0.2 /path/to/akasia/data /tmp/akasia-audit.json
node docs/evidence/akasia-assessment/check-offline-browser.mjs /path/to/Akasia-v0.0.2 /tmp/akasia-audit.json /tmp/akasia-browser
node docs/evidence/akasia-assessment/inspect-normalization.mjs /path/to/Akasia-v0.0.2/Akasia-BlackItalic.ttf /tmp/akasia-normalization.json
```

The browser command intentionally exits nonzero for the retained counterexample after writing results/screenshots. It blocks external requests and loads exact supplied bytes.

## Findings and limits

Both Node 20.20.2 and 24.21.0 agree on 12,864 supported-codepoint advances, 195,653 supported kerning pairs and 36 default ligature checks against public upstream values. All twelve styles resolve to exact physical files through the current registry, including legacy family names and flags. This does not identify Office's physical font selection.

Each style lacks 14 codepoints from the 1,086-codepoint reference repertoire, including Bitcoin U+20BF and other currencies/symbols. Fontkit reports 1,073 cmap entries including noncharacter U+FFFF; useful reference coverage is 1,072. Sample Arabic, Hebrew and CJK text fails strict coverage explicitly. Selected Latin, Greek, Cyrillic, combining-mark and math samples have glyphs; complete language, bidi and script support is unverified.

Offline Chromium matches 59 of 60 style/script advances within 0.1px on both runtimes. Black Italic's decomposed `o + U+0302 + U+0301` is the counterexample: Fontkit measures 18.6875px at size 32; Chromium measures 19.109375px. For the explicit NFC control U+1ED1, both measure 19.109375px. The full decomposed sample differs by 0.421875px. Literal DOM/source text stays unchanged. This indicates a normalization/shaping difference without establishing whether the font or either engine should change. Product measurement/source remain unchanged.

Three complete slides were captured and visually inspected: scripts, quote/source, and metric/table. Text is readable, but existing sparse allocations and the low-contrast blue metric value remain visible. This is not polished-design certification. Each runtime generates one editable three-slide PPTX whose titles reimport; complete semantic/style fidelity and native selection remain unverified.

Keep Akasia experimental until decomposed-mark behavior, independent reference/version comparison, broader language shaping/wrapping/baselines, full-slide appearance and native selection are resolved. Do not normalize authored text, synthesize weights, weaken the browser tolerance or relabel public-data agreement as independent Aptos compatibility. The existing explicit visual fallback remains unchanged.
