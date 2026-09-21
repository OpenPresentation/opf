# Native mixed-size table observation — portable evidence

This bundle preserves one bounded, read-only PowerPoint observation of the reviewed registry-generated mixed-size table fixture. The source contains one slide, one table, one row, one cell, five exact rich-text runs, one literal U+0009 tab, and no authored hard line break. The native worker opened an exact source snapshot read-only, recorded current content and geometry, exported one full-slide PNG, and closed that exact owned presentation once. It did not edit, save, reopen, create a PDF, embed a font, quit PowerPoint, kill Office, change security, or retry.

The worker exited `0` with cleanup confirmed. Its durable log contains 523 rows: 260 contiguous COM begin/success pairs, three lifecycle success markers, and zero errors. The supervisor records 34 matching external/snapshot hashes. Four session font additions were removed by the owning parent. The independent v1 audit passes 9/9 checks; the preserved v2 audit additionally validates each probe's containing-run style and the table's outer geometry instead of treating those values as observations alone.

## Measured result

The exact 245-character source text, all five run texts and styles, seven character starts, one paragraph, literal tab, and absence of hard breaks are retained. Native `TextRange2.Lines` gives these zero-based, half-open source intervals:

- `[0, 92)`
- `[92, 194)`
- `[194, 245)`

The offline estimated preview records `[0, 78)`, `[78, 172)`, and `[172, 245)`. Both contain three visible soft lines, but their source boundaries differ. The preview PNG and native PNG are retained for the root supervisor's recorded full-slide review. Their pixels are not asserted equal.

The source package requests uniform paragraph line spacing of `36.6` points. Native paragraph `SpaceWithin` reports `36.599998474121094` points, while the observed native line tops are `6`, `43`, and `80` points, a `37` point step in this finite sample. These are separate observations; this bundle does not infer an internal rounding or layout cause.

The paragraph has zero explicit tab stops. Native default tab spacing is `72` points, and the character after the literal tab starts `72` points from the reported cell text-range origin. Native `TextRange2` bounds are consistent with cell-local coordinates in this observation: the first line begins at left `7.5`, top `6`, matching the source margins, while the outer table/cell shape begins near left/top `43.2`. This is an interpretation of this slide, not a certified general coordinate-frame rule or transform. The verifier does not compare the local-looking text values directly with the outer shape origin.

## Gates and limits

The finite read-only content/style, table outer-geometry (`0.02` point tolerance), soft-wrap, input-integrity, raster-presence, ownership, and cleanup gates pass. The portable verifier independently checks character-probe styles against their containing authored runs and checks slide, row/column, table-shape, and cell-shape outer geometry.

This evidence does not test browser/native raster agreement, edit/save/reopen persistence, font embedding, or physical per-glyph font identity. It does not establish a general mixed-table layout rule or an engine cause for line, tab, bound, or spacing differences. No source text, position, offset, tolerance, or font family is changed as compensation.

## Contents and provenance

`native-run/` contains the exact worker, parent, durable stage, report, request, helper snapshots, source-fixture snapshot, [native full-slide PNG](native-run/native-observation.png), and font-registration records. [The estimated full-slide PNG](estimated/preview.png) is the non-font-bearing registry preview. `controls/` retains the passing no-Office pure regression, fixture-contract result, and exact checker source. `review/` contains the root visual review. `plan/` contains the reviewed final-worker plan. `audit/` preserves the independent audits. `source-copy-ledger.json` maps every copied byte stream to its original workspace path and hash.

The table fixture is stored only once, under `native-run/inputs/table-fixture/`; the corresponding registry files were byte-identical and are listed as omitted duplicates. The font-bearing SVG, all font programs, PDFs, and personal workspace screenshots are excluded. `omissions.json` records the excluded SVG and font-program hashes and sizes. The two retained PNGs are generated full-slide evidence artifacts, not workspace screenshots.

The registry generator's `generatedAt: 2026-09-21T00:00:00.000Z` is fixed reproducibility metadata. It is not asserted to be the actual generation wall-clock time.

## Portable reconstruction recipe

The bundle verifier never executes PowerPoint, PowerShell, the worker, font registration, or the fixture generator. `python verify.py` uses only the Python standard library to verify the complete manifest, copied-byte ledger, JSON/JSONL, PPTX ZIP/CRC/XML, native observations, independent audits, PNG headers, omissions, and gate boundaries.

Any later supervised native reproduction must use a fresh output directory outside this evidence bundle and these frozen paths:

- Worker: `native-run/inputs/native-mixed-table-observe.ps1`
- Process helper: `native-run/inputs/native-process.ps1`
- Session-font helper: `native-run/inputs/native-text-fonts.ps1`
- Source PPTX: `native-run/inputs/table-fixture/source.pptx`
- Table fixture directory: `native-run/inputs/table-fixture`
- Frozen font metadata: `native-run/inputs/generation.json`
- OFL license: `native-run/inputs/LICENSE_FONT`

Font programs must be acquired separately from permitted `@expo-google-fonts/carlito@0.4.1` package bytes. Construct an external font-fixture directory with copies of the frozen `generation.json` and `LICENSE_FONT`, plus a `fonts/` directory containing the four exact filenames recorded there. Before supervised use, validate package-manifest SHA-256 `cada00d32e296a97db384203c837750567583d16dd3e66b6f7337bd8e6bb80d6`, license SHA-256 `58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00`, and every font-program hash in `omissions.json`. The worker's root process may then receive that external directory as `-FontFixtureDirectory`; the portable verifier never does so.

The frozen `generate.mjs` is the historical exact-layout generator, not a generic portable generator. It accepts no CLI path options: it resolves `registry-consumer` and `toolchain` beneath a resume root two parents above its own output folder. Reusing it would require a fresh directory tree with that same relative structure, Node `v24.21.0`, separately acquired permitted font bytes, and the [merged exact registry lock at core commit `009ba028`](https://github.com/OpenPresentation/opf/blob/009ba028/docs/evidence/windows-native-picture-20260921/registry-consumer/package-lock.json), SHA-256 `4868f13254e3e681566164da8427d3716ceaa025435e4606e5e15fc8a87bc305`. Regeneration must target a fresh directory and is not evidence from the completed native run unless separately reviewed and bound. Regenerating the PPTX is not required to replay the native control because the exact frozen source PPTX is already included.
