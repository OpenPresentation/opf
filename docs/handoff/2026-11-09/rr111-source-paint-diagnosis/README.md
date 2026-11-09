# RR-111: bounded Source-paint evidence and interpretation corrections

**The retained PNG bytes do not establish a missing Source prefix.** Conflicting image-preview interpretations led to incorrect filename and baseline/candidate claims. Exact offline PNG decoding shows the first twelve Source text rows are byte-identical in both originals and both new edited-Both captures. The matched edited-Both captures are also whole-file byte-identical. No product paint defect or cause is established by this packet, and no general Source-paint acceptance or runtime fix is claimed.

Vetoable decision **RR111-PAINT-BOUNDED**: retain every original and attempt, retract unsupported visual claims, bind the conclusion to actual PNG bytes and stop after the authorized bounded controls. Root owns adapter acceptance and any further investigation. No product source, assertion, CSP, sandbox, permission, provider, Office, push, CI or release changed here.

This evidence-only branch is `codex/rr-111-source-paint-diagnosis`, at `C:/opf-work/rr111-paint`. Do not merge it as product source. The separately frozen MCP branch owns the adapter implementation. The owner is reviewing the chart representation before any chart edits.

## Image identity and corrected interpretation

The original files are retained byte-for-byte from `C:/opf-work/rr111-mcp/artifacts/rr111/after-screenshots-02/`:

| Image | SHA-256 | Exact scenario |
| --- | --- | --- |
| Original `host-download-unsupported.png` | `3904f0dc68cccf10f074a14ea30d19d35529cb6e0ccf303de1092a87ce517d22` | Unedited Source-only witness, unsupported host |
| Original `host-download-edited-json.png` | `b68dcd8cbb4377fb31bab91bcf2caf1acf376f3aac86435e40f44bd6979b2af7` | Edited Both view, accepted host, rename then Download |
| New baseline edited-Both capture | `da12a6f3ba1db50d8e0e042189cc60e5d7cbcc4291aa2b87cf699f77c8fccfa9` | Same maintained edit/rename/download sequence, actual baseline sandbox download refusal |
| New candidate edited-Both capture | `da12a6f3ba1db50d8e0e042189cc60e5d7cbcc4291aa2b87cf699f77c8fccfa9` | Same maintained sequence, actual exact host download RPC |

The new captures are both 45,680 bytes and byte-identical. Offline Sharp decoding of all four PNGs gives identical RGB bytes for Source rows 1-12: rectangle `(46,107,370,264)`, excluding gutter numbers and preview canvas, 293,040 RGB bytes, SHA-256 `85b645d8ba5d283ef9239b5b5e8b345803d8a97980e55f21f2330250d76c202d`. Every text band has positive dark glyph pixels: `64,341,247,129,286,13,118,15,164,305,128,5` at the recorded threshold. The verifier independently decodes the PNGs using only Node built-ins and checks this equality. The retained pixel evidence does not support the previously described absent top Source rows.

The correction history is explicit. Initial evidence head `c242ee74eca57c5faae35c10c4d58bf4a0a8e65b` called the unsupported original partial. A subsequent review reversed the filename attribution; a later root inspection reversed it again. I also incorrectly reported the new baseline partial and candidate complete before comparing their actual hashes. These descriptions are retracted, not causal findings. The exact raw images and all attempts remain unchanged. No explanation of the conflicting image-preview/inspection observations is proven; do not label the product flaky, a timing bug, a baseline defect or an introduced regression from those descriptions.

## Exact build inputs

The isolated checkout built baseline `6d5d61edc5c78a5c92128dd517c7dd6257d52331` (tree `4270c4111b41a1681a7af2088ec20f4986b1720b`), then normally fast-forwarded to frozen candidate `cf0a9d40e3516f39626509e555da592b5b8e0ef7` (tree `c4d22993b4c3f5cb6cc7ac03db7adef52e8bcc7d`). Node 24.20.0, pnpm 10.33.2 and the maintained MCP builder produced both preserved HTMLs:

| Input | HTML SHA-256 |
| --- | --- |
| Baseline | `9dd2198042e122c5a62aeea24615ab408cbaf9e940749cf70f344b524f86471e` |
| Candidate | `10d6b3bcbc93e9590205b8363e6c0e427223d8cbe40032c8681c7f48d36741a0` |

