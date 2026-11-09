# One-case golden font and geometry audit

**Evidence only — NEVER MERGE.** This branch retains accepted diagnostics for `inverted-pyramid 1 long`; it contains historical348fd engine source, not a shipping candidate. No runtime, test, schema, golden baseline or package input was changed. Coordinator owns publication; this evidence does not accept the other66 pairs or qualify a release.

Both independently reconstructed SVGs match the official paired artifact hashes **before** any font conclusion:

- Before348fd323b31302b5a3cdd7af2db8bb8bf6fffa2a:934777d20e9b73c9b2792fc91c68a8ee8933659f2b05a047f61fb9635a5b5578.
- After f32 behavior, reconstructed through frozen63132173 with b487 runtime (the selector change does not affect this case):343293ce95f44cd81589cb686be52c653d5db47817ece2db057213207bd5490b.

The source item, both columns and every actual rich entry retain30px, with36.6px line height. Of30serialized SVG text nodes, the2headings remain unchanged; all28body nodes move down exactly2.18reference pixels (0.545pixels at the official0.25raster scale). Their content and every non-y attribute are identical: font size/family/weight, x positions, labels and line breaks do not change.

SH-26's retained-type wrapping trial centers the same464.4px-high two-column list within its468.76px body: `(468.76 - 464.4) / 2 = 2.18`. Columns change from y193.64/height468.76 to y195.82/height464.4. Relevant reviewed source is frozen sh26-tie composition.ts11258–11260. The coordinator's exact decoded PNG audit reports6089changed pixels in body bounds15,50..277,163; this task did not repeat that pixel decode. The exact matched SVGs establish a fractional vertical move, not smaller text, for this one case.

A new isolated worktree began at fresh main and normally fast-forwarded to historical348fd. Pinned Node24.20.0/pnpm10.33.2 frozen offline install and the maintained core/renderer dependency build passed at a clean348fd/tree0dc0a5c41c885d3df2000c5cf78eae12a4f5b5b2. The after renderer/core dist was imported read only from its separately frozen worktree; its hashes match the sealed b487 render receipt. Maintained `templateDeck` and `toSvg(...,7,{trace:true})` reconstruct the source-index6case; no custom fixture, PNG rerender, golden update/promote, product tests, provider/API, browser or Office action was used.

Raw SVGs, exact facts, proof scripts, setup logs and source bindings are compressed without content substitution. `evidence.json` binds them to the published pair manifest and the coordinator's existing RGBA report. Run `node docs/handoff/2026-11-09/golden-one-case-font-audit/verify.mjs` for offline bounded verification. It performs no render/test/provider action.
