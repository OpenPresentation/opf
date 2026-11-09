# Font memory clarification

The 430-440 MiB observation is peak resident memory of the entire Node rendering process. It is not a measurement of font files or of the font loader alone. This is a read-only derivation of the sealed server baseline, not a new timed run or an optimization result.

The exact benchmark call is `loadFonts({pack: 'office', substitutionPolicy: 'visual'})`. With its default options it eagerly registers 131 faces: 40 Office-replacement faces, 78 open-catalog faces, 9 base faces and 4 Noto Sans fallback faces. A face means a weight/style, not necessarily a separate family. It does not request all optional world-script packs or enumerate the computer's installed fonts. The supplied deck needs a small subset of this selection.

For the 36-slide batch case, the recorded process RSS after setup and explicit GC was 187.7 MiB; the first render reached 436.1 MiB and the rendering peak was 436.8 MiB. Setup includes renderer modules, the font registry and shaping/subset engines. There was no checkpoint immediately before the font-loading call, so the font-loader-only RSS delta is unknown.

The shared-font output case loaded exactly the same font pack and reached 338.5 MiB. It omits font embedding, while retaining font measurement. That observed difference supports investigating the standalone export path but does not isolate an exact allocation category. The Node handle currently base64-encodes its eligible loaded faces before downstream per-slide used-face selection. Raw font buffers, parsed tables, measurement caches, encoded strings, WebAssembly memory and ordinary rendering allocations can coexist. Do not add `external` and `arrayBuffers`: the latter is included in the former.

The browser uses a different, lazy loader. Do not extrapolate this Node peak to a browser tab or a physical mobile device. The separate browser benchmark seals its own requests and memory/interaction evidence.

Next work remains controlled: reduce eager preparation and unnecessary encoding while preserving the selected font, glyph fallback, script behavior and exact rendered output. No font-memory production patch or lower-memory result is claimed here.

Run `node docs/handoff/2026-11-09/svg-performance/verify-font-memory-audit.mjs` from this checkout to verify the exact counts, source hashes and archived memory records in `font-memory-audit.json`. The parent benchmark's `verify-server-baseline.mjs` verifies the complete sealed run. This evidence-only branch must not be merged.