Candidate HTML exactly matches the author's qualified build. Source/CSS, lockfile, SDK and editor objects outside the approved adapter remain unchanged. The author's worktree and protected artifacts were never edited.

## Bounded controls and matched sequence

All observations use newly owned headless Edge 156.0.4314.50, viewport 1000x700, cross-origin iframe 960x640, original `allow-scripts allow-same-origin` sandbox and restrictive CSP. An actual MCP server uses in-memory transport and local fonts; no remote MCP, Claude/provider/admin API, Office, private browser profile or history is accessed.

The first two A/B sequences cover the unedited 270-character Source-only unsupported-host witness. They retain DOM/ranges/styles/fonts/viewport/scroll and natural stability snapshots. The first reads layout before screenshots; the fast-order pair captures using the original iframe-element screenshot before diagnostic layout reads. Both builds have full viewport 0-270, 18 DOM lines and 41 non-empty ranges, loaded Roboto 400/700 and unchanged Source/editor/footer geometry around the candidate unsupported notice. The fast pair has pending CodeMirror measure in both, followed by idle; that does not establish a cause. These sequences do not cover edited Both.

Root then authorized one exact edited-Both pair in fresh contexts, run through the maintained machine-wide agent slot. The host template is copied verbatim from the maintained browser test. It follows the full-source edit, exact model/source/canvas assertions, rename `Q3#1 100%`, actual Download attempt, candidate exact RPC/notice assertions, then the original iframe screenshot point. No earlier diagnostic screenshot, range/style/geometry read, forced measurement or arbitrary sleep precedes that target capture. Only after the target image are existing CodeMirror/DOM/ranges/styles/fonts/model states read. No further stage controls or browser runs followed.

The baseline attempts one Blob and one anchor, records no host download RPC and emits the expected strict-sandbox `allow-downloads` refusal. Candidate attempts zero Blob/anchor fallbacks and completes one exact `file:///Q3%231-100%25.opf.json` / `application/json` / current 311-character source RPC. Both post-target snapshots contain all 18 lines, viewport 0-311, 41 positive text ranges, loaded fonts, identical geometry and pending CodeMirror measure 17. Their actual PNG bytes are identical. This bounds one matched comparison; it does not establish a root cause or general paint fidelity.

Two setup/diagnostic mistakes are also retained: CommonJS import-owner error before browser creation, and an overstrict assumption that initial host context always includes the document. Production intentionally includes the full document after edits only; the corrected diagnostic checks actual CodeMirror text. No maintained assertion changed.

## Packet, checks and resume boundary

`files.json` transports the initial raw builds, drivers, attempts and snapshots. `final-checks.json` retains mapped documentation-check logs. `supplement.json` binds the actual original edited-Both image, authorized matched pair, raw pixel analysis and correction history. Lossless transports retain raw/stored SHA-256 and byte counts. Run:

```sh
node docs/handoff/2026-11-09/rr111-source-paint-diagnosis/verify.mjs
```

The verifier checks exact sources/protected objects, built HTMLs, all transports, baseline/candidate RPC behavior, whole-file matched PNG equality, independently decoded original/control prefix equality and evidence-only descendant scope. `productPaintDefectEstablished`, `originalPaintCauseResolved` and `generalVisualAcceptance` remain false.

Required evidence-only `check:changed --base cf0a9d40e3516f39626509e555da592b5b8e0ef7` passed build, Biome, changelog and skill-command steps. Text initially failed because sparse checkout omitted a tracked 16,102-byte historical gzip fixture. The exact Git blob was hydrated; only affected `check:text` reran, passing seven tests and the 8,488-file scan. Failure and recovery remain retained. Typecheck correctly skipped. Subsequent corrections and supplement use hashes, offline decode, verifier and whitespace checks; no full browser suite was rerun.

Stop here. No runtime change is selected; semantic adapter review remains separate. Root owns any next narrowly justified investigation and actual host/merge/release acceptance.

- 2026-11-09 UTC: Preserved A/B builds, two unsupported-path sequences, setup mistakes, one newly authorized exact edited-Both pair, both original images and pixel proofs. Retracted conflicting visual interpretations; stopped all causal runs without a source fix or general visual acceptance claim.
