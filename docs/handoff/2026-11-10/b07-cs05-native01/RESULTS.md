# Results: CS slot changes digit size, not word order

**The digit is now normal height, but the line still reads `1Bonjour`. This is not acceptable glyph/native output or a complete fix.** Root's single-file view and the independent single-file view agree. No new render or Office attempt was used for this audit.

Root's one attempt ran 2026-11-10 15:15:52.515–15:15:59.543 UTC. Wrapper0, worker0, no timeout/error; 93/93 primitive probes matched. Two windowless read-only opens, two owned closes, one SaveCopyAs24, one empty-owned Quit and zero editing actions completed. Original and saved-reopened API states match for both shapes: title Aptos Display40.5pt; body Aptos27.75pt; primary LanguageID1025, exact native text and all frames retained. These are metadata/API observations, not physical-face identification.

Before and immediate-after root global observations were empty. The qualified wrapper's postflight initially observed PID51504, then reached empty after18 read-only samples within its unchanged5s/100ms/51-query policy. Preserve that initial PID separately; no ownership attribution, attachment, kill or cleanup was inferred or performed by the audit agent.

| Pixel observation | Old native05 | CS-only actual05 | Core preview |
| --- | --- | --- | --- |
| Digit ink |8×15px|10×24px|9×24px|
| Digit position |before Bonjour|before Bonjour|after Bonjour|
| Bonjour geometry |x1003..1123, y387..417|identical|different shaped pixels|

There are exactly157 changed pixels across the entire1280×720 old/new native images. Every changed pixel lies in the digit ROI `[980,380,1000,425)`; outside it, decoded RGBA is identical. In particular Bonjour, heading, Arabic prefix and list marker each have zero changed pixels. This isolates the observed size-routing component without claiming a physical font, correct word order or full glyph/paint parity. The marker/punctuation differences from core remain. Core/new has5694 changed pixels; this is a measurement, not a tolerance or gate.

The fixed ink definition is RGB each strictly>127 and alpha255, with inclusive output bounds inside explicit half-open ROIs. New digit bounds are x983..992/y387..410; old x990..997/y396..410; core intended trailing digit x1119..1127/y387..410. Both actual PNGs are byte-identical3824B/SHA256 `f53426f165ad6ce7da516adfd49ae51afe69808534decc6f14c782d4050f84ea`; decoded RGBA SHA256 `16dfd52156ad611eec0be5bf79a3c437838ea65572a474cf161e3eb7601aeaf6`. Every PNG chunk CRC/filter is independently decoded with builtin zlib. Region labels are observations for these exact files, not general OCR. Ink bounds are not font sizes or baseline measurements.

The source proof independently replays the original05→CS-only one-slot delta: two shapes, all text/UTF16, ar-SA/altLang, point sizes, geometry, numbering and other rPr unchanged; all146 other local ZIP records exact. Input100889B/SHA256 `4bde59d9a5e6e08e365d0a92c111081efea6efb9dfc9e7807ad83f7262166bf7`. Saved104064B/SHA256 `47e88ab1b1373f0941febc38ad8e4b707f45495b1dc8a1aef4028500af012a00`. Both input and saved target rPr retain `latin=Aptos`, `cs=Aptos`, `lang=ar-SA`, `altLang=en-US`, `sz=2775`; the Arabic prefix/heading remain unchanged. Saved archives have147 parts each,44 added and44 removed part paths,100 common parts byte-changed. Full ZIPs, every part SHA and complete common XML structural differences are retained; no blanket structural or public-import parity claim follows.

The actual worker/supervisor/source are immutable; the full six-file controller matches the envelope and report. Envelope SHA256 `b8c7d6d341c2f18f34c371f76dd11b8da419e63f6c2192f10fb0a4375f5a8421`. Root's default-pure receipt records PASS with RunOffice absent, zero process queries and exact four snapshots. No agent invoked Office or queried a process. A local audit-script parse-only setup error is retained with its source and refusal; the new formatted descriptor script audited the same existing files without changing a native source or input.

Lossless top-level packet:103 records/5,522,476 retained bytes, gzip4,372,163B. Nested source-preparation packets retain and hash-check an additional38+447 records, including every earlier setup/oracle refusal and45admission/70managed results. These are prior pure evidence, not additional native observations. All original/frozen producers, earlier segmented05 findings and rejected hypotheses remain unchanged.

Original glyph05/06/09/10, reliable public-import behavior for a future product correction and release/native acceptance remain open. The present slot-only result supplies a real size component for a separately reviewed product fix; it does not solve or waive the order criterion. No additional variant or experiment is prepared here.
