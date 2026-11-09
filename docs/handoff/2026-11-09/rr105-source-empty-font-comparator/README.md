# RR-105 source-bound empty native text frames in font comparison

The retained current feature-metrics native run has15 native shapes in every phase, but its
serialized source has14 text shapes plus one decorative card without txBody. PowerPoint
exposes an empty TextFrame/no-text descriptor on `OPF card slides.0.blocks.3`. The font
comparator counted that frame as requested text and refused15!=14. The existing geometry/text
comparator already handles this exact source-bound case; its rule remains unchanged.

Vetoable decision RR105-SOURCE-EMPTY-FONT: use the same exact-name, literal-empty-text rule
for whole-range font descriptors. Only a source shape without txBody can be exempt. Keep
source names unique/disjoint, native names unique and every expected text shape/font check.
Unbound or renamed empty frames, duplicate identities, bound frames gaining text, missing named
text and wrong/mixed/missing font descriptors must continue to fail or produce findings.
No blanket blank-text filter, tolerance change, worker change or schema/runtime change.

The actual regression fixture is in scripts/native-acceptance/fixtures/metrics-font-empty-frame:
input107,010 bytes SHA-2569d68dd0820805d1462027091e33f94e21f516d329e91d95a0f6fe203944b2ecc;
exact native report174,219 bytes SHA-2564ea405500557de21f946cb2d17c45be7c062668c080c2ece2579212040156b38,
stored as gzip to preserve its BOM/CRLF. The source is the public/synthetic metrics case from
immutable producer2400, suitefd13 and workerce92, with retained native evidence at commit
c900ebb7610c72e7e65329e77a04850e0f837852. No new Office operation produced this fixture.
Original-refusal.log.gz retains the exact on-disk coordinator refusal log (645 bytes,
SHA-25670c1af7ffd3a4e68f3cc2f9523899648cc5834637f46ce03ab144ce2b2dd6c8d); the original directory is untouched.

Focused font and unchanged text/binder controls passed23/23 before this source checkpoint.
They compare all14 actual source text shapes across three phases (42 font observations) and
retain inherited/mixed/malformed ownership refusals, plus actual-source/actual-report mutations.
Required mapped checks are pending. The one authorized actual replay will occur only after
source qualification, using the unchanged binder and corrected exported font functions, writing
a fresh wx result in C:/opf-work/n034-font-compare01. It will separately bind new comparator
HEAD/SHA, unchanged binder SHA and original suite/runtime/worker identities; it will not
impersonate the old producer or overwrite a native report/result. No CLI expansion is needed.

This establishes reported whole-range name/point-size/bold/italic comparisons only. It does
not establish physical font-file/glyph selection, baseline, raster fidelity or native release
acceptance. Producer2400, suite03, workerce92, font registration state, all PowerPoint processes
and the six excluded native cases stay untouched. Root alone owns COM and CI observation.
