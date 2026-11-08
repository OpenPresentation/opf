# Native wrapped title corpus (#1127)

The native-title regression composes all bundled examples using the Office visual font profile. Of 50 eligible wrapped titles, 49 have a native width preserving a two-sided 1% margin; one keeps measured lines. Thirty-one old exact-width native boxes violate the margin. The only product change is the opt-in native-title export frame or its explicit fallback; the preview and default measured export stay unchanged.

[Generator](generate.mjs) writes single-slide native witnesses preserving the source design and canvas, half-resolution matching previews, a manifest with source/dist and artifact hashes, and former-exact-width geometry controls for the 49 native titles. A geometry control restores only the original native title frame in the candidate archive; it is not a source-version export. The fallback candidate needs no inferred native baseline. No goldens are regenerated here.

Run after committing/building the source: `node docs/evidence/rr-105-native-title-wrap/generate.mjs --expect-source <full source SHA> --out C:/opf-work/<fresh directory>`.

Native acceptance is owed. The coordinator must compare each PowerPoint title's actual line text with the manifest's lines, retain the raw result and a before/after sheet, verify unchanged font sizes/no autofit and inspect clipping. Preserve each input canvas rather than forcing a 1280×720 aspect. The coordinator owns Office COM; the generator makes no Office calls. Never use a zero-file run as acceptance.

The generated [corpus archive](native-title-corpus.zip) contains all 50 candidate PPTX files, 49 former-exact-width native geometry controls, 50 matching previews and the [manifest](manifest.json). [Archive hash](archive-hash.json). Preview contact sheets: [1–20](preview-corpus-1.png), [21–40](preview-corpus-2.png), [41–50](preview-corpus-3.png). Native before/after sheets are owed. The source candidate is `09acf5561dae0758ed3496381fa9c0591168b5f9`.
