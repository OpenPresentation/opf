# Viewer coverage: defined, exercised and still owed

This audit ran no browser tests and no Claude client. Main source is `a52dc9441f7eec9dc6f72debb174339758e1761e`; the reviewed staging reference is `81f3bf800ac7edcdbd8073df9077ea706ee66145`. Package code was not copied into this docs branch.

Main defines these **11 viewer scenarios** in `packages/mcp/test/deck-app-browser.mjs` (Git blob `8609deabe15c3d82f5cda13638f3143032360434`). The source definitions are acceptance criteria, not a newly executed pass:

| # | Main scenario, verbatim | Evidence / remaining acceptance |
| --- | --- | --- |
| 1 | draws a JSON deck under the restrictive CSP, with fonts from read_font_file | Covered by prior staged sandbox run; repeat on final release/deployment and actual client. |
| 2 | tells the model what the viewer shows and what its checks found | Prior sandbox model-context assertions; actual host context remains a client check. |
| 3 | switches between Preview, Source and Both | Prior sandbox coverage; final client/viewport check owed. |
| 4 | an edit goes back to the model as the whole deck, and Send to Claude starts a turn | Prior host stand-in verifies messages; actual Claude turn/context behavior owed. |
| 5 | Undo and Redo, Find, the Review panel and the Design menu are the editor's own | Prior sandbox coverage; preserve history and final client behavior. |
| 6 | fits a frame as narrow as a chat column: the bar stays one row, nothing scrolls sideways | Prior sandbox viewport coverage; final narrow-client check owed. |
| 7 | opens a YAML deck in the view named by the arguments, on the slide asked for, in the host's dark theme | Prior sandbox arguments/theme check; final client check owed. |
| 8 | in a chat column with the host's own colours the whole view is one palette, and the open slide's thumbnail is in view | Prior sandbox coverage and coordinator image review; final client check owed. |
| 9 | exports PowerPoint, PDF and PNG in the sandbox and hands each file to the host | Prior stand-in file handoff, not proof a real client saved/opened each file. All three real saves owed. |
| 10 | a host that cannot save files gets no Export menu, and a deck that cannot open says so in place of the slide | Prior capability/refusal assertions; verify final app and supported client refusal behavior. |
| 11 | runs without a CSP violation or a page error | Prior sandbox run; final client console/CSP behavior owed. |

Staging's browser test blob is `f405f5db3cca81061a7769b12ea8c937f97d396d`. The accepted source-bound run retained **16 groups and 19 captures**: the 11 above plus exact edited source download, untouched JSON/YAML/Markdown preservation, incapable-host refusal, denied/cancelled/protocol-error source download, and capable-host binary Export denial. It keeps one shared host save transport and no iframe fallback. Current staged app blob: `4a6f7cc53d362d2a082d42e28a1f8596743ad295`.

Source-bound historical proof is at staging path `docs/handoff/2026-11-10/rr105-mcp-resource-frame/README.md`, normally folded at `1b6034589bcd0314fcd98d5b5cd51dc08f719999`. Its browser run exited 0; its separate required wrapper timed out at 60 s, while the attached child reported coverage later with no captured native exit code. Those results must not be relabeled a whole-check pass. The original oversize-resource failure and failed loader candidate remain retained. Later coordinator gates qualify their own complete source identities separately.

## What the eight public reads establish

At 2026-11-10T16:41–16:42Z the canonical endpoint initialized as **0.33.0**, listed 11 model-facing tools plus app-only `read_font_file`, and served `ui://opf/deck`. Resource HTML was **8,499,216 bytes**, SHA-256 `d7fb0581509bda099ff5a2db0558976c1bef4f1a45686e9d07788aaf30536eef`; its response JSON was 8,834,098 bytes. It contained the old history marker and lacked `deck-export` and `deck-verdict`. These are dated payload observations, not loading-time, memory or new-viewer fidelity measurements.

`resources/read` success is not execution of the viewer. The GET with event-stream Accept returned the expected stateless 405; it was not a plain-browser landing-page test. Documentation and privacy routes returned 200. Exact requests, response bytes and filtered headers are retained in the audit manifest; no auth, cookies or session values were supplied or saved.

## Final qualification record to fill after release

Record the actual 0.34 tag/commit, seven registry identities, site source and immutable/canonical deployment, MCP server version, resource/frame size, resource/tool inventory and client name/version. Run all 11 scenarios plus staged source/binary download error controls. Retain screenshots, exact source, exported files and their hashes, observed refusals and actual terminal status. A host acknowledgement alone is not proof of a saved file. Do not silently rerun a first failure or turn a missing/unsupported client capability into a pass.

Desktop Claude installation, directory review and owner/provider settings remain external qualification. This docs preparation does not claim them complete.
