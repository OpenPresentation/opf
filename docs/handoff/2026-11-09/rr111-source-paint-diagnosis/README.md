# RR-111: bounded Source-paint diagnosis

**The original partial Source image remains unexplained.** Two targeted baseline/candidate sequences did not reproduce it. The observed unsupported notice causes no layout shift at the original geometry; a pending CodeMirror measure also occurs with complete text in both builds. Neither observation proves the original cause, a timing explanation, or general visual acceptance. No runtime fix is recommended from this evidence.

Vetoable decision **RR111-PAINT-BOUNDED**: retain the original negative observation and stop after these bounded nonreproducing comparisons. Keep semantic download-adapter review separate from unresolved general Source-paint acceptance; select no runtime change without causal evidence.

This is an evidence-only branch, `codex/rr-111-source-paint-diagnosis`, at `C:/opf-work/rr111-paint`. Do not merge it as product source. The actual MCP source/qualification remains on the separately frozen RR-111 branch; the owner is reviewing the chart proposal before implementation. No folding, push, CI, provider or release action is included here.

## Exact inputs

An isolated checkout normally built baseline `6d5d61edc5c78a5c92128dd517c7dd6257d52331` (tree `4270c4111b41a1681a7af2088ec20f4986b1720b`), then normally fast-forwarded to frozen candidate `cf0a9d40e3516f39626509e555da592b5b8e0ef7` (tree `c4d22993b4c3f5cb6cc7ac03db7adef52e8bcc7d`). The maintained MCP builder, Node 24.20.0 and pnpm 10.33.2 produced and preserved both HTML resources:

| Input | HTML SHA-256 |
| --- | --- |
| Baseline | `9dd2198042e122c5a62aeea24615ab408cbaf9e940749cf70f344b524f86471e` |
| Candidate | `10d6b3bcbc93e9590205b8363e6c0e427223d8cbe40032c8681c7f48d36741a0` |

The candidate hash exactly matches the author's qualified build. Source/CSS, lockfile, SDK and editor objects outside the approved RR-111 adapter remain unchanged. The author's sealing worktree and protected artifacts were never edited.

The protected original unsupported screenshot is copied byte-for-byte as a separate negative observation, SHA-256 `3904f0dc68cccf10f074a14ea30d19d35529cb6e0ccf303de1092a87ce517d22`. Its initial lines are partly missing; no original DOM/range/style/viewport snapshot exists to establish why. New images do not replace or qualify that original image.

## Bounded method

- Newly owned headless Edge **156.0.4314.50**, matching the author, with viewport 1000×700 and cross-origin iframe 960×640.
- Original `allow-scripts allow-same-origin` sandbox and restrictive CSP; no permission, CSP, assertion or source change.
- Synthetic localhost host and actual MCP server connected by in-memory transport. Font reads stay local; no remote MCP, Claude/provider/admin API, Office, private browser profile or history is accessed.
- Actual CodeMirror view state is read through its existing DOM tile association. Captures retain source text, DOM ranges, selected computed styles, scroll/viewport and font state, before/after screenshot state, mutation/resize/font events and original PNGs.
- Stability is observed, never forced: CodeMirror measurement idle, fonts loaded and exact viewport/scroll/line geometry unchanged in two consecutive animation-frame observations. No arbitrary sleep, tolerance or `requestMeasure` intervention is used.

The first pair captures before Download, after the baseline fallback/candidate unsupported error, and after natural viewport stability. Full range/style reads precede these screenshots, which may influence paint; that limitation motivated one further targeted pair.

The fast-order pair first visits JSON, YAML and Markdown Source views in the same host, then opens the exact unsupported witness. It records only non-layout DOM/CodeMirror state before clicking. The original iframe-element screenshot method captures the outcome **before any text range/style/geometry read**. Full snapshots and a naturally stable capture follow. This is not a replay of the full browser suite or every earlier interaction in it.

## Observed results

Both builds display all 18 JSON lines in the newly inspected images. The CodeMirror document remains the exact 270-character source, with full viewport/visible range 0–270, 18 DOM lines and 41 non-empty text ranges. Registered Roboto 400/700 faces report loaded. Computed Source font stack and 22px line height agree. The unsupported notice appears only in the candidate; candidate Blob/anchor attempts are 0/0, baseline attempts are 1/1 as expected from the existing download bug.

At this geometry, the Source box remains `(0, 50.59375, 960, 523.40625)`, the editor remains `(0, 90.59375, 960, 483.40625)` and the footer remains `(0, 574, 960, 26)` before/after the notice and at stability. The observed error notice therefore produces no layout shift in this path.

The fast pair observes a scheduled CodeMirror measure in **both** builds, followed by idle state; the source is already completely painted in those earlier PNGs. A scheduled measure alone is not evidence that it caused the protected partial image. There is no measured font-loading or document-change explanation either. Do not label the protected image as flaky, timing, a baseline bug or an introduced regression from these observations.

Two diagnostic mistakes are retained transparently: a CommonJS import-owner error before browser creation, and an overstrict diagnostic assumption that initial model context always includes the document. The production contract intentionally includes the full document only after edits; the completed baseline captures remain valid, and the corrected diagnostic verifies the actual CodeMirror document. No maintained assertion changed and no product error was hidden.

## Evidence and remaining boundary

`files.json` transports every raw build/driver/snapshot/log from fresh `C:/opf-work/rr111-paint-diagnostic-01`, with SHA-256 hashes and lossless gzip where applicable. `receipt.json` binds exact sources and the narrow conclusion. Run:

```sh
node docs/handoff/2026-11-09/rr111-source-paint-diagnosis/verify.mjs
```

The verifier checks raw/stored hashes, both actual builds, the untouched original negative image, actual source documents/ranges, natural stable states, unchanged notice geometry and evidence-only descendant scope. It deliberately reports `originalPaintCauseResolved: false` and `generalVisualAcceptance: false`.

The required evidence-only `check:changed --base cf0a9d40e3516f39626509e555da592b5b8e0ef7` passed its build, Biome, changelog and skill-command steps. Its text test initially failed because this deliberately sparse checkout omitted one tracked 16,102-byte historical gzip fixture. That exact Git blob was hydrated without a source change; the affected `check:text` rerun passed all seven tests and the 8,488-file integrity scan. Both the original failure and recovery are retained in `final-checks.json`; no browser or causal run was repeated. Typecheck was correctly skipped because no TypeScript changed.

No additional causal run or source fix is authorized by this packet. Root owns any further specific investigation and actual host/merge/release acceptance. The download-adapter semantic review and prior strict-browser evidence remain separate from this unresolved paint observation.

- 2026-11-09 UTC: Preserved and built exact A/B sources in an isolated checkout; inspected both bounded sequences; retained the original partial image and both diagnostic mistakes. No source change selected.
