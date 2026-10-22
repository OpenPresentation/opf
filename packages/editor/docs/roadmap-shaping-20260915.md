# Prepared text editing roadmap

Status: deferred implementation, preserved on September 15, 2026. The project
owner asked for validated work to be merged and unfinished work stored in the
roadmap. This PR now changes documentation only relative to its validated main
base; it does not ship the archived runtime or claim its failing gates passed.

## Preserved work

Prepared glyph carets and selections, visible-line navigation, whole-source grapheme boundaries, nested SVG text-node traversal and joint rich-source editing.

- Archive branch: [`codex/archive-shaping-20260915`](https://github.com/OpenPresentation/opf-editor/tree/codex/archive-shaping-20260915).
- Immutable checkpoint: [`ae4cc6426b04c7ca428c1b4acacea2e11d99fa84`](https://github.com/OpenPresentation/opf-editor/tree/ae4cc6426b04c7ca428c1b4acacea2e11d99fa84).
- Validated runtime base: `cfdeae6627a42aa438c3d0bea5ea4155eb1688c4`.

The complete implementation, tests, licenses and earlier evidence remain at
that checkpoint. History was preserved with new commits; no force-push or
prototype deletion was needed. The final PR diff contains only documentation
and retained failure evidence. Merging this roadmap is not a feature release.

## Remaining acceptance

Local coordinated source and installed browser acceptance passed. Fresh published-dependency CI [35019417054](https://github.com/OpenPresentation/opf-editor/actions/runs/35019417054) exposed a stale assertion in test/packed-install.mjs:72: thirteen rich-input workflows passed, while the harness still expects ten. Correct the expected coverage and rerun the complete command when reviving this prototype; that discrepancy is distinct from the renderer font failure. No published editor regression is established by this archived candidate test mismatch.

Track coordinated font/measurement work in [renderer issue24](https://github.com/OpenPresentation/opf-render/issues/24).
Follow the [central deferred-work plan](https://github.com/OpenPresentation/opf/blob/main/docs/plans/deferred-shaping-20260915.md)
and [project handoff](https://github.com/OpenPresentation/opf/blob/main/docs/handoff-2026-09-15.md).

Resume from current main in a new branch and port a bounded supported subset.
Do not merge the entire archive to bypass release fixes. Preserve original
text, whitespace, UTF-16 source spans, formatting, undo, physical-font identity
and licenses. Use the same accepted geometry through rendering/editing/export.
Test actual candidate packages and the intended registry dependency graph;
keep original native failures visible. Publish new coordinated versions only
after the declared scope passes its acceptance gates.
