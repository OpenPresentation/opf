# Scalar whitespace candidate

Plain prose fitting previously collapsed source spaces and tabs. This candidate keeps exact source ranges, CR/LF/CRLF boundaries, blank lines and explicit tab segments across shared fitting, SVG rendering and editable PPTX export/reimport. Nonbreaking prose tokens stay intact and report overflow when necessary. Retained whitespace participates in fitting; the former 70-repeat quote-footer expectation now correctly reports overflow, while a nearby 68-repeat control demonstrates automatic arrangement selection. Floors and tolerances are unchanged.

`source-graph.json` pins the four product commits. Subsequent branch commits contain CI coordination, verification harnesses and evidence. `candidate-manifest.json` records the unpublished local tarballs. Installed browser reports bind consumer locks, bundles and font assets; the scalar workflow also records its verifier and bundle hashes. No package was published and no deployment changed.

Both supported Mac Node runtimes pass fresh candidate installation, eight installed browser suites (276 assertions and eight trusted interaction scenarios each), and twelve additional offline scalar workflows. The scalar matrix covers measured/estimated placement, wide/portrait dimensions, nonempty/blank/empty source, no-op commit, editing, undo/redo and exact current text reimport. Four additional controls make separate keyboard edits during one focus session. The editor now preserves untouched mixed line endings between those edits and gives blank fields their actual layout selection box. The retained before logs reproduce both failures.

The bulk-replacement observation remains a limitation: a single wholesale textarea replacement uses the existing replacement-range newline policy. The per-input fix does not implement an arbitrary edit-diff algorithm or certify native IME behavior. Browser `fill` supplies normalized textarea text; pointer/keyboard controls are identified separately. The export hash is recorded for each workflow; the deterministic fixture script regenerates the packages rather than retaining their PPTX bytes here.

Core's full Node 24 suite passes, with focused plain-source/quote controls on Node 20. Full converter suites and the 805-slide structural corpus pass on both runtimes; final scalar XML-representability guards also pass the focused converter suite. Renderer Node 20 passes its full suite and the separate 805-slide checkpoint. Editor Node 24 passes its full suite. Earlier quote/heading expectation failures are retained with the corrected source-preserving controls. A stale-consumer browser attempt failed its build-ID guard while the first npm install was stalled; the completed clean installation and final browser reports supersede that attempt without weakening the guard.

Initial Linux coordination run `34531945429` stopped at an older ecosystem assertion requiring one native shape per text payload. The source-preserving converter now exports one shape per accepted line. The revised check verifies each line's exact text, all four coordinates, disabled native refitting, and exact group reimport. Both Mac runtimes pass it and the seven other coordinated pagination/layout/list/rich/data/font harnesses. The first added order assertion also exposed an incorrect test assumption: promoted regions are collected alphabetically in core, while native import orders payloads by their current spatial positions. The final check compares that spatial order; nested source order and arbitrary original OPF structure are not reconstructed. Both failures remain retained. Product code and numeric tolerances are unchanged by this harness follow-up.

The renderer's [portable corpus review](https://github.com/OpenPresentation/opf-render/tree/96e2eb3becebc8bd5192e058092432dca6e6963f/docs/evidence/source-whitespace-corpus-review) retains all 35 paired sheets for 279 changed slides and six complete before/after slide pairs. All were visually inspected; 526 of 805 hashes remain unchanged. Its exact predecessor reproduces the accepted rich-flow baseline. A separately retained package snapshot hashes every predecessor file; historical checkpoints remain unchanged. The renderer also retains both runtimes' 24 presentation cases / 48 title/body field checks and four inspected complete screenshots. Measured SVG advances pass the unchanged 0.1px gate with intrinsic correction bounded to 0.1% of width plus 1/64px. Accepted `textLength` may scale glyphs horizontally; this is not raw font equivalence. Estimated placement remains approximate.

PPTX line tags store only source identity/order, roles and hard-break separators, never old source words. Twenty converter cases cover exact current source, tab-stop XML, clearing, editing and shape reordering; seven damaged-group controls verify visible native fallback. Legacy heading tags remain supported. Arbitrary native formatting, geometry and OPF nesting are not reconstructed. XML-unrepresentable scalar input rejects with a source path.

Native Office acceptance remains separate. The six retained native metric-tab failures, unresolved per-glyph font identity, Akasia combining-mark/coverage findings and blocked native image controls are unchanged. No further COM retry or image cleanup claim is made. Sparse layouts, missing nested marker glyphs, unresolved assets/data and low contrast remain visible; the raster checkpoint does not certify general visual quality.

From coordinated checkouts, use Node 20 or 24 and run:

```sh
node scripts/link-ecosystem.mjs --packages-only
pnpm pack:ecosystem
pnpm test:packed-ecosystem
pnpm test:packed-browser
node scripts/test-plain-whitespace-workflow.mjs artifacts/plain-whitespace-installed installed
```

The renderer's `test/plain-whitespace-browser.mjs` and converter's `test/plain-whitespace.mjs` provide the independent rendering and structural controls. `manifest.json` records SHA-256 and byte size for every retained file except itself.
