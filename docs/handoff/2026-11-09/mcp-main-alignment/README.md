# Main alignment: MCP viewer redesign and guarded host downloads

Source contribution in qualification; not a release, deployment, or actual Claude save claim.

Fresh origin/main is a52dc9441f7eec9dc6f72debb174339758e1761e (merged MCP viewer redesign/Export PR1254). This branch normally merges reviewed staging c2bee28714578af8d3e72475a5cdbaa37fdf9bf6. The setup was renamed from the still-unauthored native-reference lane to codex/v034-main-alignment; those native witnesses remain queued on a future new branch.

The coordinator reviewed the manual three-file resolution before commit. It keeps main's palette, sizing, Export menu/converters, copy fallback and opening-history fence, plus staging's exact-source host download contract. Both source and Export use one saveFile transport: capability is checked on each call, suggested filenames are encoded as URI components, source text is preserved, binary payloads retain main's bounded encoding chunks, and denial/cancellation/RPC errors remain visible. There is no direct iframe Blob/anchor download fallback and an acknowledgement does not establish that the user saved a file.

Both parents' browser scenarios remain. Host setup preserves main's palette/width/name options plus staged denial/error response modes, with only one ui/download-file handler. Staged selectors are mapped to the redesigned history/footer controls. The unsupported-capability transport control explicitly invokes the real hidden source handler; it is not a visible user-flow claim. A separate capable-host PPTX-denial scenario uses the real Export menu and checks both the generated archive and visible failure. All existing timeouts, CSP and semantic assertions are preserved.

Manual resolution identities and original conflict-stage blobs are in resolution.json. A transactional authoring guard originally refused an overbroad replacement (two matches) before writing any source; limiting it to the exact unsupported-host scenario corrected the authoring operation. This was not a product regression or test failure. Browser-harness syntax passed; pinned install/build/types/full maintained browser qualification and image review were still UNRUN at this source checkpoint.

Decision (vetoable), RR111-MAIN-ALIGNMENT: keep main's capability-hidden UI and staging's guarded transport as separate guarantees. A hidden handler test proves only the guard; actual capable-host source and binary Export checks prove the visible paths. Hosted site deployment/version and owner-only Claude connector adoption remain separate.

No native witness fixtures, corpus inputs, Office operations, provider changes or runtime optimization were authored in this lane. RR117 is folded separately by the coordinator.
